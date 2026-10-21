/**
 * Every localStorage entry key carries the jqhtml version:
 * `jqhtml::<developer_key>::<jqhtml_version>::<cache_key>`.
 *
 * Two tabs running different jqhtml versions against the SAME app cache key share one
 * localStorage. The versioned scope marker clears every jqhtml key when the newer tab calls
 * set_cache_key(), but the older tab keeps writing afterwards (writes never re-check the
 * marker). Without the version in the entry key, the newer tab then read those entries,
 * written in the older version's key shape and data format.
 *
 * "Tab A" is dist/index.js. "Tab B" is a copy of dist/jqhtml-core.esm.js (an independent
 * bundle with no imports) whose stamped version is replaced, so it has its own
 * Jqhtml_Local_Storage statics AND a different version - exactly what two tabs on two
 * releases share.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { version, Jqhtml_Local_Storage as Tab_A } from '../dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OTHER_VERSION = '0.0.0-other';
const SCOPE_MARKER_KEY = '_jqhtml_cache_key';

let Tab_B;
let stub_dir;

beforeAll(async () => {
  const source = fs.readFileSync(path.join(here, '../dist/jqhtml-core.esm.js'), 'utf8');
  const stamped = `'${version}'`;
  // Both the cache's CORE_VERSION and the exported version are stamped literals.
  expect(source.split(stamped).length - 1).toBeGreaterThanOrEqual(2);
  stub_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jqhtml-version-stub-'));
  const stub_file = path.join(stub_dir, 'jqhtml-core-other-version.mjs');
  fs.writeFileSync(stub_file, source.split(stamped).join(`'${OTHER_VERSION}'`));
  ({ Jqhtml_Local_Storage: Tab_B } = await import(pathToFileURL(stub_file).href));
});

afterAll(() => {
  if (stub_dir) fs.rmSync(stub_dir, { recursive: true, force: true });
});

beforeEach(() => localStorage.clear());

describe('entry key format', () => {
  it('writes `jqhtml::<developer_key>::<version>::<cache_key>`', () => {
    Tab_A.set_cache_key('myapp_user_1');
    Tab_A.set('Profile::{}', { n: 1 });

    expect(localStorage.getItem(`jqhtml::Profile::{}::${version}::myapp_user_1`)).not.toBeNull();
  });

  it('puts the version in the key once, matching the scope marker suffix', () => {
    Tab_A.set_cache_key('myapp_user_1');
    Tab_A.set('Profile::{}', { n: 1 });

    const marker = localStorage.getItem(SCOPE_MARKER_KEY);
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('jqhtml::'));
    expect(keys).toEqual([`jqhtml::Profile::{}::${marker}`]);
    expect(keys[0].split(version).length - 1).toBe(1);
  });
});

describe('two jqhtml versions with the same app cache key', () => {
  it('loads a runtime copy stamped with another version', () => {
    expect(Tab_B).not.toBe(Tab_A);
    Tab_B.set_cache_key('shared_app_key');
    expect(localStorage.getItem(SCOPE_MARKER_KEY)).toBe(`${OTHER_VERSION}::shared_app_key`);
  });

  it('does not read an entry the other version wrote after the scope check', () => {
    Tab_B.set_cache_key('shared_app_key');   // older tab, already open
    Tab_A.set_cache_key('shared_app_key');   // newer tab boots: marker changes, clears
    Tab_B.set('Widget::{}', { from: 'other version' }); // older tab keeps writing

    expect(Tab_A.get('Widget::{}')).toBeNull();
    expect(Tab_B.get('Widget::{}')).toEqual({ from: 'other version' });
  });

  it('serves each version only its own entry under the same developer key', () => {
    Tab_B.set_cache_key('shared_app_key');
    Tab_A.set_cache_key('shared_app_key');

    Tab_A.set('Widget::{}', { from: 'A' });
    Tab_B.set('Widget::{}', { from: 'B' });

    expect(Tab_A.get('Widget::{}')).toEqual({ from: 'A' });
    expect(Tab_B.get('Widget::{}')).toEqual({ from: 'B' });
  });

  it('remove() in one version leaves the other version\'s entry alone', () => {
    Tab_B.set_cache_key('shared_app_key');
    Tab_A.set_cache_key('shared_app_key');
    Tab_A.set('Widget::{}', { from: 'A' });
    Tab_B.set('Widget::{}', { from: 'B' });

    Tab_A.remove('Widget::{}');

    expect(Tab_A.get('Widget::{}')).toBeNull();
    expect(Tab_B.get('Widget::{}')).toEqual({ from: 'B' });
  });
});

describe('old-format entries (no version in the key)', () => {
  it('are a cache miss even when the scope marker matches', () => {
    Tab_A.set_cache_key('myapp_user_1');
    // Same marker, so set_cache_key() clears nothing; an entry in the pre-2.3.75 format.
    localStorage.setItem('jqhtml::Profile::{}::myapp_user_1', '{"old":true}');

    expect(Tab_A.get('Profile::{}')).toBeNull();
    // Left in place for the scope check / quota cleanup; never overwritten or read.
    expect(localStorage.getItem('jqhtml::Profile::{}::myapp_user_1')).toBe('{"old":true}');
  });

  it('are removed by the scope check when the stored marker is from another version', () => {
    localStorage.setItem(SCOPE_MARKER_KEY, '0.0.1::myapp_user_1');
    localStorage.setItem('jqhtml::Profile::{}::myapp_user_1', '{"old":true}');
    localStorage.setItem('unrelated_library_key', 'keep me');

    Tab_A.set_cache_key('myapp_user_1');

    expect(localStorage.getItem('jqhtml::Profile::{}::myapp_user_1')).toBeNull();
    expect(localStorage.getItem('unrelated_library_key')).toBe('keep me');
  });
});

describe('quota cleanup with versioned keys', () => {
  // jsdom's localStorage is a Proxy; patch the prototype it forwards to.
  const storage_proto = Object.getPrototypeOf(localStorage);
  const real_set_item = storage_proto.setItem;
  afterEach(() => { storage_proto.setItem = real_set_item; });

  it('clears every jqhtml entry (any version, any format) and leaves other keys', () => {
    Tab_B.set_cache_key('shared_app_key');
    Tab_A.set_cache_key('shared_app_key');
    Tab_A.set('Mine::{}', { v: 'A' });
    Tab_B.set('Theirs::{}', { v: 'B' });
    localStorage.setItem('jqhtml::Old::{}::shared_app_key', '{"old":true}');
    localStorage.setItem('unrelated_library_key', 'keep me');
    localStorage.setItem('jqhtmlish_not_ours', 'keep me too');
    const marker_before = localStorage.getItem(SCOPE_MARKER_KEY);

    const target = `jqhtml::Big::{}::${version}::shared_app_key`;
    let armed = true;
    storage_proto.setItem = function (key, value) {
      if (armed && key === target) {
        armed = false;
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return real_set_item.call(this, key, value);
    };

    Tab_A.set('Big::{}', { big: true });

    const jqhtml_keys = Object.keys(localStorage).filter((k) => k.startsWith('jqhtml::'));
    expect(jqhtml_keys).toEqual([target]);
    expect(Tab_A.get('Big::{}')).toEqual({ big: true });
    expect(localStorage.getItem('unrelated_library_key')).toBe('keep me');
    expect(localStorage.getItem('jqhtmlish_not_ours')).toBe('keep me too');
    expect(localStorage.getItem(SCOPE_MARKER_KEY)).toBe(marker_before);
  });
});
