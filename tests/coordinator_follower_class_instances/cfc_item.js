window.__cfc = { on_load_started: 0, on_load_done: 0, render_counts: {} };

class Cfc_Item extends Jqhtml_Component {
  on_create() {
    this.data.loaded = false;
  }

  async on_load() {
    window.__cfc.on_load_started++;
    await new Promise((resolve) => setTimeout(resolve, 80));
    this.data = {
      loaded: true,
      price: new Cfc_Money(1250),
      body: new Cfc_Rich_Text('<p>hi</p>'),
      model: new Cfc_Plain_Model(this.args.item_id),
      when: new Date('2021-05-06T07:08:09Z'),
      tags: new Set(['a', 'b']),
      lookup: new Map([['fee', new Cfc_Money(0)]]),
      rows: [{ id: 1, text: new Cfc_Rich_Text('') }]
    };
    window.__cfc.on_load_done++;
  }

  on_render() {
    const counts = window.__cfc.render_counts;
    counts[this._cid] = (counts[this._cid] || 0) + 1;
  }
}
