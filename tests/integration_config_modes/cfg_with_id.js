// Same object arg, but cache_id() states identity explicitly - must NOT warn
class Cfg_With_Id extends Jqhtml_Component {
  cache_id() { return 'cfg_with_id_' + this.args.filters.id; }
  on_create() { this.data.v = ''; }
  async on_load() { this.data.v = 'x'; }
}
