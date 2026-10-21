class Lq_Ready_Await extends Jqhtml_Component {
  on_create() {
    this.data.run = 0;
  }

  async on_load() {
    const s = window.__lq_ra;
    const run = ++s.loads;
    s.marks.push('load:' + run);
    await new Promise(resolve => setTimeout(resolve, 20));
    this.data.run = run;
  }

  on_render() {
    window.__lq_ra.marks.push('render');
  }

  async on_ready() {
    const s = window.__lq_ra;
    s.marks.push('on_ready:' + this.data.run);
    if (s.triggered) return;
    s.triggered = true;
    await this.render();
    s.marks.push('render_resolved');
    s.load_result = await this.load();
    s.marks.push('load_resolved:' + this.data.run);
    await this.reload();
    s.marks.push('reload_resolved:' + this.data.run);
    s.marks.push('on_ready_return');
  }
}
