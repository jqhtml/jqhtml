/**
 * JQHTML v2 Component Registry
 * 
 * Global registry for component classes and templates
 * Enables dynamic component instantiation and template association
 */

import { Jqhtml_Component } from './component.js';
import { COMPONENT_NAME_RULE, is_component_name } from './component-name.js';
import { Jqhtml_Markup } from './markup.js';

// Template function signature matching parser output: a markup buffer, or the
// slot functions of a slot-only template
export type TemplateFunction = (
  this: Jqhtml_Component,
  data: Record<string, any>,
  args: Record<string, any>,
  content: any,
  jqhtml?: any
) => Jqhtml_Markup | { _slots: Record<string, (...args: any[]) => Jqhtml_Markup> };

// Template definition - the ONLY way to register templates
export interface TemplateDefinition {
  name: string;  // Component name extracted from Define tag
  tag: string;  // Element tag name (div, span, etc.) - required with default 'div'
  defaultAttributes?: Record<string, any>;  // Default attributes from component definition
  extends?: string;  // Parent template name for template inheritance
  render: TemplateFunction;
}

// Component constructor type
export type ComponentConstructor = new (args: Record<string, any>, element?: any) => Jqhtml_Component;

// Registry storage
const component_classes = new Map<string, ComponentConstructor>();
const component_templates = new Map<string, TemplateDefinition>();

// Track warnings to only show once per component name
const warned_components = new Set<string>();

// extends_conflict() verdicts, keyed by template name: the error message, or null for
// "no conflict". Cleared by every registration, since a new class or template can change
// either side of the comparison.
const extends_verdicts = new Map<string, string | null>();

// get_template_by_class() prototype-walk results, keyed by class. Replaced by every
// registration (see registry_changed()), since a new template or class can change
// which ancestor's template a walk finds. The static `template` property is never
// cached: it is read live on every lookup, before this map is consulted.
let template_by_class_cache = new WeakMap<object, TemplateDefinition>();

/** A class or template was registered: drop every derived lookup. */
function registry_changed(): void {
  extends_verdicts.clear();
  template_by_class_cache = new WeakMap();
}

// Default template for components without registered templates
const DEFAULT_TEMPLATE: TemplateDefinition = {
  name: 'Jqhtml_Component',  // Default name
  tag: 'div',
  render: function(data, args, content) {
    const _output = new Jqhtml_Markup(this);

    // Check for _inner_html first (server-rendered content)
    if (args._inner_html) {
      _output.p(args._inner_html);
      return _output;
    }

    // Just render the content/slots
    if (content && typeof content === 'function') {
      const result = content();  // Call with no args to get default content
      // Handle both markup buffer and string returns
      if (result instanceof Jqhtml_Markup) {
        // Its instructions, rendered in this component (not result.definer)
        for (const instruction of result.instructions) {
          _output.p(instruction);
        }
      } else if (typeof result === 'string') {
        // It's a plain string
        _output.p(result);
      }
    }
    return _output;
  }
};

/**
 * Register a component class with optional template
 */
export function register_component(
  name: string, 
  component_class: ComponentConstructor,
  template?: TemplateDefinition
): void;
export function register_component(component_class: ComponentConstructor): void;
export function register_component(
  nameOrClass: string | ComponentConstructor,
  component_class?: ComponentConstructor,
  template?: TemplateDefinition
): void {
  // Handle overloaded signatures
  if (typeof nameOrClass === 'string') {
    // Called with (name, class, template?)
    const name = nameOrClass;
    if (!component_class) {
      throw new Error('Component class is required when registering by name');
    }

    // Validate component name against the shared rule
    if (!is_component_name(name)) {
      throw new Error(
        `Component name '${name}' ${COMPONENT_NAME_RULE}. Convention is First_Letter_With_Underscores.`
      );
    }

    component_classes.set(name, component_class);
    registry_changed();
    
    // If template provided, register it
    if (template) {
      // Validate template name matches component name
      if (template.name !== name) {
        throw new Error(`Template name '${template.name}' must match component name '${name}'`);
      }
      register_template(template);
    }
  } else {
    // Called with just (class) - extract name from class
    const component_class = nameOrClass;
    const name = component_class.name;
    
    if (!name || name === 'Jqhtml_Component') {
      throw new Error('Component class must have a name when registering without explicit name');
    }
    
    component_classes.set(name, component_class);
    registry_changed();
  }
}

/**
 * Get a component class by name
 * If no class found, walks the template extends chain to find parent class
 */
