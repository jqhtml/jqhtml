// Records console.warn from page load so the on_create() warnings are seen.
(function () {
  const warns = window.__freeze_holes_warns = [];
  const original = console.warn;
  console.warn = function (...args) {
    warns.push(String(args[0]));
    return original.apply(this, args);
  };
})();

class Warn_Target_Model {}
jqhtml.register_cache_class(Warn_Target_Model);
class Warn_Target_Plain_Class {}

// The one-level warning after on_create(): non-simple top-level values of this.data warn,
// simple data and values the cache restores as themselves do not.
class Warn_Target extends Jqhtml_Component {
  on_create() {
    this.data.label = 'ok';
    this.data.count = 3;
    this.data.flag = true;
    this.data.none = null;
    this.data.list = [1, 2];
    this.data.obj = { a: 1 };
    this.data.bare = Object.create(null);
    this.data.when = new Date(0);
    this.data.map = new Map();
    this.data.set = new Set();
    this.data.model = new Warn_Target_Model();
    this.data.nested = { fn: () => 1 };          // a level down: not checked
    this.data.fn = () => 1;
    this.data.node = document.createElement('div');
    this.data.jq = $('<span>');
    this.data.instance = new Warn_Target_Plain_Class();
  }

  on_ready() {
    const assert = window.freeze_holes_assert;
    console.log('');
    console.log('H. WARNING FOR NON-SIMPLE TOP-LEVEL this.data AFTER on_create():');
    const mine = window.__freeze_holes_warns.filter((w) => w.indexOf('<Warn_Target> on_create() set this.data.') !== -1);
    const keys = mine.map((w) => w.match(/this\.data\.(\w+) to/)[1]).sort();
    assert('warned exactly for fn, instance, jq, node -> ' + JSON.stringify(keys),
           JSON.stringify(keys) === JSON.stringify(['fn', 'instance', 'jq', 'node']));
    const said = (key, what) => mine.some((w) => w.indexOf('this.data.' + key + ' to ' + what) !== -1);
    assert('the function is named as a function', said('fn', 'a function'));
    assert('the element is named as a DOM node', said('node', 'a DOM node'));
    assert('the jQuery object is named as one', said('jq', 'a jQuery object'));
    assert('the plain class instance names its class', said('instance', 'an instance of Warn_Target_Plain_Class'));
    assert('simple values survived the copy -> ' + JSON.stringify([this.data.label, this.data.count, this.data.list]),
           this.data.label === 'ok' && this.data.count === 3 && this.data.list.length === 2);
    assert('Date, Map, Set and the registered class survived as themselves',
           this.data.when instanceof Date && this.data.map instanceof Map &&
           this.data.set instanceof Set && this.data.model instanceof Warn_Target_Model);
    assert('the function did not survive the copy', this.data.fn === undefined);
  }
}
