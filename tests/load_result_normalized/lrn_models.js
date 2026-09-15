/**
 * Model classes and the payload builder for the load_result_normalized test.
 *
 * Lrn_Registered is registered with jqhtml.register_cache_class() so the cache
 * serializer can reconstruct it. Lrn_Unregistered deliberately is not.
 */

class Lrn_Registered {
  constructor(id) {
    this.id = id;
    this.kind = 'registered';
  }
  describe() {
    return 'registered#' + this.id;
  }
}

class Lrn_Unregistered {
  constructor(name) {
    this.name = name;
    this.kind = 'unregistered';
  }
  describe() {
    return 'unregistered:' + this.name;
  }
}

window.Lrn_Registered = Lrn_Registered;
window.Lrn_Unregistered = Lrn_Unregistered;
window.jqhtml.register_cache_class(Lrn_Registered);

/**
 * One object holding every category the serializer has to handle: values it
 * reconstructs, values it degrades, values it drops, a shared reference and a
 * cycle. Built fresh per call so each load returns a distinct graph.
 */
window.__lrn_make_payload = function () {
  const shared = { tag: 'shared', n: 7 };

  const payload = {
    when: new Date('2020-01-02T03:04:05Z'),
    lookup: new Map([['a', 1], ['b', 2]]),
    tags: new Set(['x', 'y']),
    model: new Lrn_Registered(5),
    plain_model: new Lrn_Unregistered('bob'),

    on_select: function () { return 'callback'; },
    $el: window.$('<div class="lrn-el">hi</div>'),
    node: document.createElement('span'),
    pending: Promise.resolve('later'),

    first: shared,
    second: shared,

    rows: [{ id: 1, on_click: function () { return 'row-callback'; } }]
  };

  payload.self = payload;             // cycle at the root
  payload.rows[0].parent = payload;   // cycle from inside an array

  return payload;
};