export function get_component_class(name: string): ComponentConstructor | undefined {
  // First check if class directly registered
  const directClass = component_classes.get(name);
  if (directClass) {
    return directClass;
  }

  // No direct class found - walk template extends chain to find parent with class
  const template = component_templates.get(name);
  if (template && template.extends) {
    // Recursively check parent templates
    const visited = new Set<string>([name]); // Prevent infinite loops
    let currentTemplateName = template.extends;

    while (currentTemplateName && !visited.has(currentTemplateName)) {
      visited.add(currentTemplateName);

      // Check if this parent has a registered class
      const parentClass = component_classes.get(currentTemplateName);
      if (parentClass) {
        if ((window as any).jqhtml?.debug?.enabled) {
          console.log(`[JQHTML] Component '${name}' using class from parent '${currentTemplateName}' via extends chain`);
        }
        return parentClass;
      }

      // Continue walking up the chain
      const parentTemplate = component_templates.get(currentTemplateName);
      if (parentTemplate && parentTemplate.extends) {
        currentTemplateName = parentTemplate.extends;
      } else {
        break;
      }
    }
  }

  return undefined;
}

/**
 * Register a template - name is extracted from template.name property
 * Returns true if registered, false if duplicate
 */
export function register_template(template_def: TemplateDefinition): boolean {
  const name = template_def.name;

  if (!name) {
    throw new Error('Template must have a name property');
  }

  // Validate template name against the shared rule
  if (!is_component_name(name)) {
    throw new Error(
      `Template name '${name}' ${COMPONENT_NAME_RULE}. Convention is First_Letter_With_Underscores.`
    );
  }

  // Check for duplicate registration
  if (component_templates.has(name)) {
    console.warn(`[JQHTML] Template '${name}' already registered, skipping duplicate registration`);
    return false;
  }

  component_templates.set(name, template_def);
  registry_changed();

  if ((window as any).jqhtml?.debug?.enabled) {
    console.log(`[JQHTML] Successfully registered template: ${name}`);
  }

  // Also attach metadata to the component class if it exists
  const component_class = component_classes.get(name);
  if (component_class) {
    (component_class as any)._jqhtml_metadata = {
      tag: template_def.tag,
      defaultAttributes: template_def.defaultAttributes || {}
    };
  }

  return true;
}

/**
 * Get template for a component by name
 */
export function get_template(name: string): TemplateDefinition {
  const template = component_templates.get(name);

  if (!template) {
    // Check if we have a class but no template - walk prototype chain
    const component_class = component_classes.get(name);

    if (component_class) {
      // Class exists but no template - walk up prototype chain to find ancestor template
      const inherited_template = get_template_by_class(component_class);

      if (inherited_template !== DEFAULT_TEMPLATE) {
        if ((window as any).jqhtml?.debug?.enabled) {
          console.log(`[JQHTML] Component '${name}' has no template, using template from prototype chain`);
        }
        return inherited_template;
      }

      // Class exists but no template in chain
      if ((window as any).jqhtml?.debug?.enabled && !warned_components.has(name)) {
        warned_components.add(name);
        console.log(`[JQHTML] No template found for class: ${name}, using default div template`);
      }
    } else {
      // No class and no template
      // Suppress warning for _Jqhtml_Component and Redrawable (internal components)
      // Only warn once per component name
      if (name !== '_Jqhtml_Component' && name !== 'Redrawable' && !warned_components.has(name)) {
        warned_components.add(name);
        console.warn(`[JQHTML] Creating ${name} with defaults - no template or class defined`);
      }
    }

    if ((window as any).jqhtml?.debug?.verbose) {
      const registered = Array.from(component_templates.keys());
      console.log(`[JQHTML] Looking for template '${name}' in: [${registered.join(', ')}]`);
    }

    return DEFAULT_TEMPLATE;
  }

  return template;
}

/**
 * Check a template's `extends=""` against its component's JS class (CLAUDE.md "Template
 * Inheritance"). Returns an error message on conflict, null otherwise.
 *
 * The rule: list the class's JS ancestors up to Jqhtml_Component that have a template of
 * their own. An empty list (the class extends Jqhtml_Component directly, or only plain
 * helper classes sit in between) cannot conflict. Otherwise `extends=` must name one of
 * them - any ancestor, so a template may skip an intermediate layer. A template-only
 * component (no class registered under the template's name) and an `extends=` target
 * that has no template (resolution falls back to the prototype chain) are not conflicts.
 *
 * @param template_def The template being rendered
 * @param instance_class The rendering instance's class, used when no class is registered
 *   under the template's name but the instance's class carries that name
 */
export function extends_conflict(template_def: TemplateDefinition, instance_class?: any): string | null {
  const name = template_def?.name;
  const target = template_def?.extends;
  if (!name || !target) return null;

  const cached = extends_verdicts.get(name);
  if (cached !== undefined) return cached;

  let verdict: string | null = null;
  const component_class: any = component_classes.get(name)
    || (instance_class && instance_class.name === name ? instance_class : null);

  // Same test resolve_parent_template() applies: a target that resolves to nothing is
  // "missing", and resolution falls back to the prototype chain.
  const target_class = component_classes.get(target);
  const target_resolves = component_templates.has(target)
    || (!!target_class && get_template_by_class(target_class) !== DEFAULT_TEMPLATE);

  if (component_class && target_resolves) {
    const templated_ancestors: string[] = [];
    let current = Object.getPrototypeOf(component_class);
    while (typeof current === 'function' && current.name &&
           current.name !== 'Object' && current.name !== 'Jqhtml_Component' &&
           current.name !== '_Jqhtml_Component' && current.name !== '_Base_Jqhtml_Component') {
      if (component_templates.has(current.name)) templated_ancestors.push(current.name);
      current = Object.getPrototypeOf(current);
    }

    if (templated_ancestors.length > 0 && !templated_ancestors.includes(target)) {
      verdict =
        `[JQHTML] ${name}: <Define:${name} extends="${target}"> conflicts with its JS class. ` +
        `The class's templated ancestors are: ${templated_ancestors.join(', ')}. ` +
        `extends= must name one of them, or be removed so the prototype chain decides.`;
    }
  }

  extends_verdicts.set(name, verdict);
  return verdict;
}

