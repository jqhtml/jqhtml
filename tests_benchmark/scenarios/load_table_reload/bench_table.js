class Bench_Table extends Jqhtml_Component {
  on_create() { this.data.rows = []; }
  async on_load() { this.data.rows = window.bench_rows(); }
}
