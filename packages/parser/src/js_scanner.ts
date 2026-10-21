// JQHTML JavaScript scanner - the one place the compiler skips over JavaScript.
//
// Every caller that must find the end of a JS region (the %> closing a <% %> /
// <%= %> block, the ) closing a $attr=(...) value or an _output.p(...) call, the
// } closing a <{expression}> tag, the ; ending a generated statement) or that must
// strip comments out of one goes through scan_js(), so they all agree on what is
// code and what is a literal or comment:
//
// - strings ('..', "..") with backslash escapes
// - template literals with ${ } interpolations, nested to any depth (an interpolation
//   is code, so it may hold strings, templates, comments and regexes of its own)
// - line comments (//) and block comments (/* */)
// - regex literals, including [...] classes and escapes. A '/' starts a regex when
//   the previous significant token is an operator or punctuator, a keyword such as
//   return or typeof, or nothing at all; after an identifier, number, ')' , ']' or a
//   literal it is division. A '/' that has no closing '/' on its line is division.
//
// Template-delimiter mode (template_delimiter: true) scans the body of a <% %> or
// <%= %> block: a top-level %> ends the region. A line comment always runs to the
// end of its line, so a %> inside one does not close the block ("<% a(); // b %>"
// is still open after that line). Strings, templates, regexes and block comments
// also hide %>.

export interface JsScanOptions {
  /** Stop at a top-level %> (see header). */
  template_delimiter?: boolean;
  /** Called for each line comment: [start of '//', end) - end excludes the newline. */
  on_line_comment?: (start: number, end: number) => void;
  /**
   * Called for each top-level code character (not inside a literal or comment,
   * whitespace included). Return true to stop the scan at that index.
   */
  on_code?: (index: number, ch: string) => boolean | void;
  /**
   * Called for each raw newline inside a string or template literal (at any
   * nesting depth). `continuation` is true when an escaping backslash precedes it
   * (a line continuation, which contributes nothing to the literal's value).
   */
  on_literal_newline?: (index: number, continuation: boolean) => void;
}

// A '/' after one of these words starts a regex, not a division
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await'
]);

function is_ident_char(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
         (ch >= '0' && ch <= '9') || ch === '_' || ch === '$';
}

function is_space(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

/**
 * Scan JavaScript in `text` from `start`.
 *
 * Returns the index where the scan stopped: the '%' of a top-level %> in
 * template-delimiter mode, or the index on_code returned true for. Returns -1 when
 * the text ran out first (including inside an unterminated string, template or
 * block comment).
 */
export function scan_js(text: string, start: number, options: JsScanOptions = {}): number {
  const delimiter = options.template_delimiter === true;
  const result = scan_code(text, start, delimiter, false, options);
  return result.stopped ? result.index : -1;
}

interface CodeResult {
  index: number;     // stop index, or index just past the closing } of an interpolation
  stopped: boolean;  // stopped by %> / on_code, or the interpolation's } was found
}

/**
 * Scan code. At top level (interpolation=false) it stops at %> / on_code. Inside a
 * template interpolation it returns just past the } that closes it, and neither %>
 * nor on_code apply (that code is part of a literal).
 */
function scan_code(
  text: string,
  i: number,
  delimiter: boolean,
  interpolation: boolean,
  options: JsScanOptions
): CodeResult {
  const top = !interpolation;
  let brace_depth = 0;
  // Previous significant token, for regex detection
  let prev: 'start' | 'punct' | 'value' | 'word' = 'start';
  let word = '';
  let in_word = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (top && delimiter && ch === '%' && next === '>') {
      return { index: i, stopped: true };
    }

    // Comments
    if (ch === '/' && next === '/') {
      const end = line_comment_end(text, i);
      if (options.on_line_comment) options.on_line_comment(i, end);
      i = end;
      in_word = false;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) return { index: text.length, stopped: false };
      i = close + 2;
      in_word = false;
      continue;
    }

    // Literals
    if (ch === '"' || ch === "'") {
      const end = skip_string(text, i, options);
      if (end === -1) return { index: text.length, stopped: false };
      i = end;
      prev = 'value';
      in_word = false;
      continue;
    }
    if (ch === '`') {
      const end = skip_template(text, i, options);
      if (end === -1) return { index: text.length, stopped: false };
      i = end;
      prev = 'value';
      in_word = false;
      continue;
    }
    if (ch === '/' && regex_allowed(prev, word)) {
      const end = skip_regex(text, i);
      if (end !== -1) {
        i = end;
        prev = 'value';
        in_word = false;
        continue;
      }
      // No closing '/' on this line: it is a division after all
    }

    // Plain code character
    if (interpolation) {
      if (ch === '{') {
        brace_depth++;
      } else if (ch === '}') {
        if (brace_depth === 0) return { index: i + 1, stopped: true };
        brace_depth--;
      }
    } else if (options.on_code && options.on_code(i, ch)) {
      return { index: i, stopped: true };
    }

    if (is_ident_char(ch)) {
      word = in_word ? word + ch : ch;
      in_word = true;
      prev = 'word';
    } else if (is_space(ch)) {
      in_word = false;
    } else {
      in_word = false;
      prev = (ch === ')' || ch === ']') ? 'value' : 'punct';
    }
    i++;
  }

  return { index: text.length, stopped: false };
}

