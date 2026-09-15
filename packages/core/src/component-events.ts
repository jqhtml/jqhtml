/**
 * JQHTML Component Event System
 *
 * Extracted from component.ts - handles lifecycle event registration,
 * triggering, and state tracking.
 *
 * EVERY event is "sticky", not just the lifecycle ones: trigger() records the event
 * name and its payload, and a handler registered afterwards fires immediately with that
 * last payload. This is deliberate and applies to custom events too - a subscriber that
 * arrives after `trigger('row_selected', row)` still learns which row is selected,
 * which is what makes late-attaching UI work without a separate "current state" read.
 */

/**
 * Register a callback for an event.
 *
 * All events are "sticky", lifecycle (create, render, load, loaded, ready, stop) and
 * custom alike: if the event has already been triggered, the callback fires immediately
 * with the payload of that last trigger AND registers for future occurrences.
 *
 * invalidate(event_name) drops the stored marker when a component wants later
 * subscribers to wait for the next real occurrence instead (reload() does this for
 * 'ready').
 *
 * @param component - The component instance
 * @param event_name - Name of the event
 * @param callback - Callback: (component, data?) => void
 */
export function event_on(component: any, event_name: string, callback: (comp: any, data?: any) => void): any {
  // Initialize callback array for this event if needed
  if (!component._lifecycle_callbacks.has(event_name)) {
    component._lifecycle_callbacks.set(event_name, []);
  }

  // Add callback to queue
  component._lifecycle_callbacks.get(event_name)!.push(callback);

  // If this lifecycle event has already occurred, fire the callback immediately
  // with the stored data from when trigger() was called
  if (component._lifecycle_states.has(event_name)) {
    try {
      const stored_data = component._lifecycle_states.get(event_name);
      callback(component, stored_data);
    } catch (error) {
      console.error(`[JQHTML] Error in ${event_name} callback:`, error);
    }
  }

  return component;
}

/**
 * Register a callback that fires exactly once.
 *
 * - If the event already occurred (sticky), fires immediately and does NOT register.
 * - If the event has not occurred, registers and auto-deregisters after first fire.
 *
 * @param component - The component instance
 * @param event_name - Name of the event
 * @param callback - Callback: (component, data?) => void
 */
export function event_once(component: any, event_name: string, callback: (comp: any, data?: any) => void): any {
  // If event already occurred, fire immediately and we're done
  if (component._lifecycle_states.has(event_name)) {
    try {
      const stored_data = component._lifecycle_states.get(event_name);
      callback(component, stored_data);
    } catch (error) {
      console.error(`[JQHTML] Error in ${event_name} once callback:`, error);
    }
    return component;
  }

  // Wrap callback to auto-deregister after first fire
  const wrapper = (comp: any, data?: any) => {
    // Remove ourselves from the callback list
    const callbacks = component._lifecycle_callbacks.get(event_name);
    if (callbacks) {
      const idx = callbacks.indexOf(wrapper);
      if (idx !== -1) callbacks.splice(idx, 1);
    }
    callback(comp, data);
  };

  // Initialize callback array for this event if needed
  if (!component._lifecycle_callbacks.has(event_name)) {
    component._lifecycle_callbacks.set(event_name, []);
  }

  component._lifecycle_callbacks.get(event_name)!.push(wrapper);

  return component;
}

/**
 * Trigger an event - fires all registered callbacks.
 * Marks event as occurred so future .on() calls fire immediately.
 *
 * @param component - The component instance
 * @param event_name - Name of the event to trigger
 * @param data - Optional data to pass to callbacks as second parameter
 */
export function event_trigger(component: any, event_name: string, data?: any): void {
  // Mark this event as occurred and store the data for late subscribers
  component._lifecycle_states.set(event_name, data);

  // Fire all registered callbacks for this event.
  // Iterate a SNAPSHOT: handlers registered via once() splice themselves out of the
  // live array while it is being iterated, which would shift later handlers into
  // already-visited slots and skip them. The snapshot also means a handler
  // registered during dispatch does not fire in this dispatch (event_on's sticky
  // immediate-fire already delivered it).
  const callbacks = component._lifecycle_callbacks.get(event_name);
  if (callbacks) {
    for (const callback of [...callbacks]) {
      try {
        callback.bind(component)(component, data);
      } catch (error) {
        console.error(`[JQHTML] Error in ${event_name} callback:`, error);
      }
    }
  }
}

/**
 * Check if any callbacks are registered for a given event.
 *
 * @param component - The component instance
 * @param event_name - Name of the event to check
 */
export function event_on_registered(component: any, event_name: string): boolean {
  const callbacks = component._lifecycle_callbacks.get(event_name);
  return !!(callbacks && callbacks.length > 0);
}

/**
 * Invalidate a lifecycle event - removes the "already occurred" marker.
 *
 * After invalidate() is called:
 * - New .on() handlers will NOT fire immediately
 * - The ready() promise will NOT resolve immediately
 * - Handlers wait for the next trigger() call
 *
 * Existing registered callbacks are NOT removed - they'll fire on next trigger().
 *
 * Use case: Call invalidate('ready') at the start of reload() or render()
 * so that any new .on('ready') handlers wait for the reload/render to complete.
 *
 * @param component - The component instance
 * @param event_name - Name of the event to invalidate
 */
export function event_invalidate(component: any, event_name: string): void {
  component._lifecycle_states.delete(event_name);
}
