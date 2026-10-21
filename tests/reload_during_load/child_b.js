class Child_B extends Jqhtml_Component {
  on_create() {
    this.data.load_count = 0;
  }

  async on_load() {
    // Track how many times on_load is called
    window.__child_load_count = (window.__child_load_count || 0) + 1;
    const loadNum = window.__child_load_count;

    console.log(`[Child_B] on_load START (load #${loadNum})`);
    (window.__child_log = window.__child_log || []).push('start:' + loadNum);

    // Simulate async API call with 100ms delay
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[Child_B] on_load END (load #${loadNum})`);
    window.__child_log.push('end:' + loadNum);

    this.data.load_count = loadNum;
  }

  on_render() {
    console.log('[Child_B] on_render');
  }

  on_ready() {
    console.log('[Child_B] on_ready - load_count:', this.data.load_count);
    (window.__child_on_ready = window.__child_on_ready || []).push(this.data.load_count);
  }
}
