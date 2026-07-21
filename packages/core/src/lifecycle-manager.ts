/**
 * JQHTML v2 Lifecycle Manager
 *
 * Simple lifecycle orchestration - no queues, no batching.
 * Components boot when created. That's it.
 *
 * Lifecycle order:
 * 1. create() - SYNC - Calls on_create() BEFORE first render
 * 2. render() - SYNC - Creates DOM, instantiates child components, calls on_render()
 * 3. _load() - ASYNC - Calls on_load() if overridden, may trigger re-render if this.data changes
 * 4. ready() - ASYNC - Waits for children to be ready, calls on_ready()
 *
 * Key insight: create/render/on_render are synchronous. If a component doesn't
 * override on_load(), the entire create→render→on_render chain completes without
 * yielding to the event loop. This means parent components can access child
 * components in their on_render() as long as the children don't have async on_load().
 */

import type { Jqhtml_Component } from './component.js';

export type LifecyclePhase = 'render' | 'create' | 'load' | 'ready';

export class LifecycleManager {
  private static instance: LifecycleManager;
  private active_components: Set<Jqhtml_Component> = new Set();

  static get_instance(): LifecycleManager {
    if (!LifecycleManager.instance) {
      LifecycleManager.instance = new LifecycleManager();
    }
    return LifecycleManager.instance;
  }

  constructor() {
    // No automatic cleanup on DOM removal - components stop explicitly via:
    // 1. Parent component re-render (calls .empty() which stops children)
    // 2. Manual .empty(), .html(), .text() calls (overridden to stop children)
    // 3. Explicit .stop() call
    // This allows components to be moved in DOM without lifecycle interruption
  }

  /**
   * Boot a component - run its full lifecycle
   * Called when component is created
   *
   * Supports lifecycle truncation flags:
   * - _load_only: on_create + on_load only. No render, no children, no on_render, no on_loaded, no on_ready.
   * - _load_render_only: on_create + render + on_load + re-render. No on_render, no on_loaded, no on_ready.
   */
  async boot_component(component: Jqhtml_Component): Promise<void> {
    this.active_components.add(component);

    try {
      // Create phase - SYNCHRONOUS, runs BEFORE first render
      component.create();

      // Check if stopped during create
      if ((component as any)._stopped) return;

      // Trigger create event
      component.trigger('create');

      // Check for lifecycle truncation flags
      const load_only = (component as any)._load_only;
      const load_render_only = (component as any)._load_render_only;
      const is_detached = (component as any)._is_detached;

      let render_id: number;

      if (load_only || is_detached) {
        // _load_only or detached: skip initial render entirely
        render_id = 0;
        (component as any)._render_count = 0;
      } else if (load_render_only) {
        // _load_render_only: render to create children, but skip on_render()
        render_id = component._render(null, { skip_on_render: true });

        // Check if stopped during render
        if ((component as any)._stopped) return;
      } else {
        // Normal: render with on_render()
        render_id = component._render();

        // Check if stopped during render
        if ((component as any)._stopped) return;
      }

      // Load phase - ASYNC, but only if on_load() is overridden
      // Skip entirely if component uses default stub to avoid unnecessary yield
      if ((component as any)._has_on_load()) {
        // Load gates: await any promises registered via gate_load() during
        // on_create() before the FIRST on_load(). Gates delay ONLY this load
        // phase — create/render/on_render/cached-paint already happened above.
        // Released early by reload()/refresh()/stop() while gated (see component).
        // Returns null (no await) for the common no-gate case to keep timing
        // identical for ungated components.
        const gate_wait = (component as any)._await_load_gates();
        if (gate_wait) {
          await gate_wait;

          // Check if stopped while awaiting gates
          if ((component as any)._stopped) return;
        }

        await component._load();

        // Yield to microtask queue after on_load completes
        // This ensures async queue tasks always run before the on_load process completes,
        // even if on_load() itself completes instantly (deterministic behavior)
        await Promise.resolve();
      }

      // Check if stopped during load
      if ((component as any)._stopped) return;

      // If _load_only, mark component as ready now and return
      if (load_only) {
        (component as any)._ready_state = 4;
        (component as any)._update_debug_attrs();
        (component as any)._log_lifecycle('ready', 'complete (_load_only)');
        component.trigger('ready');
        return;
      }

      // Detached elements always render here (initial render was skipped)
      // Normal elements re-render only if data changed during on_load
      if (is_detached || (component as any)._should_rerender()) {
        // Disable animations during re-render to prevent visual artifacts
        // from CSS transitions/animations firing on newly rendered elements
        const $el = (component as any).$;
        if ($el && $el[0]) {
          $el[0].classList.add('__jqhtml_disable_animations');

          // Re-enable animations after animation frame + 5ms
          // This ensures the browser has painted the new DOM before animations resume
          requestAnimationFrame(() => {
            setTimeout(() => {
              // Check component still exists and element is still in DOM
              if (!(component as any)._stopped && $el[0].isConnected) {
                $el[0].classList.remove('__jqhtml_disable_animations');
              }
            }, 5);
          });
        }

        // _load_render_only: re-render with skip_on_render to suppress DOM hooks
        if (load_render_only) {
          render_id = component._render(null, { skip_on_render: true });
        } else {
          render_id = component._render();
        }

        // Check if stopped during re-render
        if ((component as any)._stopped) return;
      }

      // _load_render_only: skip waiting for children, on_ready — mark ready and return
      if (load_render_only) {
        (component as any)._ready_state = 4;
        (component as any)._update_debug_attrs();
        (component as any)._log_lifecycle('ready', 'complete (_load_render_only)');
        component.trigger('ready');
        return;
      }

      // Fire 'rendered' event - component has completed its synchronous render chain
      // This happens once, after the final on_render (whether from first render or re-render after on_load)
      if (!(component as any)._has_rendered) {
        (component as any)._has_rendered = true;
        component.trigger('rendered');
      }

      // Check if this render is still current before proceeding to ready
      // If _render_count changed, another render happened and we should skip ready
      if ((component as any)._render_count !== render_id) {
        return; // Stale render, don't call ready
      }

      // Yield to microtask queue before ready phase
      // This allows any queued async callbacks (e.g., from child component boots)
      // to execute before on_ready() runs, without triggering a paint cycle.
      // Promise.resolve() schedules on microtask queue (not macrotask like setTimeout)
      await Promise.resolve();

      // Re-check stopped state after yield - something may have stopped us
      if ((component as any)._stopped) return;

      // Re-check render count after yield - another render may have started
      if ((component as any)._render_count !== render_id) {
        return; // Stale render, don't call ready
      }

      // Ready phase - waits for children, then calls on_ready()
      await (component as any)._ready();

      // Check if stopped during ready
      if ((component as any)._stopped) return;

    } catch (error) {
      console.error(`Error booting component ${component.component_name()}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a component (called on destroy)
   */
  unregister_component(component: Jqhtml_Component): void {
    this.active_components.delete(component);
  }

  /**
   * Wait for all active components to reach ready state
   */
  async wait_for_ready(): Promise<void> {
    const ready_promises: Promise<void>[] = [];

    for (const component of this.active_components) {
      if (component._ready_state < 4) {
        ready_promises.push(
          new Promise<void>((resolve) => {
            component.on('ready', () => resolve());
          })
        );
      }
    }

    await Promise.all(ready_promises);
  }
}
