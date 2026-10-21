/**
 * The one way the compiler turns template-author text into JavaScript source.
 *
 * Everything a template author writes that the compiler emits as DATA - tag names,
 * attribute names and quoted values, component and parent names, text content,
 * $sid literal parts, HTML comments - goes through one of these two functions, so
 * no character the author types (a quote, a backslash, a newline, U+2028/2029) can
 * end the literal early and turn the rest of the value into executable code.
 *
 * Both are built on JSON.stringify, which escapes every character a JS string
 * literal cannot hold raw. U+2028/2029 are additionally escaped: they are legal in
 * string literals only since ES2019, and older engines and tooling treat them as
 * line terminators.
 */

function escape_line_separators(literal: string): string {
  return literal.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** A double-quoted JavaScript string literal whose runtime value is exactly `value`. */
export function js_string(value: string): string {
  return escape_line_separators(JSON.stringify(String(value)));
}

/**
 * A single-quoted JavaScript string literal whose runtime value is exactly `value`.
 * Used where the compiler's output has always been single-quoted (component
 * metadata), so benign values compile to byte-identical output.
 *
 * In JSON.stringify's output every `"` is preceded by its own escaping backslash,
 * so un-escaping `\"` cannot touch any other escape sequence.
 */
export function js_string_single(value: string): string {
  const body = JSON.stringify(String(value))
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'");
  return escape_line_separators(`'${body}'`);
}
