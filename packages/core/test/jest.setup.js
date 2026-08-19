/**
 * Jest setup for @jqhtml/core unit tests.
 *
 * Core is a browser runtime: modules guard on `window.jqhtml?.debug` and
 * escape_html() escapes via document.createElement. A bare Node environment has
 * no `window` binding at all, so those guards throw ReferenceError rather than
 * short-circuiting. Production never sees this — the browser has a window, and
 * @jqhtml/ssr installs jsdom globals (packages/ssr/src/environment.js) before
 * loading core.
 *
 * We install the same jsdom globals here so unit tests exercise core in the
 * environment it is actually designed for. jsdom is already a declared
 * dependency of this package - no new dependency is introduced.
 *
 * This is NOT a substitute for the browser suite in /tests. These unit tests
 * cover DOM-free logic only (key generation, registry bookkeeping, escaping,
 * cache normalization). Component lifecycle belongs in the Chrome suite.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
