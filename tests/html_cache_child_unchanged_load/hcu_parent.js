// Dynamic (on_load() changes this.data), so html mode snapshots it - which means its
// ready phase waits for every child's DOM to be final first.
//
// cache_id() ignores args.seed: a $seed=true instance renders a template-only child
// (which never hung the wait) and writes the same snapshot key, so the cache-hit boot can
// be set up without depending on the unchanged-load child that is under test.
class Hcu_Parent extends Jqhtml_Component {
  on_create() {
    this.data.title = '';
  }

  cache_id() {
    return 'hcu_parent';
  }

  async on_load() {
    this.data.title = 'parent loaded';
  }

  on_render() {
    // A render showing the loaded title while this.data still holds the on_create()
    // default can only be the injected html snapshot: proof of a cache-hit boot.
    if (this.data.title === '' && this.$.text().indexOf('parent loaded') !== -1) {
      window.__hcu_parent_cache_injections = (window.__hcu_parent_cache_injections || 0) + 1;
    }
  }
}
