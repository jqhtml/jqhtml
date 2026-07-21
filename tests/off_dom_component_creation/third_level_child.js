class Third_Level_Child extends Jqhtml_Component {
  async on_load() {
    console.log('[Third_Level_Child] on_load: Simulating async load with 25ms delay...');

    // Simulate async data loading
    await new Promise(resolve => setTimeout(resolve, 25));

    console.log('[Third_Level_Child] on_load complete');
  }

  async on_ready() {
    console.log('[Third_Level_Child] on_ready: All children ready');
  }
}
