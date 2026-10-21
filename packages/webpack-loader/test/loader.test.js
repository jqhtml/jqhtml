/**
 * Runs the loader under real webpack against the fixtures. The loader is referenced by
 * its package name, so the package's main/exports entry is exercised too.
 *
 * webpack is a devDependency; in the internal repo it is vendored only in
 * jqhtml-render-harness/node_modules, so resolution falls back to there.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const package_dir = path.dirname(here);
const repo_dir = path.resolve(package_dir, '../..');
const require = createRequire(import.meta.url);
const webpack = require(require.resolve('webpack', {
  paths: [here, path.join(repo_dir, 'jqhtml-render-harness')]
}));
const { SourceMapConsumer } = createRequire(path.join(repo_dir, 'packages/parser/package.json'))('source-map');

const fixture = (name) => path.join(here, 'fixtures', name);
const out_dirs = [];
after(() => out_dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/** Bundle one .jqhtml file as a CommonJS library; resolves with the stats and output dir. */
function bundle(entry, devtool) {
  const out_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqhtml_loader_test_'));
  out_dirs.push(out_dir);
  const compiler = webpack({
    mode: 'none',
    context: package_dir,
    target: 'node',
    devtool,
    entry,
    output: { path: out_dir, filename: 'bundle.cjs', library: { type: 'commonjs2' } },
    module: { rules: [{ test: /\.jqhtml$/, loader: '@jqhtml/webpack-loader' }] }
  });
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      compiler.close(() => {});
      if (err) reject(err);
      else resolve({ stats, out_dir });
    });
  });
}

test('compiles a template into a module whose default export is the template object', async () => {
  const { stats, out_dir } = await bundle(fixture('user_card.jqhtml'), false);
  assert.equal(stats.hasErrors(), false, stats.toString('errors-only'));

  const template = require(path.join(out_dir, 'bundle.cjs')).default;
  assert.equal(template.__jqhtml_template, true);
  assert.equal(template.name, 'User_Card');
  assert.equal(template.tag, 'div');
  assert.deepEqual(template.defaultAttributes, { class: 'card' });
  assert.equal(typeof template.render, 'function');
});

test('reports a compile error with the file, line and column', async () => {
  const { stats } = await bundle(fixture('broken_card.jqhtml'), false);
  assert.equal(stats.hasErrors(), true);
  const [error] = stats.toJson({ all: false, errors: true }).errors;
  assert.match(error.message, /Closing <\/span> does not match open <div>/);
  assert.ok(
    error.message.includes(`at ${fixture('broken_card.jqhtml')}:4:3`),
    `error should name broken_card.jqhtml:4:3, got:\n${error.message}`
  );
});

test('marks the module cacheable', async () => {
  const { stats } = await bundle(fixture('user_card.jqhtml'), false);
  const module = [...stats.compilation.modules].find((m) => (m.resource || '').endsWith('user_card.jqhtml'));
  assert.ok(module, 'fixture module not found in the compilation');
  assert.equal(module.buildInfo.cacheable, true);
});

test('passes the template source map to webpack when devtool asks for one', async () => {
  const { stats, out_dir } = await bundle(fixture('user_card.jqhtml'), 'source-map');
  assert.equal(stats.hasErrors(), false, stats.toString('errors-only'));

  const code = fs.readFileSync(path.join(out_dir, 'bundle.cjs'), 'utf8');
  assert.ok(!code.includes('sourceMappingURL=data:'), 'the inline map must not be left in the module');

  const map = JSON.parse(fs.readFileSync(path.join(out_dir, 'bundle.cjs.map'), 'utf8'));
  const at = map.sources.findIndex((s) => s.endsWith('user_card.jqhtml'));
  assert.ok(at >= 0, `no user_card.jqhtml in sources: ${map.sources.join(', ')}`);
  assert.equal(map.sourcesContent[at], fs.readFileSync(fixture('user_card.jqhtml'), 'utf8'),
    'sourcesContent must be the template, not the compiled JavaScript');

  // `this.args.name` is on template line 2; its generated position must map back there.
  const lines = code.split('\n');
  const line = lines.findIndex((l) => l.includes('this.args.name')) + 1;
  const column = lines[line - 1].indexOf('this.args.name');
  const original = await SourceMapConsumer.with(map, null, (c) => c.originalPositionFor({ line, column }));
  assert.ok(original.source.endsWith('user_card.jqhtml'));
  assert.equal(original.line, 2);
});

test('emits no source map when devtool is off', async () => {
  const { stats, out_dir } = await bundle(fixture('user_card.jqhtml'), false);
  assert.equal(stats.hasErrors(), false, stats.toString('errors-only'));
  assert.ok(!fs.readFileSync(path.join(out_dir, 'bundle.cjs'), 'utf8').includes('sourceMappingURL'));
  assert.ok(!fs.existsSync(path.join(out_dir, 'bundle.cjs.map')));
});
