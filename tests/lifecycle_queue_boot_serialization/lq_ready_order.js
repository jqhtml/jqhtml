class Lq_Ready_Order extends Jqhtml_Component {
  on_create() {
    this.data.run = 0;
  }

  async on_load() {
    const s = window.__lq_ro;
    const run = ++s.loads;
    s.marks.push('load:' + run);
    await new Promise(resolve => setTimeout(resolve, 20));
    this.data.run = run;
  }

  async on_ready() {
    const s = window.__lq_ro;
    s.marks.push('on_ready:' + this.data.run);
    if (s.triggered) return;
    s.triggered = true;
    const awaited = this.reload();
    const settled = awaited.then(() => s.marks.push('awaited_resolved'));   // pulled forward now
    this.reload();   // made after the promotion: its own entry, not merged into the promoted one
    this.render();   // unawaited: waits for this on_ready() to return
    await settled;
    s.marks.push('on_ready_return');
  }
}
