/**
 * Unit tests for escape_html() and escape_html_nl2br().
 *
 * These back the <%= %> and <%br= %> template syntax. Both escape by round-
 * tripping through a detached DOM node (textContent in, innerHTML out) rather
 * than by regex, which is why the setup file installs jsdom globals.
 */

import { escape_html, escape_html_nl2br } from '../dist/index.js';

describe('escape_html', () => {
  it('escapes the HTML-significant characters', () => {
    expect(escape_html('<script>')).toBe('&lt;script&gt;');
    expect(escape_html('a & b')).toBe('a &amp; b');
  });

  it('neutralises an injection attempt', () => {
    expect(escape_html('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('does NOT escape quotes', () => {
    // Intentional and safe: interpolated values reach attributes through
    // jQuery .attr() (instruction-processor.ts), never through HTML string
    // concatenation, so a quote cannot break out of an attribute.
    expect(escape_html('say "hi"')).toBe('say "hi"');
    expect(escape_html("it's")).toBe("it's");
  });

  it('double-escapes when applied twice', () => {
    // Documents that escaping is not idempotent - never escape an already
    // escaped string.
    expect(escape_html(escape_html('<b>'))).toBe('&amp;lt;b&amp;gt;');
  });

  it('leaves plain and non-ASCII text untouched', () => {
    expect(escape_html('')).toBe('');
    expect(escape_html('plain text')).toBe('plain text');
    expect(escape_html('café — ok')).toBe('café — ok');
  });

  it('renders null and undefined as empty string', () => {
    expect(escape_html(null)).toBe('');
    expect(escape_html(undefined)).toBe('');
  });

  it('stringifies numbers', () => {
    expect(escape_html(5)).toBe('5');
  });
});

describe('escape_html_nl2br', () => {
  it('converts newlines to <br /> after escaping', () => {
    expect(escape_html_nl2br('line1\nline2')).toBe('line1<br />line2');
  });

  it('escapes HTML before inserting the breaks', () => {
    // The <br /> it emits is real markup; everything from the user is not.
    expect(escape_html_nl2br('<script>\nx')).toBe('&lt;script&gt;<br />x');
  });

  it('converts every newline in the string', () => {
    expect(escape_html_nl2br('a\nb\nc')).toBe('a<br />b<br />c');
  });

  it('leaves a carriage return in place when converting CRLF', () => {
    // Quirk, asserted so a change here is a deliberate one: only \n is
    // replaced, so CRLF input keeps a stray \r before the <br />.
    expect(escape_html_nl2br('a\r\nb')).toBe('a\r<br />b');
  });

  it('leaves text without newlines unchanged', () => {
    expect(escape_html_nl2br('no breaks')).toBe('no breaks');
  });
});
