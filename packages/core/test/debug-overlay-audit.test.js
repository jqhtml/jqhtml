/**
 * The debug overlay stylesheet convention (src/debug-overlay/CLAUDE.md) is
 * enforced at build time by src/debug-overlay/audit.js. These tests pin the
 * audit itself: the shipped sheets pass, and each rule actually rejects the
 * violation it exists for - so a build that goes green means something.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import sass from 'sass';
import {
  audit_debug_css,
  audit_light,
  audit_shadow,
  parse_rules,
  HOST_REQUIRED_PROPERTIES,
  LIGHT_ALLOWED_PROPERTIES,
} from '../src/debug-overlay/audit.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/debug-overlay');
const compiled = (kind) => sass.compile(path.join(dir, `${kind}.scss`), { style: 'expanded' }).css;

const GOOD_HOST = `:host { all: initial; ${HOST_REQUIRED_PROPERTIES.map((p) => `${p}: inherit`).join('; ')}; }`;

describe('shipped stylesheets', () => {
  it('light.scss compiles and passes the audit', () => {
    expect(audit_debug_css('light', compiled('light'))).toEqual([]);
  });

  it('shadow.scss compiles and passes the audit', () => {
    expect(audit_debug_css('shadow', compiled('shadow'))).toEqual([]);
  });

  it('every class in both sheets carries the jqhtml-debug- prefix', () => {
    for (const kind of ['light', 'shadow']) {
      const classes = compiled(kind).match(/\.[A-Za-z_][\w-]*/g) || [];
      for (const cls of classes) expect(cls).toMatch(/^\.jqhtml-debug-/);
    }
  });

  it('rejects an unknown sheet kind', () => {
    expect(() => audit_debug_css('other', '')).toThrow(/unknown debug stylesheet kind/);
  });
});

describe('parse_rules', () => {
  it('parses flat rules and strips comments', () => {
    const rules = parse_rules('/* c */ .a { color: red; margin: 0 }\n.b{}');
    expect(rules).toEqual([
      { selector: '.a', declarations: [{ prop: 'color', value: 'red' }, { prop: 'margin', value: '0' }] },
      { selector: '.b', declarations: [] },
    ]);
  });

  it('rejects at-rules and nesting', () => {
    expect(() => parse_rules('@media (x) { .a { color: red } }')).toThrow(/at-rules/);
    expect(() => parse_rules('.a { .b { color: red } }')).toThrow(/nested/);
  });
});

describe('light rules (application elements)', () => {
  const ok = 'html[data-jqhtml-debug] .jqhtml-debug-hit { outline: 2px solid red; outline-offset: -2px; }';

  it('accepts the canonical rule', () => {
    expect(audit_light(ok)).toEqual([]);
  });

  it('rejects a selector without the html[data-jqhtml-debug] gate', () => {
    expect(audit_light('.jqhtml-debug-hit { outline: 1px solid red; }')).toEqual([
      expect.stringMatching(/must be html\[data-jqhtml-debug\]/),
    ]);
  });

  it('rejects an unprefixed class, an element selector, and a bare descendant', () => {
    expect(audit_light('html[data-jqhtml-debug] .hit { outline: 0; }')).toHaveLength(1);
    expect(audit_light('html[data-jqhtml-debug] div.jqhtml-debug-hit { outline: 0; }')).toHaveLength(1);
    expect(audit_light('html[data-jqhtml-debug] .jqhtml-debug-hit * { outline: 0; }')).toHaveLength(1);
  });

  it('rejects any property that is not an outline property', () => {
    for (const prop of ['margin', 'border', 'position', 'display', 'box-shadow', 'color']) {
      expect(audit_light(`html[data-jqhtml-debug] .jqhtml-debug-hit { ${prop}: 0; }`)).toEqual([
        expect.stringMatching(new RegExp(`sets ${prop};`)),
      ]);
    }
    for (const prop of LIGHT_ALLOWED_PROPERTIES) {
      expect(audit_light(`html[data-jqhtml-debug] .jqhtml-debug-hit { ${prop}: 0; }`)).toEqual([]);
    }
  });

  it('rejects !important and url()', () => {
    expect(audit_light('html[data-jqhtml-debug] .jqhtml-debug-hit { outline: 0 !important; }')).toHaveLength(1);
    expect(audit_light('html[data-jqhtml-debug] .jqhtml-debug-hit { outline-color: url(x); }')).toHaveLength(1);
  });

  it('rejects an empty sheet', () => {
    expect(audit_light('')).toEqual(['light: stylesheet is empty']);
  });
});

describe('shadow rules (overlay UI)', () => {
  it('accepts a complete :host followed by prefixed class rules', () => {
    expect(audit_shadow(`${GOOD_HOST} .jqhtml-debug-modal { display: block; } .jqhtml-debug-a > .jqhtml-debug-b:hover::before { color: red; }`)).toEqual([]);
  });

  it('requires :host to be first and to open with all: initial', () => {
    expect(audit_shadow('.jqhtml-debug-a { color: red; }')).toContain('shadow: the first rule must be :host');
    const no_all = GOOD_HOST.replace('all: initial; ', '');
    expect(audit_shadow(no_all)).toContain('shadow: :host must open with `all: initial`');
    const late_all = GOOD_HOST.replace('all: initial; display: inherit', 'display: inherit; all: initial');
    expect(audit_shadow(late_all)).toContain('shadow: :host must open with `all: initial`');
  });

  it('requires every property in HOST_REQUIRED_PROPERTIES on :host', () => {
    for (const prop of HOST_REQUIRED_PROPERTIES) {
      const css = GOOD_HOST.replace(`${prop}: inherit; `, '').replace(`; ${prop}: inherit`, '');
      expect(audit_shadow(css)).toEqual([`shadow: :host does not declare ${prop}`]);
    }
  });

  it('rejects selectors that are not built from prefixed classes', () => {
    for (const bad of ['div', '.modal', '#x', '.jqhtml-debug-a div', '.jqhtml-debug-a[hidden]', '.jqhtml-debug-a .b', '*']) {
      expect(audit_shadow(`${GOOD_HOST} ${bad} { color: red; }`)).toEqual([
        expect.stringMatching(/must be built only from \.jqhtml-debug-\* classes/),
      ]);
    }
  });

  it('rejects a second :host rule, !important and url()', () => {
    expect(audit_shadow(`${GOOD_HOST} :host { color: red; }`)).toEqual([expect.stringMatching(/only one :host rule/)]);
    expect(audit_shadow(`${GOOD_HOST} .jqhtml-debug-a { color: red !important; }`)).toHaveLength(1);
    expect(audit_shadow(`${GOOD_HOST} .jqhtml-debug-a { background: url(x.png); }`)).toHaveLength(1);
  });
});
