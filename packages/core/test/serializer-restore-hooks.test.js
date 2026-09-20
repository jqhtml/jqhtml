/**
 * Unit tests for register_cache_class() restore hooks and for the rule that
 * BOTH copies the framework makes of on_load() data go through one serializer:
 *
 *   path A - normalize_for_cache(): every on_load() result becomes this.data
 *            through it, and it is what the localStorage cache stores/returns.
 *   path B - Load_Coordinator: a deduplicated follower's copy of its leader's
 *            data (serialize() in _complete_coordination, deserialize() in
 *            get_leader_data).
 *
 * Before this, path B was a plain JSON.stringify/JSON.parse round trip. That
 * consulted every instance's toJSON() and handed followers a wire form nothing
 * could restore, so a page rendered against instances on the leader and against
 * plain objects on every follower - intermittently, because whether a follower
 * exists is a render-timing race.
 */

import { Jqhtml_Local_Storage, Load_Coordinator, register_cache_class } from '../dist/index.js';

const normalize = (v) => Jqhtml_Local_Storage.normalize_for_cache(v);

/** Run a value through the coordinator hand-off exactly as _load() does. */
function through_coordinator(value, key) {
  const leader = { _cid: 'leader' };
  const follower = { _cid: 'follower' };
  expect(Load_Coordinator.should_execute_on_load(leader, key)).toBe(true);
  const complete = Load_Coordinator.register_leader(leader, key);
  expect(Load_Coordinator.should_execute_on_load(follower, key)).toBe(false);
  complete(value);
  return Load_Coordinator.get_leader_data(follower, key);
}

// A class whose wire form is NOT its own properties: toJSON() renames the field
// and adds a derived flag, so JSON.parse(JSON.stringify(x)) is unrecognisable.
class Hook_Rich_Text {
  constructor(raw) { this._raw = raw; }
  toJSON() { return { __TEXT: 'Hook_Rich_Text', raw: this._raw, empty: this._raw.length === 0 }; }
  static from_plain(plain) { return new Hook_Rich_Text(plain.raw); }
  is_empty() { return this._raw.length === 0; }
}
register_cache_class(Hook_Rich_Text, { from_plain: Hook_Rich_Text.from_plain });

