/**
 * Merging two inline `style` strings, declaration by declaration.
 *
 * The split follows the CSS Syntax Level 3 tokenizer far enough to find the
 * declaration boundaries a browser finds:
 * - a `;` ends a declaration only at the top level - not inside a "..." or '...'
 *   string, a comment, or a (...), [...] or {...} block, so `url(a;b)`,
 *   `url("data:image/png;base64,...")` and `var(--x, url(a;b))` stay whole;
 * - a declaration is split at its FIRST top-level `:`, so a value such as
 *   `url(http://x/y.png)` keeps every later colon;
 * - a backslash escapes the next code point everywhere (`\;`, `\"`), and inside a
 *   string a backslash before a newline is a line continuation; an unescaped
 *   newline ends a string (the tokenizer's bad-string), as it does in a browser;
 * - comments are dropped from property names; values are kept verbatim.
 *
 * This works on the attribute's value - the text after HTML character references
 * are resolved - so it is the CSS layer only.
 *
 * Property names compare ASCII case-insensitively (`COLOR` overrides `color`);
 * custom properties (`--name`) compare case-sensitively, as CSS defines them. A
 * declaration with no name or no colon is dropped, as a browser drops it; an
 * empty value is dropped too, except for a custom property, where it is valid.
 * The value, including any `!important`, is carried as written.
 */

interface Style_Declaration {
  name: string;
  value: string;
}

const is_newline = (c: string) => c === '\n' || c === '\r' || c === '\f';

/** Splits `text` at the top-level occurrences of `stop` (';' or ':'). */
function split_top_level(text: string, stop: string, limit: number): string[] {
  const parts: string[] = [];
  const closers: string[] = [];
  let quote = '';
  let start = 0;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (quote) {
      if (c === '\\') {
        i += 2;  // escape, or a line continuation before a newline
        continue;
      }
      if (c === quote || is_newline(c)) quote = '';
      i++;
      continue;
    }

    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }

    if (c === '\\') {
      // Outside a string, a backslash before a newline is not an escape.
      i += is_newline(text[i + 1] || '') ? 1 : 2;
      continue;
    }

    if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '(') {
      closers.push(')');
    } else if (c === '[') {
      closers.push(']');
    } else if (c === '{') {
      closers.push('}');
    } else if (closers.length && c === closers[closers.length - 1]) {
      closers.pop();
    } else if (c === stop && !closers.length && parts.length < limit) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    i++;
  }

  parts.push(text.slice(start));
  return parts;
}

const strip_comments = (text: string) => text.replace(/\/\*[\s\S]*?(\*\/|$)/g, '');

/** The declarations of an inline style string, in order. */
export function parse_style_declarations(style: string): Style_Declaration[] {
  const declarations: Style_Declaration[] = [];
  for (const rule of split_top_level(style, ';', Infinity)) {
    const [raw_name, value] = split_top_level(rule, ':', 1);
    if (value === undefined) continue;
    const name = strip_comments(raw_name).trim();
    const trimmed = value.trim();
    if (!name) continue;
    if (!trimmed && !name.startsWith('--')) continue;
    declarations.push({ name, value: trimmed });
  }
  return declarations;
}

const property_key = (name: string) => (name.startsWith('--') ? name : name.toLowerCase());

const is_important = (value: string) => /!\s*important$/i.test(value);

/**
 * `base` merged with `extra`, declaration by declaration, as one style string.
 * Where both set a property, `extra` wins when `extra_wins` is true, otherwise
 * `base` does. The result reads as the browser reads the two strings written
 * loser-then-winner:
 * - the losing side's remaining declarations come first and the winner's after
 *   them, so a losing shorthand (`background`) cannot reset a longhand the winner
 *   set (`background-image`);
 * - a later declaration replaces an earlier one of the same property, except that
 *   a normal declaration does not replace an `!important` one.
 */
export function merge_style(base: string, extra: string, extra_wins: boolean): string {
  const loser = parse_style_declarations(extra_wins ? base : extra);
  const winner = parse_style_declarations(extra_wins ? extra : base);

  const merged = new Map<string, Style_Declaration>();
  for (const declaration of [...loser, ...winner]) {
    const key = property_key(declaration.name);
    const earlier = merged.get(key);
    if (earlier && is_important(earlier.value) && !is_important(declaration.value)) continue;
    merged.delete(key);  // the later declaration takes the later position
    merged.set(key, declaration);
  }
  return Array.from(merged.values())
    .map(({ name, value }) => `${name}: ${value}`)
    .join('; ');
}
