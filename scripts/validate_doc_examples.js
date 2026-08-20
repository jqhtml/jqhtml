#!/usr/bin/env node
/**
 * validate_doc_examples.js - compile every jqhtml example in the documentation.
 *
 * Documentation examples are copy-pasted by readers, so an example that does not
 * compile is a defect. This walks the docs, extracts every ```jqhtml fenced block,
 * and runs it through jqhtml-compile.
 *
 * Fence tags (written in the info string, after the language):
 *
 *     ```jqhtml                 must compile  (the default)
 *     ```jqhtml expect-error    must FAIL to compile - a deliberate counter-example
 *     ```jqhtml fragment        skipped - an incomplete snippet, not a whole file
 *
 * Markdown renderers use only the first word of an info string for highlighting
 * and ignore the rest, so the tags are invisible to readers on GitHub.
 *
 * expect-error blocks are asserted to fail. If one starts compiling - because the
 * parser gained a feature, or the example drifted - that is reported too, so the
 * counter-examples cannot silently rot into valid code.
 *
 * A fence usually shows a <Define:> plus the markup that uses it, or several
 * components together. Neither is a standalone file, so each <Define:...>
 * ...</Define:...> region is extracted and compiled on its own and the
 * surrounding usage markup is ignored.
 *
 * Blocks with no <Define:> at all are skipped: they are invocation-site snippets
 * with no component to compile.
 *
 * Usage:
 *   node scripts/validate_doc_examples.js            # walk the default doc roots
 *   node scripts/validate_doc_examples.js docs/reference
 *   node scripts/validate_doc_examples.js --verbose  # list every block checked
 *
 * Exits non-zero if any example is wrong, so it can gate a release.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const script_dir = path.dirname(fileURLToPath(import.meta.url));
const repo_root = path.resolve(script_dir, '..');
const compiler = path.join(repo_root, 'packages', 'parser', 'bin', 'jqhtml-compile');

const DEFAULT_ROOTS = ['docs', 'README.md', 'TESTING.md', 'CLAUDE.md', 'CLAUDE.dist.md'];
// Historical records: they describe the tree as it was, and must not be "fixed".
const SKIP_DIRS = new Set(['archive', 'node_modules', '.git']);

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const roots = args.filter((a) => !a.startsWith('--'));

function collect_markdown(target, out) {
  const abs = path.resolve(repo_root, target);
  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (abs.endsWith('.md')) out.push(abs);
    return;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collect_markdown(path.join(abs, entry.name), out);
    } else if (entry.name.endsWith('.md')) {
      out.push(path.join(abs, entry.name));
    }
  }
}

/** Extract ```jqhtml fenced blocks with their 1-based opening line and tags. */
function extract_blocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let body = null;
  let start = 0;
  let tags = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (body === null) {
      const open = line.match(/^```jqhtml(\s+.*)?$/);
      if (open) {
        body = [];
        start = i + 1;
        tags = (open[1] || '').trim().split(/\s+/).filter(Boolean);
      }
    } else if (/^```\s*$/.test(line)) {
      blocks.push({ start, tags, source: body.join('\n') });
      body = null;
    } else {
      body.push(line);
    }
  }
  return blocks;
}

/**
 * Split a block into independently compilable units. A doc fence commonly pairs a
 * component definition with its usage, or shows several definitions at once; only
 * the <Define:> regions are whole files.
 */
function compile_units(source) {
  const regions = [];
  const re = /<Define:([A-Za-z_][A-Za-z0-9_]*)\b[\s\S]*?<\/Define:\1>/g;
  let m;
  while ((m = re.exec(source)) !== null) regions.push(m[0]);
  return regions.length > 0 ? regions : [source];
}

