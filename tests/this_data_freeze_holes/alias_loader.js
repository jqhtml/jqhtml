// With on_load(): until the load result replaces it, this.data was on_create()'s raw
// objects too, so the first render saw the same aliasing hole.
class Alias_Loader extends Jqhtml_Component {
  on_create() {
    this.state.list = this.data.list = [];
    this.data.loaded = false;
  }

  on_render() {
    if (this.state.checked_first_render) return;
    this.state.checked_first_render = true;

    const assert = window.freeze_holes_assert;
    console.log('');
    console.log('G. on_create() ALIASING CANNOT REACH FROZEN DATA BEFORE on_load() FINISHES:');
    assert('first render sees on_create() data -> loaded=' + this.data.loaded, this.data.loaded === false);
    this.state.list.push('x');
    assert('this.state.list.push("x") left this.data.list empty -> ' + JSON.stringify(this.data.list),
           this.data.list.length === 0);
    assert('this.data.list is not the array this.state holds', this.data.list !== this.state.list);
  }

  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 30));
    window.__freeze_holes_on_load_list = JSON.stringify(this.data.list);
    this.data.loaded = true;
  }

  on_ready() {
    const assert = window.freeze_holes_assert;
    assert('on_load() started from the on_create() list -> ' + window.__freeze_holes_on_load_list,
           window.__freeze_holes_on_load_list === '[]');
    assert('after load this.data.list is still empty -> ' + JSON.stringify(this.data.list),
           this.data.list.length === 0 && this.data.loaded === true);
  }
}
