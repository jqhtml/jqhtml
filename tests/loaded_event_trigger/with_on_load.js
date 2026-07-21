/**
 * With_On_Load - Component with custom on_load
 * Used to verify 'loaded' event fires after on_load completes
 */
class With_On_Load extends Jqhtml_Component {
  on_create() {
    this.state.loaded_event_fired = false;
    this.state.loaded_event_time = null;
    this.data.on_load_end_time = null;  // Store timing in this.data (allowed in on_load)

    // Listen for 'loaded' event
    this.on('loaded', () => {
      console.log('[With_On_Load] loaded event received!');
      this.state.loaded_event_fired = true;
      this.state.loaded_event_time = Date.now();
    });
  }

  async on_load() {
    console.log('[With_On_Load] on_load starting...');

    // Simulate async data loading
    await new Promise(resolve => setTimeout(resolve, 100));

    this.data.message = 'Data loaded!';
    this.data.on_load_end_time = Date.now();  // Record end time in this.data

    console.log('[With_On_Load] on_load complete');
  }

  on_ready() {
    // Copy data timing to state for test comparison
    this.state.on_load_end_time = this.data.on_load_end_time;
    console.log('[With_On_Load] on_ready - loaded_event_fired:', this.state.loaded_event_fired);
  }
}