function regex_allowed(prev: 'start' | 'punct' | 'value' | 'word', word: string): boolean {
  if (prev === 'start' || prev === 'punct') return true;
  if (prev === 'word') return REGEX_KEYWORDS.has(word);
  return false;
}

/** End (exclusive) of the line comment starting at i: its newline, or the end of text. */
function line_comment_end(text: string, i: number): number {
  const end = text.indexOf('\n', i + 2);
  return end === -1 ? text.length : end;
}

/** Index just past the closing quote of the string at i, or -1. */
function skip_string(text: string, i: number, options: JsScanOptions): number {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\') { report_escaped_newline(text, j, options); j += 2; continue; }
    if (ch === quote) return j + 1;
    if (ch === '\n' && options.on_literal_newline) options.on_literal_newline(j, false);
    j++;
  }
  return -1;
}

/** A backslash at j escaping a newline is a line continuation: report it. */
function report_escaped_newline(text: string, j: number, options: JsScanOptions): void {
  if (text[j + 1] === '\n' && options.on_literal_newline) options.on_literal_newline(j + 1, true);
}

/** Index just past the closing backtick of the template literal at i, or -1. */
function skip_template(text: string, i: number, options: JsScanOptions): number {
  let j = i + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\') { report_escaped_newline(text, j, options); j += 2; continue; }
    if (ch === '`') return j + 1;
    if (ch === '\n' && options.on_literal_newline) options.on_literal_newline(j, false);
    if (ch === '$' && text[j + 1] === '{') {
      const inner = scan_code(text, j + 2, false, true, options);
      if (!inner.stopped) return -1;
      j = inner.index;
      continue;
    }
    j++;
  }
  return -1;
}

/** Index just past the regex literal's closing '/' (flags not included), or -1 if none on this line. */
function skip_regex(text: string, i: number): number {
  let j = i + 1;
  let in_class = false;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\n') return -1;
    if (ch === '\\') { j += 2; continue; }
    if (in_class) {
      if (ch === ']') in_class = false;
    } else if (ch === '[') {
      in_class = true;
    } else if (ch === '/') {
      return j + 1;
    }
    j++;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Helpers for the call sites

/** Index of the %> closing the <% %> / <%= %> body that starts at `start`, or -1. */
export function find_template_close(text: string, start: number): number {
  return scan_js(text, start, { template_delimiter: true });
}

/** A %> hidden inside a line comment of a <% %> / <%= %> body. */
export interface HiddenClose {
  /** Index of the comment's '//'. */
  comment: number;
  /** Index of the first %> inside the comment. */
  close: number;
  /**
   * True when the comment looks like it was meant to close the tag: it follows code
   * on its line or is on the tag's opening line, or the %> ends the line.
   * A comment on a line of its own that mentions %> mid-sentence is not suspicious.
   */
  suspicious: boolean;
}

/**
 * The line comments in the <% %> / <%= %> body starting at `start` that contain %>,
 * up to the body's closing %> (or the end of text when it has none). A line comment
 * runs to the end of its line, so each of these %> leaves the tag open.
 */
export function find_hidden_closes(text: string, start: number): HiddenClose[] {
  const found: HiddenClose[] = [];
  scan_js(text, start, {
    template_delimiter: true,
    on_line_comment: (s, e) => {
      const close = text.indexOf('%>', s + 2);
      if (close === -1 || close >= e) return;
      const own_line = starts_own_line(text, s, start);
      const ends_line = text.slice(close + 2, e).trim() === '';
      found.push({ comment: s, close, suspicious: !own_line || ends_line });
    }
  });
  return found;
}

/** True when only spaces/tabs precede i on its line, and that line is not the region's first. */
function starts_own_line(text: string, i: number, region_start: number): boolean {
  let j = i - 1;
  while (j >= region_start && (text[j] === ' ' || text[j] === '\t')) j--;
  return j >= region_start && text[j] === '\n';
}

/**
 * Index of the bracket closing the one at open_index ('(', '[' or '{'), counting
 * all three kinds, or -1.
 */
export function find_matching_bracket(text: string, open_index: number): number {
  let depth = 0;
  return scan_js(text, open_index, {
    on_code: (_i, ch) => {
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
        return depth === 0;
      }
      return false;
    }
  });
}

