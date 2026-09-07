/**
 * The one rule for "is this name a component?"
 *
 * An optional SINGLE leading underscore, then a capital letter, then letters,
 * digits and underscores. The underscore prefix is a namespace reserved for
 * framework-provided components (`_Root_Layout`) so they cannot collide with
 * application components. Two or more leading underscores are not a component
 * name; a lower-case first letter after the optional underscore is an HTML tag.
 */
export const COMPONENT_NAME_PATTERN = /^_?[A-Z][A-Za-z0-9_]*$/;

export const COMPONENT_NAME_RULE =
  'must start with a capital letter, optionally preceded by a single underscore';

export function is_component_name(name: string): boolean {
  return COMPONENT_NAME_PATTERN.test(name);
}
