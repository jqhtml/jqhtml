// Registers 'rendered' and 'ready' listeners in on_create - BEFORE the first
// render happens - so no race is possible between attaching the listener and
// the event firing. Every occurrence is appended to a shared global log so the
// driving test can assert relative ordering.
//
// on_load() also mutates this.data, forcing the re-render-after-load path, so
// this exercises the "rendered fires after the FINAL render (first render or
// re-render after on_load)" behavior documented on rendered().
class Rendered_Order_Child extends Jqhtml_Component {
  on_create() {
    this.data.loaded = false;

    this.on('rendered', () => {
      window.__rendered_order_log.push('rendered');
    });
    this.on('ready', () => {
      window.__rendered_order_log.push('ready');
    });
  }

  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 20));
    this.data.loaded = true;
  }
}
