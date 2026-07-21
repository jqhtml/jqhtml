/**
 * Without_On_Load - Component without custom on_load
 * Used to verify 'loaded' event fires even for components without on_load
 */
class Without_On_Load extends Jqhtml_Component {
  on_create() {
    this.state.loaded_event_fired = false;

    // Listen for 'loaded' event
    this.on('loaded', () => {
      console.log('[Without_On_Load] loaded event received!');
      this.state.loaded_event_fired = true;
    });
  }

  // No on_load() - uses default behavior

  on_ready() {
    console.log('[Without_On_Load] on_ready - loaded_event_fired:', this.state.loaded_event_fired);
  }
}
