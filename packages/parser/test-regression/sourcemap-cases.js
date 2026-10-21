/**
 * Sourcemap position cases, shared by the sourcemap suite (validate-sourcemaps.js) and
 * the parser unit tests (test/sourcemap-positions.test.js).
 *
 * Each probe names a snippet of the GENERATED code and the snippet of the TEMPLATE it
 * must map back to. The expected position is found by searching the template text, not
 * by asking the compiler, so the oracle is independent of codegen: the map must take
 * the first character of `gen` to the exact line AND column of the first character of
 * `src` (`src` defaults to `gen`). `line` pins which template line `src` is searched on
 * when the text occurs more than once; `name` asserts the segment's `names` entry (null:
 * none); `render_line` is the render function line the code must sit on when it is not
 * the template line (the later lines of joined multi-line code).
 */

import { SourceMapConsumer } from 'source-map';
import { compileTemplate } from '../dist/compiler.js';

export const SOURCEMAP_CASES = [
  {
    name: 'several <%= %> on one line',
    source: [
      '<Define:Sm_Same_Line>',
      '  <p><%= first_value %> and <%= second_value %> and <%= third_value %></p>',
      '</Define:Sm_Same_Line>'
    ],
    probes: [
      { gen: 'first_value', name: 'first_value' },
      { gen: 'second_value', name: 'second_value' },
      { gen: 'third_value', name: 'third_value' },
      { gen: '{tag: ["p"', src: '<p>' }
    ]
  },
  {
    name: 'expression in an attribute value',
    source: [
      '<Define:Sm_Attribute>',
      '  <a title="Open <%= attr_value %> now" href="#">x</a>',
      '  <Child_Comp $data=this.attr_unquoted $flag=(attr_paren ? 1 : 2) />',
      '</Define:Sm_Attribute>'
    ],
    probes: [
      { gen: 'attr_value', name: null },
      { gen: 'this.attr_unquoted' },
      { gen: 'attr_paren' },
      { gen: '{comp: ["Child_Comp"', src: '<Child_Comp' }
    ]
  },
  {
    name: 'a throw inside a slot body',
    source: [
      '<Define:Sm_Slot>',
      '  <Card_Comp>',
      '    <Slot:body>',
      '      <b>before</b>',
      '      <% throw_in_slot(); %>',
      '    </Slot:body>',
      '  </Card_Comp>',
      '  <%= after_slot %>',
      '</Define:Sm_Slot>'
    ],
    probes: [
      { gen: 'throw_in_slot' },
      { gen: 'body: function', src: '<Slot:body>' },
      { gen: 'after_slot', name: 'after_slot' }
    ]
  },
  {
    name: 'code after a multi-line <% %>',
    source: [
      '<Define:Sm_Code_Block>',
      '  <% let first_stmt = 1;',
      '       let second_stmt = 2;',
      '       let third_stmt = 3; %><b><%= after_code %></b>',
      '  <%= next_line %>',
      '</Define:Sm_Code_Block>'
    ],
    probes: [
      { gen: 'let first_stmt' },
      { gen: 'let second_stmt' },
      { gen: 'let third_stmt' },
      { gen: '{tag: ["b"', src: '<b>' },
      { gen: 'after_code', name: 'after_code' },
      { gen: 'next_line', name: 'next_line' }
    ]
  },
  {
    name: 'a multi-line HTML comment',
    source: [
      '<Define:Sm_Html_Comment>',
      '  <!-- one',
      '       two',
      '       three -->',
      '  <%= after_comment %>',
      '</Define:Sm_Html_Comment>'
    ],
    probes: [
      { gen: '"<!-- one', src: '<!-- one' },
      { gen: 'after_comment', name: 'after_comment' }
    ]
  },
  {
    name: 'a multi-line <%br= %>',
    source: [
      '<Define:Sm_Br>',
      '  <div><%br= br_first +',
      '        br_second +',
      '        br_third %></div>',
      '  <%= after_br %>',
      '</Define:Sm_Br>'
    ],
    probes: [
      { gen: 'br_first', name: null },
      { gen: 'br_second', render_line: 2 },
      { gen: 'br_third', render_line: 2 },
      { gen: 'after_br', name: 'after_br' }
    ]
  },
  {
    name: 'a multi-line dynamic tag',
    source: [
      '<Define:Sm_Dynamic>',
      '  <{dyn_first ||',
      '     dyn_second} $x=1 />',
      '  <%= after_dynamic %>',
      '</Define:Sm_Dynamic>'
    ],
    probes: [
      { gen: 'dyn_first' },
      { gen: 'dyn_second', render_line: 2 },
      { gen: 'after_dynamic', name: 'after_dynamic' }
    ]
  },
  {
    name: 'multi-line attribute expression and condition',
    source: [
      '<Define:Sm_Attr_Multi>',
      '  <Child_Comp $v=(multi_a ||',
      '     multi_b) <% if (cond_a &&',
      '     cond_b) { %>data-x="1"<% } %> />',
      '  <%= after_attrs %>',
      '</Define:Sm_Attr_Multi>'
    ],
    probes: [
      { gen: 'multi_a' },
      { gen: 'multi_b', render_line: 2 },
      { gen: '(cond_a', src: '<% if (cond_a', render_line: 2 },
      { gen: 'after_attrs', name: 'after_attrs' }
    ]
  },
  {
    name: 'nested component content',
    source: [
      '<Define:Sm_Nested>',
      '  <Outer_Comp>',
      '    <Inner_Comp $v=1>',
      '      <span><%= nested_value %></span>',
      '      <% nested_code(); %>',
      '    </Inner_Comp>',
      '    <%= outer_value %>',
      '  </Outer_Comp>',
      '  <%= after_nested %>',
      '</Define:Sm_Nested>'
    ],
    probes: [
      { gen: '{comp: ["Inner_Comp"', src: '<Inner_Comp' },
      { gen: '{tag: ["span"', src: '<span>' },
      { gen: 'nested_value', name: 'nested_value' },
      { gen: 'nested_code' },
      { gen: 'outer_value', name: 'outer_value' },
      { gen: 'after_nested', name: 'after_nested' }
    ]
  }
];

