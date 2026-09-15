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

/**
 * The render-time check behind <{expression}>: the expression must evaluate
 * to a component name string that a literal tag would accept - no more, no
 * less. A valid name that names nothing renders the ordinary placeholder
 * component, exactly as an undefined literal tag does.
 */
export function dynamic_component_name(value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    const shown = value === '' ? 'an empty string' : typeof value === 'string' ? `'${value}'` : `${value === null ? 'null' : typeof value}`;
    throw new Error(`[JQHTML] Dynamic component tag <{...}> evaluated to ${shown}; expected a non-empty component name string`);
  }
  if (!is_component_name(value)) {
    throw new Error(
      `[JQHTML] Dynamic component tag <{...}> evaluated to '${value}', which is not a valid component name: ` +
      `a component name ${COMPONENT_NAME_RULE}, then letters, digits and underscores`
    );
  }
  return value;
}
