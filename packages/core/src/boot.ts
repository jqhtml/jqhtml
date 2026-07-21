/**
 * JQHTML Boot - Component Hydration System
 *
 * Bridges server-rendered HTML and client-side jqhtml components.
 *
 * Server output:   <div class="_Component_Init" data-component-init-name="User_Card" data-component-args='{"id":1}'></div>
 * After boot():    <div class="User_Card Component">...rendered template...</div>
 *
 * Usage:
 *   await jqhtml.boot();           // Hydrate all placeholders, wait for ready
 *   jqhtml.boot($('#container'));  // Hydrate within scope
 */

declare const $: any;
declare const jQuery: any;

/**
 * Hydrate all _Component_Init placeholders within a scope.
 *
 * @param scope - jQuery object, HTMLElement, or undefined (defaults to body)
 * @returns Promise that resolves when all components (including nested) are ready
 */
export function boot(scope?: any): Promise<void[]> {
  const jQ = typeof jQuery !== 'undefined' ? jQuery : $;

  if (!scope) {
    scope = jQ('body');
  } else if (!(scope instanceof jQ)) {
    scope = jQ(scope);
  }

  const readyPromises: Promise<void>[] = [];

  // Find top-level placeholders only (skip those nested inside other placeholders)
  scope.find('._Component_Init').each(function(this: HTMLElement) {
    const $element = jQ(this);

    // Skip if removed from DOM
    if (!document.contains($element[0])) {
      return;
    }

    // Skip nested placeholders - they'll be hydrated by parent's render callback
    let parent = $element[0].parentElement;
    while (parent) {
      if (parent.classList.contains('_Component_Init')) {
        return;
      }
      parent = parent.parentElement;
    }

    // Hydrate this placeholder
    const component = hydrateElement($element, jQ);
    if (!component) return;

    // On render, recursively hydrate any nested placeholders
    component.on('render', function() {
      hydrateNested(component.$, jQ);
    });

    // Collect ready promise - parent.ready() waits for all children via _wait_for_children_ready()
    readyPromises.push(component.ready());
  });

  // Fire jqhtml:ready event when all top-level components are ready
  const result = Promise.all(readyPromises);
  result.then(() => {
    document.dispatchEvent(new CustomEvent('jqhtml:ready'));
  });

  return result;
}

/**
 * Hydrate nested _Component_Init placeholders within a component's DOM.
 * Called from parent's 'render' event.
 */
function hydrateNested($scope: any, jQ: any): void {
  $scope.find('._Component_Init').each(function(this: HTMLElement) {
    const $element = jQ(this);

    if (!document.contains($element[0])) {
      return;
    }

    // Skip if nested inside another placeholder
    let parent = $element[0].parentElement;
    while (parent && parent !== $scope[0]) {
      if (parent.classList.contains('_Component_Init')) {
        return;
      }
      parent = parent.parentElement;
    }

    const component = hydrateElement($element, jQ);
    if (!component) return;

    // Recursively handle deeper nesting
    component.on('render', function() {
      hydrateNested(component.$, jQ);
    });
  });
}

/**
 * Hydrate a single _Component_Init element into a live component.
 */
function hydrateElement($element: any, jQ: any): any {
  const componentName = $element.attr('data-component-init-name');
  if (!componentName) return null;

  // Parse args
  const argsString = $element.attr('data-component-args');
  let args: Record<string, any> = {};
  if (argsString) {
    try {
      args = JSON.parse(argsString);
    } catch (e) {
      console.error(`[jqhtml.boot] Failed to parse args for ${componentName}:`, e);
    }
  }

  // Strip data- prefix from args if present
  const filteredArgs: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    filteredArgs[key.startsWith('data-') ? key.substring(5) : key] = value;
  }

  // Capture innerHTML for content() and mark as boot-created
  filteredArgs._inner_html = $element.html();
  filteredArgs._component_name = componentName;

  // Cleanup placeholder
  $element.removeAttr('data-component-init-name');
  $element.removeAttr('data-component-args');
  $element.removeData('component-init-name');
  $element.removeData('component-args');
  $element.removeClass('_Component_Init');
  $element.empty();

  // Create component
  try {
    return $element.component(componentName, filteredArgs).component();
  } catch (error) {
    console.error(`[jqhtml.boot] Failed to create ${componentName}:`, error);
    return null;
  }
}
