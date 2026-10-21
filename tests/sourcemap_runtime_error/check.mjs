#!/usr/bin/env node
/**
 * A runtime error thrown by the SECOND of two expressions on one template line must map,
 * through the compiled template's inline sourcemap, to that expression's line and
 * column - not to the first expression, and not to the line before.
 *
 * The harness inlines templates into a webpack bundle, where the template's own inline
 * map is not used, so this test serves the compiled template as its own <script> next
 * to jQuery and @jqhtml/core, boots the component with the real runtime, takes the
 * stack position the browser reports for the render frame, and resolves it in Node
 * with the source-map package.
 *
 * Engine: JQHTML_BROWSER (default chromium); connects to JQHTML_BROWSER_WS when the
 * suite runner provides a shared browser.
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const harness_require = createRequire(path.join(root, 'jqhtml-render-harness/package.json'));
const parser_require = createRequire(path.join(root, 'packages/parser/package.json'));
const playwright = harness_require('playwright');
const { SourceMapConsumer } = parser_require('source-map');
const { compileTemplate } = await import(path.join(root, 'packages/parser/dist/compiler.js'));

const engine = process.env.JQHTML_BROWSER || 'chromium';
const fail = (message) => {
  console.log(`VERDICT: FAIL (${message})`);
  process.exit(1);
};

// 1. Compile with an inline sourcemap, exactly as `jqhtml-compile --sourcemap` does
const template_file = path.join(here, 'test.jqhtml');
const source = fs.readFileSync(template_file, 'utf8');
const { code } = compileTemplate(source, 'test.jqhtml', { format: 'iife', sourcemap: true });
const map_match = code.match(/sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)$/);
if (!map_match) fail('compiled template has no inline sourcemap');
const map = JSON.parse(Buffer.from(map_match[1], 'base64').toString('utf8'));

// The expected position comes from the template text: the second expression's code
const source_lines = source.split('\n');
const expected_line = source_lines.findIndex((l) => l.includes('this.args.missing.deep')) + 1;
const expected_column = source_lines[expected_line - 1].indexOf('this.args.missing.deep');
const first_column = source_lines[expected_line - 1].indexOf('this.args.label');
console.log(`Second expression is at template ${expected_line}:${expected_column} (first at ${expected_line}:${first_column})`);

// 2. Serve the page: jQuery, core, the compiled template as its own script
const files = {
  '/jquery.js': fs.readFileSync(path.join(root, 'node_modules/jquery/dist/jquery.js'), 'utf8'),
  '/core.js': fs.readFileSync(path.join(root, 'packages/core/dist/index.js'), 'utf8'),
  '/template.js': code,
  '/index.html': `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div>
<script src="/jquery.js"></script>
<script type="module">
  import jqhtml from '/core.js';
  window.jqhtml = jqhtml;
  // The boot error is logged with the Error object: keep the render frame's stack
  const original_error = console.error;
  console.error = (...args) => {
    for (const arg of args) {
      if (arg instanceof Error && window.__render_stack === undefined) window.__render_stack = String(arg.stack);
    }
    original_error.apply(console, args);
  };
  const script = document.createElement('script');
  script.src = '/template.js';
  script.onload = () => {
    jqhtml.register_template(template_Sourcemap_Runtime_Error);
    $('#app').component('Sourcemap_Runtime_Error', { label: 'ok' });
  };
  document.head.appendChild(script);
</script></body></html>`
};
const server = http.createServer((req, res) => {
  const body = files[req.url.split('?')[0]];
  if (body === undefined) { res.writeHead(404); res.end(); return; }
  const type = req.url.endsWith('.html') ? 'text/html' : 'text/javascript';
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
  res.end(body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// 3. Boot it in the browser and take the stack
const browser = process.env.JQHTML_BROWSER_WS
  ? await playwright[engine].connect(process.env.JQHTML_BROWSER_WS)
  : await playwright[engine].launch({ headless: true });
let stack;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(() => window.__render_stack !== undefined, null, { timeout: 15000 });
  stack = await page.evaluate(() => window.__render_stack);
  await context.close();
} catch (error) {
  await browser.close();
  server.close();
  fail(`no render error captured in ${engine}: ${error.message}`);
}
await browser.close();
server.close();

console.log(`Stack (${engine}):\n${stack}`);

// The top frame in the compiled template: Chromium "(…/template.js:L:C)",
// Firefox/WebKit "…@…/template.js:L:C". All three report 1-based lines and columns.
const frame = stack.split('\n').find((line) => line.includes(`${origin}/template.js:`));
if (!frame) fail('no stack frame in template.js');
const position = frame.match(/template\.js:(\d+):(\d+)/);
const generated = { line: Number(position[1]), column: Number(position[2]) - 1 };
console.log(`Render frame: template.js ${generated.line}:${generated.column} (0-based column)`);

// 4. Resolve it through the inline map
const consumer = await new SourceMapConsumer(map);
const original = consumer.originalPositionFor(generated);
consumer.destroy();
console.log(`Maps to: ${original.source} ${original.line}:${original.column}`);

if (original.source !== 'test.jqhtml') fail(`mapped to source ${original.source}`);
if (original.line !== expected_line || original.column !== expected_column) {
  fail(`mapped to ${original.line}:${original.column}, expected ${expected_line}:${expected_column}`);
}
console.log('PASS: the error maps to the second expression\'s line and column');
console.log('VERDICT: PASS');
