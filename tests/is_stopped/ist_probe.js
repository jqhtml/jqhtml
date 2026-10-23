// Calls the is_*() queries where they are not available - on_load(), and on_load_error()
// after a deliberate failure - and records what each threw.
class Ist_Probe extends Jqhtml_Component {
  async on_load() {
    const tries = {};
    for (const name of ['is_stopped', 'is_attached']) {
      try { this[name](); tries[name] = 'returned'; } catch (e) { tries[name] = e.message; }
    }
    window.__ist_probe_on_load = tries;  // not this.data: on_load_error() restarts it from on_create()
    throw new Error('probe: deliberate load failure');
  }
  on_load_error() {
    try { this.is_stopped(); this.data.in_on_load_error = 'returned'; } catch (e) { this.data.in_on_load_error = e.message; }
  }
}
