// Wr_Page has no on_load(); Wr_Loaded has one, held by window.__wr_gate when set;
// Wr_Custom keys itself with cache_id(). Each records was_ready_before() in on_create()
// (the spinner decision) and again in on_ready() (frozen: still the create-time answer).
class Wr_Page extends Jqhtml_Component {
  on_create() { this.state.cold = !this.was_ready_before(); }
  on_ready() { this.state.in_ready = this.was_ready_before(); }
}
