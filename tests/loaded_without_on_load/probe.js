/**
 * Nl_Probe - a component WITHOUT on_load(). Logs on_render, on_loaded, the 'loaded'
 * event and on_ready to window.__nl_log (by this.args.name), in the order they happen.
 *   $stop_in_render  - stops itself from on_render() (a stopped component gets no on_loaded)
 *   $slow_loaded     - on_loaded() awaits 50ms (the test stops it meanwhile)
 */
class Nl_Probe extends Jqhtml_Component {
  on_create() {
    this.data.label = 'from on_create';
    this.state.log = [];
    window.__nl_logs = window.__nl_logs || {};
    window.__nl_logs[this.args.name] = this.state.log;
    this.on('loaded', () => this.state.log.push('loaded'));
  }

  on_render() {
    this.state.log.push('on_render');
    if (this.args.stop_in_render) this.stop();
  }

  async on_loaded() {
    this.state.log.push('on_loaded');
    if (this.args.slow_loaded) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.state.log.push('on_loaded_end');
    }
  }

  on_ready() {
    this.state.log.push('on_ready');
  }
}
