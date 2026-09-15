// The component whose HTML is snapshotted and replayed.
//
// cache_id() deliberately ignores args.variant, so changing variant makes reload() see
// "args changed" (which is what makes it consult the cache) while the cache key stays the
// same - that is the only way to reach check_cache_on_reload()'s injecting branch.
class Hc_Card extends Jqhtml_Component {
  on_create() {
    this.data.name = '';
  }

  cache_id() {
    return 'hc_card_' + this.args.id;
  }

  async on_load() {
    // Changing this.data is what marks the component dynamic, which is what makes the
    // framework snapshot its HTML at all. variant is deliberately NOT part of the data:
    // a reload that injects cached HTML re-renders whether or not the fresh data differs.
    this.data.name = 'card ' + this.args.id;
  }

  on_render() {
    // Record what this instance can see about its OWN scoped ids at the moment of the
    // render. The cached render is the interesting one: the markup came from another
    // instance, so before the fix these ids belonged to somebody else.
    const el = this.$sid('name')[0] || null;
    window.__hc_renders.push({
      cid: this._cid,
      cached: !!this._used_cached_html,
      el: el,
      // the element $sid() found is inside THIS card, not another instance's
      own: !!el && el.closest('.Hc_Card') === this.$[0],
      // exactly one element in the whole document carries this card's scoped id
      unique: document.querySelectorAll('[id="name:' + this._cid + '"]').length === 1,
      // stale children must not survive an injection over a live subtree
      dom_children: this._dom_children.size,
    });
  }
}
