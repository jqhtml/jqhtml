/**
 * A component whose data only exists because on_load() fetched it.
 *
 * The load count lives in this.state, which survives every lifecycle operation, while
 * this.data is restored from the on_create() snapshot - so "Reload w/o data" shows
 * `loaded: no` with the count unchanged, and a following Reload shows `loaded: yes`
 * with the count one higher. on_load() itself runs on the detached proxy and cannot
 * touch this.state, so the count is bumped from on_loaded(), which fires once per
 * completed load.
 */
class Dbg_Loader extends Jqhtml_Component {
  on_create() {
    this.state.load_count = 0;
    this.data.loaded = false;
  }

  async on_load() {
    this.data.loaded = true;
  }

  on_loaded() {
    this.state.load_count++;
  }
}
