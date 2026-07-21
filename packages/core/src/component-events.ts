/**
 * JQHTML Component Event System
 *
 * Extracted from component.ts - handles lifecycle event registration,
 * triggering, and state tracking.
 *
 * Events have "sticky" semantics for lifecycle events: if an event has already
 * occurred, new .on() handlers fire immediately with the stored data.
 */

/**
 * Register a callback for an event.
 *
 * Lifecycle events (create, render, load, loaded, ready) are "sticky":
 * If a lifecycle event has already occurred, the callback fires immediately
 * AND registers for future occurrences.
 *
 * Custom events only fire when explicitly triggered via trigger().
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

  // Fire all registered callbacks for this event
  const callbacks = component._lifecycle_callbacks.get(event_name);
  if (callbacks) {
    for (const callback of callbacks) {
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
