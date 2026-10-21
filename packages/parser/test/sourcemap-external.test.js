/**
 * `sourcemap: 'external'`: the same map the inline option embeds, returned as an object
 * with no comment in the code, and the CLI's --sourcemap=external writing it next to
 * the output. Inline stays the default way to ship a map.
 */

import { compileTemplate } from '../dist/index.js';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'jqhtml-compile');
const SOURCE = '<Define:Map_T>\n  <p><%= this.args.title %></p>\n  <%= a + b %>\n</Define:Map_T>\n';
const INLINE = /\n\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)$/;

describe("compileTemplate sourcemap: 'external'", () => {
  for (const format of ['iife', 'esm', 'cjs', 'umd']) {
    it(`${format}: returns the inline map as an object, and the code without the comment`, () => {
      const inline = compileTemplate(SOURCE, 'map_t.jqhtml', { format, sourcemap: true, version: '9.9.9' });
      const external = compileTemplate(SOURCE, 'map_t.jqhtml', { format, sourcemap: 'external', version: '9.9.9' });
      const match = inline.code.match(INLINE);
      assert.ok(match, 'inline map present');
      assert.strictEqual(external.code, inline.code.slice(0, match.index));
      assert.deepStrictEqual(external.map, JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')));
      assert.ok(!external.code.includes('sourceMappingURL'));
      assert.strictEqual(external.map.version, 3);
      assert.deepStrictEqual(external.map.sources, ['map_t.jqhtml']);
      assert.strictEqual(external.map.mappings.split(';').length, external.code.split('\n').length);
    });
  }

  it('true and false return no map object', () => {
    assert.strictEqual(compileTemplate(SOURCE, 'm.jqhtml', { format: 'esm', sourcemap: true }).map, undefined);
    const none = compileTemplate(SOURCE, 'm.jqhtml', { format: 'esm', sourcemap: false });
    assert.strictEqual(none.map, undefined);
    assert.ok(!none.code.includes('sourceMappingURL'));
  });
});

describe('jqhtml-compile --sourcemap=external', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqhtml-map-'));
    fs.writeFileSync(path.join(dir, 'map_t.jqhtml'), SOURCE);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('writes <output>.map and references it from the output', () => {
    const out = path.join(dir, 'build', 'map_t.js');
    execFileSync('node', [CLI, path.join(dir, 'map_t.jqhtml'), '-o', out, '--format', 'esm', '--sourcemap=external']);
    const code = fs.readFileSync(out, 'utf8');
    const map = JSON.parse(fs.readFileSync(out + '.map', 'utf8'));
    assert.ok(code.endsWith('\n//# sourceMappingURL=map_t.js.map'), code.slice(-80));
    assert.strictEqual(map.file, 'map_t.js');
    const expected = compileTemplate(SOURCE, 'map_t.jqhtml', { format: 'esm', sourcemap: 'external' });
    assert.strictEqual(map.mappings, expected.map.mappings);
    assert.deepStrictEqual(map.sourcesContent, [SOURCE]);
  });

  it('--sourcemap and --sourcemap=inline embed the map', () => {
    for (const flag of ['--sourcemap', '--sourcemap=inline']) {
      const out = path.join(dir, 'map_t.js');
      execFileSync('node', [CLI, path.join(dir, 'map_t.jqhtml'), '-o', out, flag]);
      assert.match(fs.readFileSync(out, 'utf8'), INLINE);
      assert.ok(!fs.existsSync(out + '.map'));
    }
  });

  it('without --output it fails, as there is nowhere to put the map', () => {
    const r = spawnSync('node', [CLI, path.join(dir, 'map_t.jqhtml'), '--sourcemap=external'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /--sourcemap=external requires --output/);
  });

  it('an unknown kind fails', () => {
    const r = spawnSync('node', [CLI, path.join(dir, 'map_t.jqhtml'), '--sourcemap=file'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /Invalid sourcemap: file\. Must be inline or external/);
  });
});
