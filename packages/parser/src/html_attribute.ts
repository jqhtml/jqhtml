// Character references in literal attribute value text, resolved the way the HTML
// tokenizer resolves them in a quoted attribute value (WHATWG HTML 13.2.5, the
// character reference states with an attribute value as the return state). The
// compiled template then carries the value the browser would give static HTML -
// `title="a &amp; b"` is the string `a & b` on every path: a plain tag, a tag with
// @event or $sid, a component invocation, a $ arg and a Define default. The runtime
// escapes `&` and `"` again when it writes attribute HTML.
//
// Line endings are normalised by the lexer before tokenizing, as the HTML input
// stream does.

import { HTML_NAMED_REFERENCES } from './html_entity_table.js';

// Longest key in the table; a named reference is matched longest-first.
const MAX_NAME_LENGTH = 32;

// Numeric references 0x80-0x9F that the spec remaps (Windows-1252); the five
// unlisted ones (0x81, 0x8D, 0x8F, 0x90, 0x9D) are left as is.
const C1_REPLACEMENTS: Record<number, number> = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
  0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
};

const is_ascii_alphanumeric = (c: string) => /^[A-Za-z0-9]$/.test(c);
const is_digit = (c: string) => c >= '0' && c <= '9';
const is_hex_digit = (c: string) => /^[0-9A-Fa-f]$/.test(c);

function numeric_reference_character(code: number): string {
  if (code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) return '�';
  return String.fromCodePoint(C1_REPLACEMENTS[code] ?? code);
}

/**
 * `text` with its character references resolved as in a quoted HTML attribute
 * value. `text` is literal value text only (no quotes, no <%= %> parts).
 */
export function decode_attribute_text(text: string): string {
  if (text.indexOf('&') === -1 && text.indexOf('\0') === -1) return text;

  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\0') {
      out += '�';
      i++;
      continue;
    }
    if (c !== '&') {
      out += c;
      i++;
      continue;
    }

    const next = text[i + 1] || '';

    if (next === '#') {
      // Numeric: &#123; or &#x7B; - the ';' is optional; no digits leaves it as text.
      let j = i + 2;
      const hex = (text[j] === 'x' || text[j] === 'X') && is_hex_digit(text[j + 1] || '');
      if (hex) j++;
      const digit = hex ? is_hex_digit : is_digit;
      const digits_start = j;
      while (j < text.length && digit(text[j])) j++;
      if (j === digits_start) {
        out += '&';
        i++;
        continue;
      }
      const digits = text.slice(digits_start, j).replace(/^0+(?=.)/, '');
      // Anything over 7 significant hex / 8 decimal digits is past 0x10FFFF.
      const code = digits.length > 8 ? 0x110000 : parseInt(digits, hex ? 16 : 10);
      if (text[j] === ';') j++;
      out += numeric_reference_character(code);
      i = j;
      continue;
    }

    if (is_ascii_alphanumeric(next)) {
      // Named: the longest name in the table that the text starts with.
      let name = '';
      const longest = Math.min(MAX_NAME_LENGTH, text.length - i - 1);
      for (let length = longest; length > 0; length--) {
        const candidate = text.substr(i + 1, length);
        if (HTML_NAMED_REFERENCES[candidate] !== undefined) {
          name = candidate;
          break;
        }
      }
      if (name) {
        const after = text[i + 1 + name.length] || '';
        // Historical attribute rule: a reference without ';' followed by '=' or an
        // alphanumeric is left as written (`?a=1&copy=2` keeps its "&copy").
        if (!name.endsWith(';') && (after === '=' || is_ascii_alphanumeric(after))) {
          out += '&';
          i++;
          continue;
        }
        out += HTML_NAMED_REFERENCES[name];
        i += 1 + name.length;
        continue;
      }
    }

    // Not a character reference: the '&' is literal.
    out += '&';
    i++;
  }
  return out;
}