/** One past the ';' ending the statement that starts at `start` (outside brackets), or text.length. */
export function find_statement_end(text: string, start: number): number {
  let depth = 0;
  const stop = scan_js(text, start, {
    on_code: (_i, ch) => {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ';' && depth <= 0) return true;
      return false;
    }
  });
  return stop === -1 ? text.length : stop + 1;
}

/**
 * Replace every line comment in a JS region with spaces (newlines kept, so length
 * and line structure are unchanged). `template_delimiter` as for scan_js; the scan
 * stops at a top-level %>, and text from there on is returned untouched.
 */
export function blank_line_comments(text: string, template_delimiter: boolean = false): string {
  const ranges: Array<[number, number]> = [];
  scan_js(text, 0, {
    template_delimiter,
    on_line_comment: (s, e) => { ranges.push([s, e]); }
  });
  if (ranges.length === 0) return text;
  let out = '';
  let last = 0;
  for (const [s, e] of ranges) {
    out += text.slice(last, s) + ' '.repeat(e - s);
    last = e;
  }
  return out + text.slice(last);
}

/**
 * The same JavaScript on one line, with the same value. Codegen emits an expression
 * on the generated line of the source line it starts on, so a multi-line <%= %> is
 * joined: a newline in code becomes a space, a newline inside a string or template
 * literal becomes the two-character escape backslash-n, and a line continuation
 * (backslash + newline) is dropped, as it contributes nothing to the value.
 * String.raw sees the escape rather than the newline; the cooked value is identical.
 */
export function join_lines(code: string): string {
  return join_lines_mapped(code).code;
}

export interface JoinedCode {
  /** The code on one line (join_lines). */
  code: string;
  /**
   * For each source line after the first, the index in `code` where that line's
   * text begins, or -1 when the newline before it is not top-level code (it is
   * inside a string, template literal, interpolation or block comment). Within one
   * source line the joined text is character-for-character the original, so a
   * position in it maps back to the source by its offset from the line's start.
   */
  line_starts: number[];
}

/** join_lines, also reporting where each joined source line begins (for sourcemaps). */
export function join_lines_mapped(code: string): JoinedCode {
  const line_starts: number[] = [];
  if (code.indexOf('\n') === -1) return { code, line_starts };
  const literal = new Map<number, boolean>();
  const code_newlines = new Set<number>();
  scan_js(code, 0, {
    on_literal_newline: (i, continuation) => { literal.set(i, continuation); },
    on_code: (i, ch) => { if (ch === '\n') code_newlines.add(i); }
  });
  let out = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch !== '\n') {
      out += ch;
      continue;
    }
    if (!literal.has(i)) {
      out += ' ';
    } else if (literal.get(i)) {
      out = out.slice(0, -1); // drop the continuation's backslash
    } else {
      out += '\\n';
    }
    line_starts.push(code_newlines.has(i) ? out.length : -1);
  }
  return { code: out, line_starts };
}

/**
 * For each line of `text`, whether it starts in code - false when the newline before
 * it is inside a string, template literal or block comment, so the line is part of
 * that literal or comment. Line 0 always starts in code.
 */
export function code_line_starts(text: string, template_delimiter: boolean = false): boolean[] {
  const code_newlines = new Set<number>();
  scan_js(text, 0, {
    template_delimiter,
    on_code: (i, ch) => { if (ch === '\n') code_newlines.add(i); }
  });
  const starts = [true];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(code_newlines.has(i));
  }
  return starts;
}

/**
 * Remove the statement-ending semicolons at the end of an expression
 * (`x;` and `x;;` -> `x`; a comment after the semicolon is kept), so the expression
 * can be wrapped in parentheses.
 * Only top-level code semicolons count - never one inside a literal or comment.
 */
export function strip_trailing_semicolons(code: string): string {
  for (;;) {
    let last = -1;
    scan_js(code, 0, {
      on_code: (i, ch) => { if (!is_space(ch)) last = i; }
    });
    if (last === -1 || code[last] !== ';') return code;
    code = code.slice(0, last) + code.slice(last + 1);
  }
}

/** True when `code` has a comma outside every bracket, literal and comment - a comma expression. */
export function has_top_level_comma(code: string): boolean {
  let depth = 0;
  return scan_js(code, 0, {
    on_code: (_i, ch) => {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ',' && depth === 0) return true;
      return false;
    }
  }) !== -1;
}
