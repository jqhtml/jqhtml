/**
 * Guard test: manually creating elements with data-sid via jQuery must throw.
 *
 * data-sid is provisioned ONLY by the jqhtml template renderer, which always
 * pairs it with a scoped id ("<sid>:<cid>"). Hand-writing data-sid in a
 * jQuery-created element produces an element the framework never provisioned,
 * so this.$sid() can never find it. The jquery-plugin guard catches this at
 * creation/insertion time.
 *
 * Standalone runner (core has no jest harness): `node test/sid-guard-test.mjs`
 * Requires jsdom + jquery (resolved from the repo root node_modules).
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body><div id="root"></div></body>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const jqMod = await import('jquery');
const jQuery = jqMod.default ?? jqMod;
const $boot = (typeof jQuery === 'function' && jQuery.fn) ? jQuery : jQuery(dom.window);
globalThis.window.jQuery = $boot;
globalThis.window.$ = $boot;

const { init_jquery_plugin } = await import('../dist/jquery-plugin.js');
init_jquery_plugin($boot);
const $ = globalThis.window.$; // plugin swaps in the component-aware constructor

let pass = 0, fail = 0;
function check(label, fn, shouldThrow) {
  let threw = false, msg = '';
  try { fn(); } catch (e) { threw = true; msg = e.message; }
  // When we expect a throw, it must be OUR guard ([JQHTML] ... data-sid ...).
  const rightError = !shouldThrow || (msg.startsWith('[JQHTML]') && msg.includes('data-sid'));
  if (threw === shouldThrow && rightError) {
    pass++; console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label} (threw=${threw}, expected=${shouldThrow})` + (msg ? `\n        ${msg.split('\n')[0]}` : ''));
  }
}

console.log('--- must THROW: hand-written data-sid ---');
check(`.html('<div data-sid="items_container">')  [reported bug]`,
  () => $('#root').html('<div class="entity-chips" data-sid="items_container"></div>'), true);
check(`$('<div data-sid="x">')  construction`, () => $('<div data-sid="x"></div>'), true);
check(`.append('<span data-sid="y">')`, () => $('#root').append('<span data-sid="y"></span>'), true);
check(`.prepend('<i data-sid="z">')`, () => $('#root').prepend('<i data-sid="z"></i>'), true);
check(`.after('<b data-sid="w">')`, () => $('#root').after('<b data-sid="w"></b>'), true);
check(`.replaceWith('<u data-sid="v">')`, () => $('#root').replaceWith('<u data-sid="v"></u>'), true);
check(`nested data-sid in html`, () => $('#root').html('<ul><li data-sid="row"></li></ul>'), true);

console.log('--- must NOT throw ---');
// Framework format: data-sid paired with its scoped id is legitimate output.
check(`provisioned id+data-sid (framework render output)`,
  () => $('<div></div>').html('<div id="items_container:cid123" data-sid="items_container"></div>'), false);
check(`plain html, no data-sid`, () => $('<div></div>').html('<div class="foo">hi</div>'), false);
check(`.html() getter`, () => $('#root').html(), false);
check(`normal selector $('#root')`, () => $('#root'), false);
check(`$('<div>') plain element creation`, () => $('<div class="x"></div>'), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
