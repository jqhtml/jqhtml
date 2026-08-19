/**
 * JQHTML Viewport Resize Dispatch
 *
 * One framework-owned, debounced window 'resize' listener fans out to every live
 * component in the document by calling on_viewport_resize(viewport_width).
 *
 * Components never bind their own window listener, so there is nothing to unbind
 * in on_stop() - a component that is stopped or removed from the document simply
 * stops being found by the dispatcher.
 */

/** Trailing-edge debounce applied to the window resize listener. */
export const VIEWPORT_RESIZE_DEBOUNCE_MS = 30;

let debounce_timer: any = null;
let listener_installed = false;

/**
 * Current viewport width in CSS pixels.
 *
 * window.innerWidth is used (not $(window).width()) because it matches the width
 * CSS media queries resolve against. It includes the scrollbar gutter.
 *
 * Returns 0 outside a browser (SSR).
 */
export function get_viewport_width(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 0;
}

/**
 * Call on_viewport_resize(width) on every component currently in the document.
 *
 * Walks $('.Component') in document order (parents before children). Elements
 * with no component instance and stopped components are skipped. A component
 * that throws is logged and the walk continues - one bad handler must not stop
 * the rest of the page from resizing.
 */
export function dispatch_viewport_resize(jQuery: any): void {
  const viewport_width = get_viewport_width();

  jQuery('.Component').each(function(this: HTMLElement) {
    const component = jQuery(this).data('_component');
    if (!component || component._stopped) return;
    if (typeof component.on_viewport_resize !== 'function') return;

    try {
      component.on_viewport_resize(viewport_width);
    } catch (error) {
      console.error(
        `[JQHTML] Error in on_viewport_resize() for ${component.component_name?.() || 'component'}:`,
        error
      );
    }
  });
}

/**
 * Install the single window resize listener. Idempotent - repeated init() calls
 * and non-browser environments are no-ops.
 */
export function init_viewport_resize(jQuery: any): void {
  if (typeof window === 'undefined') return;
  if (listener_installed) return;
  listener_installed = true;

  jQuery(window).on('resize.jqhtml_viewport', function() {
    if (debounce_timer !== null) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(function() {
      debounce_timer = null;
      dispatch_viewport_resize(jQuery);
    }, VIEWPORT_RESIZE_DEBOUNCE_MS);
  });
}
