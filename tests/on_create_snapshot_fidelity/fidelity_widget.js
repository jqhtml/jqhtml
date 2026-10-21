// on_create() puts one of each awkward type into this.data. on_load() records what
// it was handed BEFORE touching anything, then mutates every one of them - so a
// snapshot that aliased the live objects, or copied them lossily, shows up on the
// next on_load().
class Fidelity_Widget extends Jqhtml_Component {
  on_create() {
    this.data.when = new Date('2026-01-02T03:04:05.000Z');
    this.data.by_id = new Map([['a', 1]]);
    this.data.tags = new Set(['x']);
    this.data.nothing = undefined;
    this.data.model = new Fidelity_Model(21);
    this.data.list = [1, undefined, 3];
    this.data.loads = 0;
  }

  async on_load() {
    const d = this.data;
    (window.__fidelity_seen = window.__fidelity_seen || []).push({
      when_is_date: d.when instanceof Date,
      when_ms: d.when instanceof Date ? d.when.getTime() : String(d.when),
      map_is_map: d.by_id instanceof Map,
      map_entries: d.by_id instanceof Map ? JSON.stringify([...d.by_id]) : JSON.stringify(d.by_id),
      set_is_set: d.tags instanceof Set,
      set_items: d.tags instanceof Set ? JSON.stringify([...d.tags]) : JSON.stringify(d.tags),
      has_nothing_key: Object.prototype.hasOwnProperty.call(d, 'nothing'),
      nothing_is_undefined: d.nothing === undefined,
      model_is_instance: d.model instanceof Fidelity_Model,
      model_doubled: d.model instanceof Fidelity_Model ? d.model.doubled() : null,
      list_length: Array.isArray(d.list) ? d.list.length : -1,
      list_hole_undefined: Array.isArray(d.list) && 1 in d.list && d.list[1] === undefined,
      loads: d.loads,
      keys: Object.keys(d).join(','),
    });

    // Mutate everything on_create() set
    d.when.setUTCFullYear(1999);
    d.by_id.set('b', 2);
    d.tags.add('y');
    d.nothing = 'something';
    d.model.n = 1000;
    d.list.push(4);
    d.loads = d.loads + 1;
  }
}
