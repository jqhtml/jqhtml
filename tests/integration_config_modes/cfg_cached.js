// No cache_id() - an object arg makes this uncacheable
class Cfg_Cached extends Jqhtml_Component {
  on_create() { this.data.v = ''; }
  async on_load() { this.data.v = 'x'; }
}
