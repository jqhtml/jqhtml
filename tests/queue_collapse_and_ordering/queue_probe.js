// The component under test: every on_load() run is counted and timestamped, and the
// value it writes is derived from args.seq plus the run number, so two consecutive
// runs always produce DIFFERENT data (load() must report data_changed === true).
class Queue_Probe extends Jqhtml_Component {
  on_create() {
    this.args.seq = this.args.seq || 0;
    this.data.value = '';
  }

  async on_load() {
    const q = window.__q;
    q.on_load_calls++;
    const run = q.on_load_calls;
    q.marks.push({ k: 'on_load_start', n: run, t: performance.now() });

    if (q.throw_next) {
      q.throw_next = false;
      // One-shot: the NEXT queued operation must still run after this rejection.
      throw new Error('queue_test_boom run ' + run);
    }

    await new Promise(resolve => setTimeout(resolve, q.delay));

    // freeze mode writes the SAME data every run, so refresh() has nothing to
    // render and reload()'s "always render" precedence becomes observable.
    this.data.value = q.freeze
      ? 'frozen'
      : ('seq-' + this.args.seq + '-run-' + run);

    q.marks.push({ k: 'on_load_end', n: run, t: performance.now() });
  }

  on_render() {
    if (window.__q) window.__q.render_calls++;
  }
}
