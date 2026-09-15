// cache_id() ignores args.variant, and so does on_load(): changing variant makes reload()
// see "args changed" (which is what makes it consult the cache and inject the snapshot)
// while the cache key AND the freshly loaded data both stay the same. That is exactly the
// case where the post-load render decision used to say "nothing changed, don't render",
// leaving the injected snapshot on screen as inert markup with no live children.
class Hcw_Card extends Jqhtml_Component {
  on_create() {
    this.data.name = '';
  }

  cache_id() {
    return 'hcw_card_' + this.args.id;
  }

  async on_load() {
    this.data.name = 'card ' + this.args.id;
  }
}
