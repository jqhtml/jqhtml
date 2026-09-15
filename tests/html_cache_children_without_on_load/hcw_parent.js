// Dynamic (on_load() changes this.data), so html mode snapshots it - which means its
// ready phase waits for every child's render to complete first.
class Hcw_Parent extends Jqhtml_Component {
  on_create() {
    this.data.title = '';
  }

  cache_id() {
    return 'hcw_parent';
  }

  async on_load() {
    this.data.title = 'parent';
  }
}
