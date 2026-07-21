// Track on_load calls globally to verify deduplication
if (!window.on_load_calls) {
  window.on_load_calls = 0;
}

class Contact_Display extends Jqhtml_Component {
  on_create() {
    this.data.loaded = false;
    this.data.name = '';
    this.data.email = '';
  }

  async on_load() {
    // Count how many times on_load is actually called
    window.on_load_calls++;
    const call_count = window.on_load_calls;

    console.log(`[Contact_Display] on_load called for contact_id=${this.args.contact_id}, total calls=${call_count}`);

    // Simulate API call with delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Set the data
    this.data.name = `Contact ${this.args.contact_id}`;
    this.data.email = `contact${this.args.contact_id}@example.com`;
    this.data.loaded = true;

    console.log(`[Contact_Display] on_load complete for contact_id=${this.args.contact_id}`);
  }
}
