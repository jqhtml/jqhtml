class Sw_Slow extends Jqhtml_Component {
  on_create() {
    this.data.label = 'initial';
  }

  async on_load() {
    // A test can hold on_load() open: window.__sw_hold(this) returns a promise the
    // test resolves. That parks the component inside on_load() for as long as the test
    // needs, whatever the system load; otherwise the load takes 300ms.
    if (window.__sw_hold) {
      await window.__sw_hold(this);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    this.data.label = 'loaded';
  }
}
