/**
 * The space after a closing tag is kept.
 *
 * The compiler collapses whitespace the way the browser displays it, and skips a
 * space push that repeats the one just before it. That check was not reset by a
 * closing tag, the end of a component's content or a slot, so `<b> </b> <i>` lost the
 * space before <i>. The browser keeps it: the element can be its own box
 * (inline-block, a flex item), and under white-space: pre both spaces show.
 */

import { compileTemplate } from '../dist/index.js';
import assert from 'assert';
import vm from 'vm';
import { Markup } from './markup-stub.js';

// Compile, run the render function and flatten its instructions to readable text:
// tags as <b> / </b>, components as <Y>[content]</Y>.
function rendered(source) {
  const { code } = compileTemplate(source, 'test.jqhtml', { format: 'cjs', sourcemap: false, version: '9.9.9' });
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(code, sandbox);
  const template = sandbox.module.exports;
  const stub = { args: {}, data: {}, _cid: 'CID' };
  const jqhtml = { Markup, escape_html: (s) => String(s), escape_html_nl2br: (s) => String(s), print_object: () => '' };
  const flat = (markup) => markup.instructions.map((i) => {
    if (typeof i === 'string') return i;
    if (i.tag) return `<${i.tag[0]}>`;
    if (i.comp) {
      const content = typeof i.comp[2] === 'function' ? flat(i.comp[2].call(stub)) : '';
      return `<${i.comp[0]}>[${content}]</${i.comp[0]}>`;
    }
    return '?';
  }).join('');
  return flat(template.render.call(stub, stub.data, {}, null, jqhtml));
}

describe('a space after a closing tag is kept', () => {
  it('after an element whose content ends in a space', () => {
    assert.strictEqual(rendered('<Define:T><p><b> </b> <i>x</i></p></Define:T>'), '<p><b> </b> <i>x</i></p>');
  });

  it('after a component whose content ends in a space', () => {
    assert.strictEqual(rendered('<Define:T><p><Y> </Y> <i>x</i></p></Define:T>'), '<p><Y>[ ]</Y> <i>x</i></p>');
  });

  it('after nested elements across lines', () => {
    assert.strictEqual(rendered('<Define:T>\n<p><span><b>a</b>\n</span>\n<i>x</i></p>\n</Define:T>'),
      ' <p><span><b>a</b> </span> <i>x</i></p> ');
  });

  it('after a slot whose content ends in a space', () => {
    // Slot b is its own buffer: its leading space is not a repeat of slot a's last one
    const { code } = compileTemplate('<Define:T>\n<Y><Slot:a><b>x</b> </Slot:a> <Slot:b> <i>y</i></Slot:b></Y>\n</Define:T>',
      'test.jqhtml', { format: 'cjs', sourcemap: false, version: '9.9.9' });
    assert.ok(/b: function\(b\) \{ const _output = new jqhtml\.Markup\(this\); _output\.p\(" "/.test(code), code);
  });

  it('a run of whitespace in one place is still one space', () => {
    assert.strictEqual(rendered('<Define:T><p>a  \n\t <b>c</b></p></Define:T>'), '<p>a <b>c</b></p>');
  });
});
