/**
 * Value printers: how <%= %> renders an OBJECT.
 *
 * Primitives never come here - the generated template code routes only
 * non-null, non-array objects to print_object(), so a hundred-row list of
 * strings costs exactly what it did before. An object reaching an
 * interpolation is walked through the printer chain in registration order;
 * the first printer to return anything but undefined handles it. A printer
 * returns a string (escaped or not according to the construct, exactly as a
 * string literal at that site) or a component descriptor:
 *
 *   { component: { name: 'Rich_Text_Display', args: { value }, attrs: { class: 'x' } } }
 *
 * which jqhtml mounts as if the template had written the tag - live in the
 * browser, server-rendered under SSR - with no environment awareness on the
 * printer's side. A descriptor carries no content.
 *
 * Attribute position (<div title="<%= v %>">) compiles through a different
 * path and never consults printers.
 */

import { escape_html, escape_html_nl2br } from './escape.js';
import { COMPONENT_NAME_RULE, is_component_name } from './component-name.js';

export type Print_Mode = 'escape' | 'raw' | 'nl2br';

export interface Component_Descriptor {
  component: {
    name: string;
    args?: Record<string, any>;
    attrs?: Record<string, any>;
  };
}

export type Object_Printer = (value: object) => undefined | string | Component_Descriptor;

/** A mounted descriptor, in the instruction form the runtime already understands. */
export type Component_Instruction = { comp: [string, Record<string, any>] };

const printers: Object_Printer[] = [];

/**
 * Register a printer at the end of the chain. Printers run in registration
 * order; return undefined to decline, a string, or a component descriptor.
 */
export function add_object_printer(printer: Object_Printer): void {
  if (typeof printer !== 'function') {
    throw new Error('[JQHTML] add_object_printer() expects a function (value) => undefined | string | descriptor');
  }
  printers.push(printer);
}

/** The registered printers, in order. Read-only view for diagnostics. */
export function get_object_printers(): readonly Object_Printer[] {
  return printers;
}

/**
 * Render an object at an interpolation site. Called by compiled templates for
 * every non-null, non-array object reaching <%= %>, <%!= %> or <%br= %>.
 * Throws when nothing handles the value or a printer returns garbage.
 */
export function print_object(value: object, mode: Print_Mode): string | Component_Instruction {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`[JQHTML] print_object() is the object branch of interpolation; got ${typeof value}`);
  }
  for (let i = 0; i < printers.length; i++) {
    const result = printers[i](value);
    if (result === undefined) continue;
    if (typeof result === 'string') return print_string(result, mode);
    if (is_descriptor(result)) return descriptor_to_instruction(result, i);
    throw new Error(
      `[JQHTML] Object printer #${i + 1} of ${printers.length} returned ${describe(result)}; ` +
      `a printer must return undefined (decline), a string, or a { component: { name, args, attrs } } descriptor`
    );
  }
  throw new Error(
    `[JQHTML] Cannot interpolate a ${constructor_name(value)} object: ` +
    (printers.length
      ? `none of the ${printers.length} registered object printer(s) handled it. `
      : `no object printers are registered. `) +
    `Register one with jqhtml.add_object_printer(fn), or interpolate a primitive.`
  );
}

function print_string(text: string, mode: Print_Mode): string {
  if (mode === 'escape') return escape_html(text);
  if (mode === 'nl2br') return escape_html_nl2br(text);
  return text;
}

function is_descriptor(value: any): value is Component_Descriptor {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    !!value.component && typeof value.component === 'object' && !Array.isArray(value.component);
}

function descriptor_to_instruction(descriptor: Component_Descriptor, index: number): Component_Instruction {
  const { name, args, attrs } = descriptor.component;
  const where = `Object printer #${index + 1}`;
  if (typeof name !== 'string' || !is_component_name(name)) {
    throw new Error(
      `[JQHTML] ${where} returned a descriptor whose component name ${describe(name)} is invalid: ` +
      `a component name ${COMPONENT_NAME_RULE}, then letters, digits and underscores`
    );
  }
  const props: Record<string, any> = {};
  if (attrs !== undefined) {
    if (!is_plain_object(attrs)) throw new Error(`[JQHTML] ${where}: descriptor attrs must be a plain object`);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('$')) throw new Error(`[JQHTML] ${where}: descriptor attrs key '${key}' - component arguments go in args, without the $ sigil`);
      props[key] = value;
    }
  }
  if (args !== undefined) {
    if (!is_plain_object(args)) throw new Error(`[JQHTML] ${where}: descriptor args must be a plain object`);
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith('$')) throw new Error(`[JQHTML] ${where}: descriptor args key '${key}' - the $ sigil is template syntax, not part of the argument name`);
      props[`$${key}`] = value;
    }
  }
  return { comp: [name, props] };
}

function is_plain_object(value: any): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function constructor_name(value: object): string {
  const ctor = (value as any).constructor;
  return ctor && ctor.name ? ctor.name : 'Object';
}

function describe(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'object') return Array.isArray(value) ? 'an array' : `a ${constructor_name(value)} object without a valid component property`;
  return `${typeof value} ${String(value)}`;
}