// Explicit to_plain: state lives in a private field, so own props are empty.
class Hook_Money {
  #cents;
  constructor(cents) { this.#cents = cents; }
  get cents() { return this.#cents; }
  is_zero() { return this.#cents === 0; }
}
register_cache_class(Hook_Money, {
  to_plain: (money) => money.cents,
  from_plain: (cents) => new Hook_Money(cents),
});

// Registered with NO options but defining toJSON(): the own-props path must
// bypass toJSON() (4.1 alone fixes this class on the coordinator path).
class Hook_Tagged {
  constructor(id) { this.id = id; }
  toJSON() { return { wire: this.id }; }
  describe() { return 'tagged#' + this.id; }
}
register_cache_class(Hook_Tagged);

describe('register_cache_class - options validation', () => {
  it('rejects to_plain without from_plain', () => {
    class Half {}
    expect(() => register_cache_class(Half, { to_plain: (x) => x })).toThrow(/from_plain/);
  });

  it('still rejects an unnamed constructor', () => {
    expect(() => register_cache_class(function () {})).toThrow(/named class/);
  });
});

describe('restore hooks - path A (normalize_for_cache)', () => {
  it('rebuilds a toJSON() class through from_plain with the prototype intact', () => {
    const out = normalize({ body: new Hook_Rich_Text('<p>x</p>') });
    expect(out.body).toBeInstanceOf(Hook_Rich_Text);
    expect(out.body.is_empty()).toBe(false);
    expect(out.body._raw).toBe('<p>x</p>');
  });

  it('uses toJSON() as the default to_plain when from_plain is given', () => {
    const text = Jqhtml_Local_Storage.serialize(new Hook_Rich_Text(''));
    expect(JSON.parse(text)).toEqual({
      __jqhtml_class__: 'Hook_Rich_Text',
      __jqhtml_props__: { __TEXT: 'Hook_Rich_Text', raw: '', empty: true },
    });
  });

  it('rebuilds a private-field class through an explicit to_plain', () => {
    const out = normalize({ price: new Hook_Money(0), other: new Hook_Money(1250) });
    expect(out.price).toBeInstanceOf(Hook_Money);
    expect(out.price.is_zero()).toBe(true);
    expect(out.other.cents).toBe(1250);
  });

  it('bypasses toJSON() for a class registered without options', () => {
    const out = normalize({ t: new Hook_Tagged(3) });
    expect(out.t).toBeInstanceOf(Hook_Tagged);
    expect(out.t.id).toBe(3);
    expect(out.t.describe()).toBe('tagged#3');
  });

  it('walks the plain form, so instances nested inside it are rebuilt too', () => {
    class Hook_Bag {
      constructor(items) { this.items = items; }
      toJSON() { return { list: this.items }; }
      static from_plain(p) { return new Hook_Bag(p.list); }
    }
    register_cache_class(Hook_Bag, { from_plain: Hook_Bag.from_plain });
    const out = normalize({ bag: new Hook_Bag([new Hook_Money(5), new Date('2020-01-01T00:00:00Z')]) });
    expect(out.bag).toBeInstanceOf(Hook_Bag);
    expect(out.bag.items[0]).toBeInstanceOf(Hook_Money);
    expect(out.bag.items[0].cents).toBe(5);
    expect(out.bag.items[1]).toBeInstanceOf(Date);
  });

  it('drops a value whose to_plain throws, and keeps the rest', () => {
    class Hook_Explodes {}
    register_cache_class(Hook_Explodes, {
      to_plain: () => { throw new Error('boom'); },
      from_plain: () => new Hook_Explodes(),
    });
    const out = normalize({ ok: 1, bad: new Hook_Explodes(), list: [new Hook_Explodes(), 2] });
    expect(out).toEqual({ ok: 1, list: [null, 2] });
  });
});

describe('built-ins go through the same hook', () => {
  it('still reconstructs Date, Map and Set', () => {
    const out = normalize({
      d: new Date('2020-01-02T03:04:05Z'),
      m: new Map([['a', 1], [2, 'b']]),
      s: new Set([1, 'x']),
    });
    expect(out.d).toBeInstanceOf(Date);
    expect(out.d.toISOString()).toBe('2020-01-02T03:04:05.000Z');
    expect(out.m).toBeInstanceOf(Map);
    expect([...out.m.entries()]).toEqual([['a', 1], [2, 'b']]);
    expect(out.s).toBeInstanceOf(Set);
    expect([...out.s]).toEqual([1, 'x']);
  });

  it('keeps the stored wire form the cache has always used', () => {
    expect(JSON.parse(Jqhtml_Local_Storage.serialize(new Date('2020-01-01T00:00:00Z'))))
      .toEqual({ __jqhtml_class__: 'Date', __jqhtml_props__: '2020-01-01T00:00:00.000Z' });
    expect(JSON.parse(Jqhtml_Local_Storage.serialize(new Map([['k', 'v']]))))
      .toEqual({ __jqhtml_class__: 'Map', __jqhtml_props__: [['k', 'v']] });
    expect(JSON.parse(Jqhtml_Local_Storage.serialize(new Set(['v']))))
      .toEqual({ __jqhtml_class__: 'Set', __jqhtml_props__: ['v'] });
  });

  it('rebuilds registered instances stored as Map values', () => {
    const out = normalize({ m: new Map([['price', new Hook_Money(7)]]) });
    expect(out.m.get('price')).toBeInstanceOf(Hook_Money);
    expect(out.m.get('price').cents).toBe(7);
  });

  it('serializes a Date subclass as a Date', () => {
    class Special_Date extends Date {}
    const out = normalize({ d: new Special_Date('2020-01-01T00:00:00Z') });
    expect(out.d).toBeInstanceOf(Date);
    expect(out.d.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('one serializer - path B (Load_Coordinator hand-off) matches path A', () => {
  const build = () => ({
    body: new Hook_Rich_Text('<p>hi</p>'),
    price: new Hook_Money(1250),
    tagged: new Hook_Tagged(9),
    when: new Date('2021-05-06T07:08:09Z'),
    tags: new Set(['a']),
    lookup: new Map([['k', new Hook_Money(0)]]),
    rows: [{ id: 1, text: new Hook_Rich_Text('') }],
  });

  it('a follower gets live instances, not toJSON() wire forms', () => {
    const leader_data = normalize(build());
    const follower_data = through_coordinator(leader_data, 'Hook::{"id":1}');

    expect(follower_data.body).toBeInstanceOf(Hook_Rich_Text);
    expect(follower_data.body.is_empty()).toBe(false);
    expect(follower_data.price).toBeInstanceOf(Hook_Money);
    expect(follower_data.price.cents).toBe(1250);
    expect(follower_data.tagged).toBeInstanceOf(Hook_Tagged);
    expect(follower_data.tagged.describe()).toBe('tagged#9');
    expect(follower_data.when).toBeInstanceOf(Date);
    expect(follower_data.tags).toBeInstanceOf(Set);
    expect(follower_data.lookup).toBeInstanceOf(Map);
    expect(follower_data.lookup.get('k')).toBeInstanceOf(Hook_Money);
    expect(follower_data.rows[0].text).toBeInstanceOf(Hook_Rich_Text);
    expect(follower_data.rows[0].text.is_empty()).toBe(true);
  });

  it('the follower copy deep-equals the leader copy and shares no objects', () => {
    const leader_data = normalize(build());
    const follower_data = through_coordinator(leader_data, 'Hook::{"id":2}');

    expect(Jqhtml_Local_Storage.serialize(follower_data)).toBe(Jqhtml_Local_Storage.serialize(leader_data));
    expect(follower_data).not.toBe(leader_data);
    expect(follower_data.body).not.toBe(leader_data.body);
    expect(follower_data.rows).not.toBe(leader_data.rows);
  });

  it('normalizing the follower copy again (as _apply_load_result does) is a no-op', () => {
    const leader_data = normalize(build());
    const follower_data = normalize(through_coordinator(leader_data, 'Hook::{"id":3}'));
    expect(Jqhtml_Local_Storage.serialize(follower_data)).toBe(Jqhtml_Local_Storage.serialize(leader_data));
    expect(Object.getPrototypeOf(follower_data.body)).toBe(Hook_Rich_Text.prototype);
  });

  it('a JSON round trip would NOT have preserved the prototypes (the old defect)', () => {
    const plain = JSON.parse(JSON.stringify(normalize(build())));
    expect(plain.body).not.toBeInstanceOf(Hook_Rich_Text);
    expect(plain.body).toEqual({ __TEXT: 'Hook_Rich_Text', raw: '<p>hi</p>', empty: false });
    // ...and normalize_for_cache cannot recognise that wire form either
    expect(normalize(plain).body).not.toBeInstanceOf(Hook_Rich_Text);
  });

  it('leaves the registry empty once the last follower has collected', () => {
    through_coordinator({ a: 1 }, 'Hook::{"id":4}');
    expect(Load_Coordinator.get_coordination_promise('Hook::{"id":4}')).toBeNull();
    expect(Load_Coordinator.get_leader_data({ _cid: 'late' }, 'Hook::{"id":4}')).toBeNull();
  });
});
