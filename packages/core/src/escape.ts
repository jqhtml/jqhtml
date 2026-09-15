/**
 * HTML escaping for interpolated text.
 *
 * Output matches what `div.textContent = s; div.innerHTML` produced before -
 * a text node serialises only &, < and > as entities, and null/undefined as
 * "" - but without touching the DOM. Interpolation runs for every value of
 * every render, and a createElement per value was the most expensive thing a
 * text-heavy template did.
 */

const NEEDS_ESCAPE = /[&<>]/;
const ESCAPE_ALL = /[&<>]/g;
const ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const to_entity = (c: string) => ENTITY[c];

export function escape_html(value: any): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return NEEDS_ESCAPE.test(s) ? s.replace(ESCAPE_ALL, to_entity) : s;
}

/** Escaped, then newlines become <br /> - the <%br= %> construct. */
export function escape_html_nl2br(value: any): string {
  return escape_html(value).replace(/\n/g, '<br />');
}
