// Calls alive() where it is not available - on_load() - and records what it threw.
class Alv_Probe extends Jqhtml_Component {
  async on_load() {
    try { await this.alive(Promise.resolve(1)); window.__alv_probe = 'returned'; } catch (e) { window.__alv_probe = e.message; }
  }
}
