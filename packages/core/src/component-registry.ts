/**
 * JQHTML v2 Component Registry
 * 
 * Global registry for component classes and templates
 * Enables dynamic component instantiation and template association
 */

import { Jqhtml_Component } from './component.js';

// Template function signature matching parser output
export type TemplateFunction = (
  this: Jqhtml_Component,
  data: Record<string, any>,
  args: Record<string, any>,
  content: any
) => [any[], Jqhtml_Component];

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

// Default template for components without registered templates
const DEFAULT_TEMPLATE: TemplateDefinition = {
  name: 'Jqhtml_Component',  // Default name
  tag: 'div',
  render: function(data, args, content) {
    const _output = [];

    // Check for _inner_html first (server-rendered content)
    if (args._inner_html) {
      _output.push(args._inner_html);
      return [_output, this];
    }

    // Just render the content/slots
    if (content && typeof content === 'function') {
      const result = content();  // Call with no args to get default content
      // Handle both tuple and string returns
      if (Array.isArray(result) && result.length === 2) {
        // It's a [instructions, context] tuple
        _output.push(...result[0]);
      } else if (typeof result === 'string') {
        // It's a plain string
        _output.push(result);
      }
    }
    return [_output, this];
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

    // Validate component name starts with capital letter
    if (!/^[A-Z]/.test(name)) {
      throw new Error(
        `Component name '${name}' must start with a capital letter. Convention is First_Letter_With_Underscores.`
      );
    }

    component_classes.set(name, component_class);
    
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

  // Validate template name starts with capital letter
  if (!/^[A-Z]/.test(name)) {
    throw new Error(
      `Template name '${name}' must start with a capital letter. Convention is First_Letter_With_Underscores.`
    );
  }

  // Check for duplicate registration
  if (component_templates.has(name)) {
    console.warn(`[JQHTML] Template '${name}' already registered, skipping duplicate registration`);
    return false;
  }

  component_templates.set(name, template_def);

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
 * Get template for a component class - walks up inheritance chain
 */
export function get_template_by_class(component_class: ComponentConstructor): TemplateDefinition {
  // First check if class has static template property
  if ((component_class as any).template) {
    return (component_class as any).template;
  }

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
      return template;
    }
    // Walk up the prototype chain
    currentClass = Object.getPrototypeOf(currentClass);
  }

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