/**
 * Get template for a component class - walks up inheritance chain
 */
export function get_template_by_class(component_class: ComponentConstructor): TemplateDefinition {
  // First check if class has static template property
  if ((component_class as any).template) {
    return (component_class as any).template;
  }

  const cached = template_by_class_cache.get(component_class);
  if (cached !== undefined) return cached;

  // Then check registered templates by class name
  let currentClass: any = component_class;
  while (currentClass && currentClass.name !== 'Object') {
    // Normalize class name - handle different import patterns
    let normalizedName = currentClass.name;
    if (normalizedName === '_Jqhtml_Component' || normalizedName === '_Base_Jqhtml_Component') {
      normalizedName = 'Jqhtml_Component';
    }

    const template = component_templates.get(normalizedName);
    if (template) {
      template_by_class_cache.set(component_class, template);
      return template;
    }
    // Walk up the prototype chain
    currentClass = Object.getPrototypeOf(currentClass);
  }

  template_by_class_cache.set(component_class, DEFAULT_TEMPLATE);
  return DEFAULT_TEMPLATE;
}

/**
 * Create a component instance by name
 * If no component class is registered, uses the default Component class
 */
export function create_component(
  name: string,
  element?: any,
  args: Record<string, any> = {}
): Jqhtml_Component {
  const ComponentClass = get_component_class(name) || Jqhtml_Component;
  return new ComponentClass(element, args);
}

/**
 * Check if a component is registered
 */
export function has_component(name: string): boolean {
  return component_classes.has(name);
}

/**
 * Get all registered component names
 */
export function get_component_names(): string[] {
  return Array.from(component_classes.keys());
}

/**
 * Get all registered template names
 */
export function get_registered_templates(): string[] {
  return Array.from(component_templates.keys());
}

/**
 * List all registered components with their template status
 */
export function list_components(): Record<string, { has_class: boolean; has_template: boolean }> {
  const result: Record<string, { has_class: boolean; has_template: boolean }> = {};

  // Add all classes
  for (const name of component_classes.keys()) {
    result[name] = {
      has_class: true,
      has_template: component_templates.has(name)
    };
  }

  // Add any templates without classes
  for (const name of component_templates.keys()) {
    if (!result[name]) {
      result[name] = {
        has_class: false,
        has_template: true
      };
    }
  }

  return result;
}

/**
 * Unified registration function - auto-detects source type and delegates
 *
 * Accepts either:
 * - A compiled JQHTML template (has __jqhtml_template: true)
 * - A component class extending Jqhtml_Component (has static __jqhtml_component: true and static component_name)
 *
 * @param source - Compiled template or component class
 */
export function register(source: TemplateDefinition | ComponentConstructor): void {
  // Check for template (compiled .jqhtml file)
  if (source && typeof source === 'object' && '__jqhtml_template' in source && (source as any).__jqhtml_template === true) {
    register_template(source as TemplateDefinition);
    return;
  }

  // Check for component class (extends Jqhtml_Component)
  if (source && typeof source === 'function' && '__jqhtml_component' in source && (source as any).__jqhtml_component === true) {
    // Prefer static component_name, fall back to class name
    const component_name = (source as any).component_name || source.name;

    if (!component_name || typeof component_name !== 'string') {
      throw new Error(
        '[JQHTML] Could not determine component name from class.\n\n' +
        'Either define static component_name:\n' +
        '  class My_Component extends Jqhtml_Component {\n' +
        '    static component_name = "My_Component";\n' +
        '  }\n\n' +
        'Or use register_component() with explicit name:\n' +
        '  jqhtml.register_component("My_Component", My_Component);'
      );
    }

    register_component(component_name, source as ComponentConstructor);
    return;
  }

  // Unknown type - provide helpful error
  throw new Error(
    '[JQHTML] register() requires a compiled JQHTML template or a component class.\n\n' +
    'For templates:\n' +
    '  import My_Template from "./my_component.jqhtml";\n' +
    '  jqhtml.register(My_Template);\n\n' +
    'For classes:\n' +
    '  class My_Component extends Jqhtml_Component { }\n' +
    '  jqhtml.register(My_Component);\n\n' +
    'Note: Class name is used for registration. If using JS minification with\n' +
    'class name mangling, define static component_name or use register_component().'
  );
}