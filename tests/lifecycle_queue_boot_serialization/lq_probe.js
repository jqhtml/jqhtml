class Lq_Probe extends Jqhtml_Component {
  on_create() {
    this.args.v = this.args.v || 0;
    this.data.value = '';
  }

  async on_load() {
    const q = window.__lq_probe;
    const run = ++q.loads;
    const v = this.args.v;
    q.marks.push('start:' + run + ':v' + v);
    await new Promise(resolve => setTimeout(resolve, q.delay));
    q.marks.push('end:' + run);
    // Different every run, so load() reports a change and reload() renders.
    this.data.value = 'v' + v + '-run' + run;
  }

  on_render() {
    window.__lq_probe.renders++;
  }
}
