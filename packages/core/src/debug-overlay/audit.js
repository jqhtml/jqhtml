#!/usr/bin/env node
/**
 * Convention audit for the debug overlay stylesheets.
 *
 * Runs inside the rollup build (rollup.config.js, debug_scss plugin) against the
 * COMPILED css of light.scss and shadow.scss, and fails the build on the first
 * violation. Also runnable by hand:
 *
 *   node src/debug-overlay/audit.js        # compiles both sheets and audits them
 *
 * The rules are the ones written down in src/debug-overlay/CLAUDE.md. This file
 * is the executable form of that document; change them together.
 */

import { fileURLToPath } from 'url';
import path from 'path';

export const CLASS_PREFIX = 'jqhtml-debug-';
export const ROOT_SELECTOR = 'html[data-jqhtml-debug]';

/** light.scss may set nothing but outlines - they never affect layout. */
export const LIGHT_ALLOWED_PROPERTIES = [
  'outline', 'outline-color', 'outline-style', 'outline-width', 'outline-offset',
];

/**
 * shadow.scss's :host rule must open with `all: initial` and then give an
 * explicit value to every property here: the inherited properties a page can
 * leak into a shadow tree, plus the box properties `all: initial` resets to
 * useless defaults (display: inline, position: static).
 */
export const HOST_REQUIRED_PROPERTIES = [
  'display', 'position', 'box-sizing', 'pointer-events',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height',
  'color', 'text-align', 'text-transform', 'text-indent', 'text-shadow',
  'letter-spacing', 'word-spacing', 'white-space', 'word-break', 'overflow-wrap', 'hyphens',
  'tab-size', 'direction', 'visibility', 'cursor', 'list-style', 'quotes',
];

const SHADOW_PSEUDO = '(?::(?:hover|focus|focus-visible|active|first-child|last-child|empty)|::(?:before|after))';
const CLASS_COMPOUND = `(?:\\.${CLASS_PREFIX}[a-z0-9-]+)+`;
const SHADOW_COMPOUND = `${CLASS_COMPOUND}${SHADOW_PSEUDO}*`;
const LIGHT_SELECTOR = new RegExp(`^${ROOT_SELECTOR.replace(/[[\]]/g, '\\$&')}(?:\\s+${CLASS_COMPOUND})+$`);
const SHADOW_SELECTOR = new RegExp(`^${SHADOW_COMPOUND}(?:\\s*[ >+~]\\s*${SHADOW_COMPOUND})*$`);

/**
 * Parse flat CSS (what sass emits for these sheets) into rules. Nested blocks
 * and at-rules are rejected outright: the overlay needs neither media queries
 * nor keyframes, and a flat sheet is what keeps this parser honest.
 */
export function parse_rules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('{', pos);
    if (open === -1) {
      if (text.slice(pos).trim()) throw new Error(`stray text outside any rule: ${text.slice(pos).trim().slice(0, 60)}`);
      break;
    }
    const selector = text.slice(pos, open).trim();
    if (selector.startsWith('@')) throw new Error(`at-rules are not allowed: ${selector}`);
    const close = text.indexOf('}', open);
    if (close === -1) throw new Error(`unclosed block for ${selector}`);
    const body = text.slice(open + 1, close);
    if (body.includes('{')) throw new Error(`nested block inside ${selector}`);
    const declarations = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const colon = d.indexOf(':');
      if (colon === -1) throw new Error(`malformed declaration "${d}" in ${selector}`);
      return { prop: d.slice(0, colon).trim().toLowerCase(), value: d.slice(colon + 1).trim() };
    });
    rules.push({ selector, declarations });
    pos = close + 1;
  }
  return rules;
}

function audit_common(rules, kind) {
  const out = [];
  for (const rule of rules) {
    for (const { prop, value } of rule.declarations) {
      if (/!\s*important/i.test(value)) out.push(`${kind}: "${rule.selector}" uses !important on ${prop}`);
      if (/url\s*\(/i.test(value)) out.push(`${kind}: "${rule.selector}" references an external resource in ${prop}`);
    }
  }
  return out;
}

export function audit_light(css) {
  const rules = parse_rules(css);
  const out = audit_common(rules, 'light');
  if (rules.length === 0) out.push('light: stylesheet is empty');
  for (const rule of rules) {
    for (const selector of rule.selector.split(',').map((s) => s.trim())) {
      if (!LIGHT_SELECTOR.test(selector)) {
        out.push(`light: selector "${selector}" must be ${ROOT_SELECTOR} followed only by .${CLASS_PREFIX}* classes`);
      }
    }
    for (const { prop } of rule.declarations) {
      if (!LIGHT_ALLOWED_PROPERTIES.includes(prop)) {
        out.push(`light: "${rule.selector}" sets ${prop}; only ${LIGHT_ALLOWED_PROPERTIES.join(', ')} may touch application elements`);
      }
    }
  }
  return out;
}

export function audit_shadow(css) {
  const rules = parse_rules(css);
  const out = audit_common(rules, 'shadow');
  const host = rules[0];
  if (!host || host.selector !== ':host') {
    out.push('shadow: the first rule must be :host');
  } else {
    const first = host.declarations[0];
    if (!first || first.prop !== 'all' || first.value !== 'initial') {
      out.push('shadow: :host must open with `all: initial`');
    }
    const present = new Set(host.declarations.map((d) => d.prop));
    for (const prop of HOST_REQUIRED_PROPERTIES) {
      if (!present.has(prop)) out.push(`shadow: :host does not declare ${prop}`);
    }
  }
  for (const rule of rules.slice(1)) {
    for (const selector of rule.selector.split(',').map((s) => s.trim())) {
      if (selector === ':host') { out.push('shadow: only one :host rule, and it must come first'); continue; }
      if (!SHADOW_SELECTOR.test(selector)) {
        out.push(`shadow: selector "${selector}" must be built only from .${CLASS_PREFIX}* classes (plus :hover-style pseudo-classes)`);
      }
    }
  }
  return out;
}

/** kind is the stylesheet's basename: 'light' or 'shadow'. */
export function audit_debug_css(kind, css) {
  if (kind === 'light') return audit_light(css);
  if (kind === 'shadow') return audit_shadow(css);
  throw new Error(`unknown debug stylesheet kind "${kind}" - expected light or shadow`);
}

// CLI: compile both sheets with sass and audit them.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { compile } = await import('sass');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  let failed = false;
  for (const kind of ['light', 'shadow']) {
    const css = compile(path.join(dir, `${kind}.scss`), { style: 'expanded' }).css;
    const violations = audit_debug_css(kind, css);
    console.log(`${kind}.scss: ${violations.length ? `${violations.length} violation(s)` : 'ok'}`);
    for (const v of violations) console.log(`  - ${v}`);
    if (violations.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
