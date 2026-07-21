class Child_Component extends Jqhtml_Component {
  async on_load() {
    console.log('Child on_load: Starting slow load...');
    // Simulate slow loading
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Child on_load: Load complete');
  }

  on_ready() {
    const timestamp = Date.now();
    const log_entry = `Child on_ready (${timestamp})`;
    console.log(log_entry);

    // Find parent and add to its log
    const parent = this.$.closest('.Parent_With_Render').component();
    if (parent) {
      parent.data.lifecycle_log.push(log_entry);
    }
  }
}
