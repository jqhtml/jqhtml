/**
 * JQHTML v2 Template Renderer
 * 
 * Connects compiled templates to components
 * Processes instruction arrays and handles bindings
 */

// Use global jQuery
declare const $: any;
import type { Jqhtml_Component } from './component.js';
import { process_instructions } from './instruction-processor.js';
import { get_template_by_class } from './component-registry.js';
import { get_template } from './component-registry.js';
import { Jqhtml_Component as BaseComponent } from './component.js';

/**
 * Process slot-only template inheritance
 *
 * When a component's template returns {_slots: {...}}, walk the prototype
 * chain to find a parent template and invoke it with the child's slots as content.
 *
 * @param component The component instance
 * @param childSlots The slots object from the child template
 * @returns [instructions, context] tuple or null if no parent found
 */
async function process_slot_inheritance(
  component: Jqhtml_Component,
  childSlots: Record<string, Function>
): Promise<[any[], Jqhtml_Component] | null> {
  // Walk the prototype chain to find parent class with template
  let currentClass = Object.getPrototypeOf(component.constructor);

  console.log(`[JQHTML] Walking prototype chain for ${component.constructor.name}`);

  while (currentClass && currentClass !== BaseComponent && currentClass.name !== 'Object') {
    const className = currentClass.name;
    console.log(`[JQHTML]   Checking parent class: ${className}`);

    // Skip internal framework classes
    if (className === '_Jqhtml_Component' || className === '_Base_Jqhtml_Component') {
      currentClass = Object.getPrototypeOf(currentClass);
      continue;
    }

    // Try to find template for this parent class
    try {
      const parentTemplate = get_template(className);
      console.log(`[JQHTML]   Template found for ${className}:`, parentTemplate ? parentTemplate.name : 'null');

      // Check if we got the default template (means no real template found)
      if (parentTemplate && parentTemplate.name !== 'Jqhtml_Component') {
        console.log(`[JQHTML]   Invoking parent template ${className}`);
        // Found a real parent template - invoke it with child's slots as content
        const [parentInstructions, parentContext] = parentTemplate.render.call(
          component,
          component.data,
          component.args,
          childSlots  // Pass child slots as content parameter
        );

        // Check if parent also returns slots (recursive inheritance)
        if (parentInstructions && typeof parentInstructions === 'object' && parentInstructions._slots) {
          // Parent also has slot-only template - recurse
          console.log(`[JQHTML]   Parent also slot-only, recursing`);
          return await process_slot_inheritance(component, parentInstructions._slots);
        }

        // Parent returned HTML - we're done
        console.log(`[JQHTML]   Parent returned instructions, inheritance complete`);
        return [parentInstructions, parentContext];
      }
    } catch (error) {
      console.warn(`[JQHTML] Error looking up parent template for ${className}:`, error);
    }

    // Move to next parent
    currentClass = Object.getPrototypeOf(currentClass);
  }

  // No parent template found
  console.warn(`[JQHTML] No parent template found after walking chain`);
  return null;
}

/**
 * Render a template for a component
 * Templates are functions that return [instructions, context] tuples
 */
export async function render_template(
  component: Jqhtml_Component,
  template_fn?: Function
): Promise<void> {
  // Get template from registry if not provided
  let render_fn = template_fn;
  if (!render_fn) {
    const template_def = get_template_by_class(component.constructor as any);
    render_fn = template_def.render;
  }
  
  if (!render_fn) {
    // No template, component should handle its own rendering
    return;
  }
  
  // Clear existing content
  component.$.empty();
  
  // Execute template function
  // Templates receive: (data, args, content)
  // Provide a default empty content function if none provided
  const defaultContent = () => '';

  let [instructions, context] = render_fn.call(
    component,
    component.data,
    component.args,
    defaultContent // Default content function that returns empty string
  );

  // Check for slot-only template inheritance
  // If instructions is {_slots: {...}}, this is a slot-only template
  // We need to find the parent template and invoke it with these slots
  if (instructions && typeof instructions === 'object' && instructions._slots) {
    console.log(`[JQHTML] Slot-only template detected for ${component.constructor.name}, invoking inheritance`);
    const result = await process_slot_inheritance(component, instructions._slots);
    if (result) {
      console.log(`[JQHTML] Parent template found, using parent instructions`);
      instructions = result[0];
      context = result[1];
    } else {
      console.warn(`[JQHTML] No parent template found for ${component.constructor.name}, rendering empty`);
      // No parent template found - return empty
      instructions = [];
    }
  }

  // Process instructions to generate DOM
  await process_instructions(instructions, component.$, component);
  
  // Process bindings after DOM is created
  await process_bindings(component);
  
  // Attach event handlers
  await attach_event_handlers(component);
}