function compiles(source, tmp_dir, index) {
  const file = path.join(tmp_dir, `block_${index}.jqhtml`);
  fs.writeFileSync(file, source + '\n');
  try {
    execFileSync('node', [compiler, file], { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    const raw = ((err.stderr || '') + (err.stdout || '')).toString().trim();
    const first = raw.split('\n').find((l) => /error/i.test(l)) || raw.split('\n')[0] || 'unknown error';
    return { ok: false, message: first.replace(/^Error:\s*/, '').trim() };
  }
}

if (!fs.existsSync(compiler)) {
  console.error(`Compiler not found at ${compiler}\nRun the build first: npm run build`);
  process.exit(2);
}

// Self-test before reporting anything. The bin shim is committed but imports the
// parser's dist/, which is a build artifact and absent from a fresh clone. Without
// this check every example "fails" with a module-resolution error and the report is
// 300 lines of noise that says nothing about the docs.
{
  const probe_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqhtml_doc_probe_'));
  const probe = path.join(probe_dir, 'probe.jqhtml');
  fs.writeFileSync(probe, '<Define:Probe_Ok>\n  <p>ok</p>\n</Define:Probe_Ok>\n');
  let probe_err = null;
  try {
    execFileSync('node', [compiler, probe], { stdio: 'pipe' });
  } catch (err) {
    probe_err = ((err.stderr || '') + (err.stdout || '')).toString().trim();
  }
  fs.rmSync(probe_dir, { recursive: true, force: true });
  if (probe_err) {
    console.error('The compiler could not build a known-good template, so the docs cannot be checked.\n');
    if (/ERR_MODULE_NOT_FOUND|Cannot find module/.test(probe_err)) {
      console.error('The parser is not built. Run:\n\n  npm install && npm run build\n');
    } else {
      console.error(probe_err.split('\n').slice(0, 5).join('\n') + '\n');
    }
    process.exit(2);
  }
}

const files = [];
for (const r of roots.length ? roots : DEFAULT_ROOTS) collect_markdown(r, files);
files.sort();

const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqhtml_doc_check_'));
const problems = [];
let checked = 0;
let skipped = 0;
let counter_examples = 0;
let unit_index = 0;

for (const file of files) {
  const rel = path.relative(repo_root, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const block of extract_blocks(text)) {
    const where = `${rel}:${block.start}`;

    if (block.tags.includes('fragment')) {
      skipped++;
      if (verbose) console.log(`  skip     ${where} (fragment)`);
      continue;
    }

    if (block.tags.includes('expect-error')) {
      // Counter-examples are compiled whole: the point is that the block is invalid.
      const result = compiles(block.source, tmp_dir, unit_index++);
      counter_examples++;
      if (result.ok) {
        problems.push({ where, message: 'tagged expect-error but it COMPILES - the example is no longer invalid' });
      } else if (verbose) {
        console.log(`  ok       ${where} (expect-error, correctly rejected)`);
      }
      continue;
    }

    if (!block.source.includes('<Define:')) {
      skipped++;
      if (verbose) console.log(`  skip     ${where} (no <Define:>)`);
      continue;
    }

    for (const unit of compile_units(block.source)) {
      checked++;
      const result = compiles(unit, tmp_dir, unit_index++);
      if (!result.ok) {
        problems.push({ where, message: result.message });
      } else if (verbose) {
        console.log(`  ok       ${where}`);
      }
    }
  }
}

fs.rmSync(tmp_dir, { recursive: true, force: true });

console.log('');
console.log(`Documentation examples: ${files.length} files`);
console.log(`  compiled     ${checked}`);
console.log(`  counter-ex   ${counter_examples} (expect-error)`);
console.log(`  skipped      ${skipped} (fragment / no <Define:>)`);

if (problems.length === 0) {
  console.log(`\n\x1b[32mAll documentation examples are valid.\x1b[0m`);
  process.exit(0);
}

console.log(`\n\x1b[31m${problems.length} problem(s):\x1b[0m\n`);
for (const p of problems) console.log(`  ${p.where}\n      ${p.message}`);
console.log(`
Fix the example, or tag the fence if the failure is intentional:
  \`\`\`jqhtml expect-error   deliberately invalid, the point of the example
  \`\`\`jqhtml fragment       incomplete snippet, not a standalone file
`);
process.exit(1);