/** 1-based line and 0-based column of the first occurrence of `text` (optionally on `line`). */
function position_of(lines, text, line) {
  for (let i = 0; i < lines.length; i++) {
    if (line && i + 1 !== line) continue;
    const column = lines[i].indexOf(text);
    if (column !== -1) return { line: i + 1, column };
  }
  return null;
}

/**
 * Compile a case and resolve every probe through the inline sourcemap. Returns one
 * result per probe: { probe, expected, actual, name_ok, generated_line, generated_line_ok }.
 */
export async function check_case(c, format = 'iife') {
  const source = c.source.join('\n') + '\n';
  const source_lines = source.split('\n');
  const filename = `${c.source[0].match(/<Define:(\w+)/)[1]}.jqhtml`;
  const { code } = compileTemplate(source, filename, { format, sourcemap: true });

  const match = code.match(/\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error(`${c.name}: no inline sourcemap`);
  const map = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  const generated = code.slice(0, match.index).replace(/\n$/, '');
  const generated_lines = generated.split('\n');
  const render_line = generated_lines.findIndex((l) => l.includes('function render(')) + 1;

  const consumer = await new SourceMapConsumer(map);
  try {
    return c.probes.map((probe) => {
      const at = position_of(generated_lines, probe.gen);
      const expected = position_of(source_lines, probe.src || probe.gen, probe.line);
      if (!at) throw new Error(`${c.name}: generated code has no ${JSON.stringify(probe.gen)}`);
      if (!expected) throw new Error(`${c.name}: template has no ${JSON.stringify(probe.src || probe.gen)}`);
      const original = consumer.originalPositionFor({ line: at.line, column: at.column });
      return {
        probe,
        expected: { line: expected.line, column: expected.column },
        actual: { line: original.line, column: original.column },
        // `name` in a probe asserts the segment's names entry (null: none)
        name_ok: !('name' in probe) || original.name === probe.name,
        source: original.source,
        filename,
        // Where the generated code sits: render line N is template line N, so the
        // probe's render line must be its template line - or, for the later lines of
        // code joined onto one line (a multi-line expression or dynamic tag), the line
        // that code starts on (`render_line` in the probe).
        generated_line: at.line - render_line + 1,
        generated_line_ok: at.line - render_line + 1 === (probe.render_line || expected.line)
      };
    });
  } finally {
    consumer.destroy();
  }
}