/**
 * Process data bindings (attributes created by :prop syntax)
 */
async function process_bindings(component: Jqhtml_Component): Promise<void> {
  // Find all elements with data-bind-* attributes
  component.$.find('[data-bind-prop], [data-bind-value], [data-bind-text], [data-bind-html], [data-bind-class], [data-bind-style]').each((_, element) => {
    const el = $(element);
    const attrs = element.attributes;
    
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.name.startsWith('data-bind-')) {
        const binding_type = attr.name.substring(10); // Remove 'data-bind-'
        const expression = attr.value;
        
        try {
          // Evaluate expression in component context
          const value = evaluate_expression(expression, component);
          
          // Apply binding based on type
          switch (binding_type) {
            case 'prop':
              // Generic property binding
              const prop_name = el.attr('data-bind-prop-name') || 'value';
              el.prop(prop_name, value);
              break;
              
            case 'value':
              el.val(value);
              break;
              
            case 'text':
              el.text(value);
              break;
              
            case 'html':
              el.html(value);
              break;
              
            case 'class':
              if (typeof value === 'object') {
                // Object syntax: {active: true, disabled: false}
                Object.entries(value).forEach(([className, enabled]) => {
                  el.toggleClass(className, !!enabled);
                });
              } else {
                // String syntax
                el.addClass(String(value));
              }
              break;
              
            case 'style':
              if (typeof value === 'object') {
                el.css(value);
              } else {
                el.attr('style', String(value));
              }
              break;
              
            default:
              // Custom binding - set as attribute
              el.attr(binding_type, value);
          }
        } catch (error) {
          console.error(`Error evaluating binding "${expression}":`, error);
        }
      }
    }
  });
}

/**
 * Attach event handlers (attributes created by @event syntax)
 */
async function attach_event_handlers(component: Jqhtml_Component): Promise<void> {
  // Find all elements with data-on-* attributes
  component.$.find('[data-on-click], [data-on-change], [data-on-submit], [data-on-keyup], [data-on-keydown], [data-on-focus], [data-on-blur]').each((_, element) => {
    const el = $(element);
    const attrs = element.attributes;
    
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.name.startsWith('data-on-')) {
        const event_name = attr.name.substring(8); // Remove 'data-on-'
        const handler_expr = attr.value;
        
        // Remove the attribute to avoid re-processing
        el.removeAttr(attr.name);
        
        // Attach event handler
        el.on(event_name, function(event) {
          try {
            // Create handler function in component context
            const handler = evaluate_handler(handler_expr, component);
            
            if (typeof handler === 'function') {
              // Call with component as 'this' and pass event
              handler.call(component, event);
            } else {
              // Expression to execute
              evaluate_expression(handler_expr, component, { $event: event });
            }
          } catch (error) {
            console.error(`Error in ${event_name} handler "${handler_expr}":`, error);
          }
        });
      }
    }
  });
}

/**
 * Evaluate an expression in component context
 */
function evaluate_expression(
  expression: string,
  component: Jqhtml_Component,
  locals: Record<string, any> = {}
): any {
  // Create evaluation context
  const context = {
    // Component properties
    data: component.data,
    args: component.args,
    $: component.$,

    // Component methods
    $sid: component.$sid.bind(component),

    // Locals (like $event)
    ...locals
  };
  
  // Build function that evaluates in context
  const keys = Object.keys(context);
  const values = Object.values(context);
  
  try {
    // Use Function constructor for better performance than eval
    const fn = new Function(...keys, `return (${expression})`);
    return fn(...values);
  } catch (error) {
    console.error(`Invalid expression: ${expression}`, error);
    return undefined;
  }
}

/**
 * Evaluate a handler expression (might be method name or inline code)
 */
function evaluate_handler(
  expression: string,
  component: Jqhtml_Component
): Function | null {
  // Check if it's a method name on the component
  if (expression in component && typeof (component as any)[expression] === 'function') {
    return (component as any)[expression];
  }
  
  // Otherwise treat as inline code
  try {
    return new Function('$event', `
      const { data, args, $, emit, $sid } = this;
      ${expression}
    `).bind(component);
  } catch (error) {
    console.error(`Invalid handler: ${expression}`, error);
    return null;
  }
}

/**
 * Helper to escape HTML for safe output
 */
export function escape_html(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Helper to escape HTML and convert newlines to <br /> tags
 * Used by <%br= %> syntax for displaying user-entered text with line breaks
 */
export function escape_html_nl2br(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  // Escape HTML first, then replace newlines with <br />
  return div.innerHTML.replace(/\n/g, '<br />');
}