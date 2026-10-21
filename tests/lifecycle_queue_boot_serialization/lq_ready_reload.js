class Lq_Ready_Reload extends Jqhtml_Component {
  on_create() {
    this.data.run = 0;
  }

  async on_load() {
    const s = window.__lq_rr;
    const run = ++s.loads;
    s.marks.push('load:' + run);
    await new Promise(resolve => setTimeout(resolve, 60));
    this.data.run = run;
  }

  // The documented pattern: on_ready() decides the component needs another cycle,
  // calls reload() WITHOUT awaiting it, and returns.
  on_ready() {
    const s = window.__lq_rr;
    s.on_ready_runs.push(this.data.run);
    s.marks.push('on_ready:' + this.data.run);
    if (!s.triggered) {
      s.triggered = true;
      const before = s.loads;
      this.reload();
      // The reload waits for this on_ready() to return: no on_load() has started.
      s.started_sync = (s.loads !== before);
      s.marks.push('on_ready_return:' + this.data.run);
      return;
    }
    s.marks.push('on_ready_return:' + this.data.run);
  }
}
