class Lrn_Sink extends Jqhtml_Component {
  async on_load() {
    const payload = window.__lrn_make_payload();
    // Kept so the test can compare identity and mutate the author's object after
    // the load. on_load() may not touch this.state, but window is not restricted.
    window.__lrn_returned = payload;
    this.data = payload;
  }
}
