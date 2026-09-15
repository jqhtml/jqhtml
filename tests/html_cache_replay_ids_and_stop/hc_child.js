// Counts on_stop() so the test can see whether the cached-HTML render path stopped the
// children it overwrote.
//
// Deliberately template-only (no on_load): an html-mode parent's snapshot wait must
// handle a child that never has a post-load render.
class Hc_Child extends Jqhtml_Component {
  on_create() {
    this.data.mark = 'child';
  }

  on_stop() {
    window.__hc_child_stops = (window.__hc_child_stops || 0) + 1;
  }
}
