// Runs in every cache mode: the round trip is no longer a 'data'-mode behaviour.
const VALID_MODES = ['none', 'data', 'html'];

class Load_Result_Normalized extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const stage = this.$sid('stage');

    // The harness turns on jqhtml.debug.verbose, which makes the serializer print
    // its own per-value chatter. Turn it off so console.warn carries only the
    // once-only development warnings this test is about.
    window.jqhtml.debug.verbose = false;

    // Capture the stripped-value warnings. They are the only console.warn that
    // starts "[JQHTML] <Name> dropped ", so nothing else can be counted by accident.
    const captured = [];
    const real_warn = console.warn;
    console.warn = function (...warn_args) {
      const message = String(warn_args[0]);
      if (message.indexOf('[JQHTML] <') === 0 && message.indexOf(' dropped ') !== -1) {
        captured.push({ message: message, meta: warn_args[1] || {} });
      }
      return real_warn.apply(console, warn_args);
    };

    try {
      const sink = $('<div>').appendTo(stage).component('Lrn_Sink', {}).component();
      await sink.ready();

      const returned = window.__lrn_returned;
      const data = sink.data;

      console.log('');
      console.log('A. VALUES THE SERIALIZER RECONSTRUCTS:');
      assert('this.data.when is a real Date -> ' + (data.when instanceof Date),
             data.when instanceof Date);
      assert('the Date kept its value -> ' + (data.when instanceof Date && data.when.toISOString()),
             data.when instanceof Date && data.when.toISOString() === '2020-01-02T03:04:05.000Z');
      assert('this.data.lookup is a real Map -> ' + (data.lookup instanceof Map),
             data.lookup instanceof Map);
      assert('the Map kept its entries -> ' + (data.lookup instanceof Map && data.lookup.get('a')),
             data.lookup instanceof Map && data.lookup.size === 2 && data.lookup.get('a') === 1);
      assert('this.data.tags is a real Set -> ' + (data.tags instanceof Set), data.tags instanceof Set);
      assert('the Set kept its items -> ' + (data.tags instanceof Set && data.tags.has('x')),
             data.tags instanceof Set && data.tags.size === 2 && data.tags.has('x'));
      assert('a registered class comes back as an instance',
             data.model instanceof window.Lrn_Registered);
      assert('its prototype method is callable -> ' +
             (data.model instanceof window.Lrn_Registered && data.model.describe()),
             data.model instanceof window.Lrn_Registered && data.model.describe() === 'registered#5');

      console.log('');
      console.log('B. AN UNREGISTERED CLASS DEGRADES TO A PLAIN OBJECT:');
      assert('it is no longer an instance', !(data.plain_model instanceof window.Lrn_Unregistered));
      assert('it is a plain object', Object.getPrototypeOf(data.plain_model) === Object.prototype);
      assert('its method is gone', data.plain_model.describe === undefined);
      assert('its own properties survived -> ' + Object.keys(data.plain_model).join(','),
             JSON.stringify(Object.keys(data.plain_model).sort()) === JSON.stringify(['kind', 'name']) &&
             data.plain_model.name === 'bob');

      console.log('');
      console.log('C. VALUES THE SERIALIZER CANNOT REPRESENT ARE STRIPPED:');
      assert('the function property is gone', !('on_select' in data));
      assert('the jQuery object is gone', !('$el' in data));
      assert('the DOM node is gone', !('node' in data));
      assert('the promise is gone', !('pending' in data));
      assert('a nested function is gone', data.rows[0].on_click === undefined);
      assert('the cycle was cut, not followed', !('self' in data));
      assert('the nested cycle was cut', data.rows[0].parent === undefined);
      assert('the surrounding data survived the strips -> ' + data.rows[0].id, data.rows[0].id === 1);

      console.log('');
      console.log('D. this.data IS JQHTML\'S OWN COPY:');
      assert('the two shared references became separate objects', data.first !== data.second);
      assert('...that are still deep-equal -> ' + JSON.stringify(data.first),
             JSON.stringify(data.first) === JSON.stringify(data.second));
      assert('this.data is not the object on_load() returned', data !== returned);
      assert('nested values are copies too', data.when !== returned.when && data.first !== returned.first);

      returned.first.tag = 'mutated_after_load';
      assert('mutating the returned object does not reach this.data -> ' + data.first.tag,
             data.first.tag === 'shared');

      console.log('');
      console.log('E. EXACTLY ONE WARNING PER STRIPPED PATH:');
      const expected_paths = [
        'this.data.on_select',
        'this.data.$el',
        'this.data.node',
        'this.data.pending',
        'this.data.plain_model',
        'this.data.self',
        'this.data.rows[0].on_click',
        'this.data.rows[0].parent'
      ].sort();

      const seen_paths = captured.map((entry) => entry.meta.path).sort();
      assert('every stripped path warned -> ' + seen_paths.join(' | '),
             JSON.stringify(seen_paths) === JSON.stringify(expected_paths));

      let well_formed = 0;
      for (const entry of captured) {
        const names_component = entry.message.indexOf('<Lrn_Sink>') !== -1;
        const names_path = entry.message.indexOf(entry.meta.path) !== -1;
        const names_destination = entry.message.indexOf('this.args') !== -1 ||
                                  entry.message.indexOf('this.state') !== -1 ||
                                  entry.message.indexOf('register_cache_class') !== -1;
        if (names_component && names_path && names_destination) well_formed++;
        else console.log('   (malformed) ' + entry.message);
      }
      assert('every warning names the component, the path and a destination -> ' +
             well_formed + '/' + captured.length,
             captured.length > 0 && well_formed === captured.length);

      const after_first_load = captured.length;

      await sink.reload();
      assert('a second load of the same component warns again 0 times -> ' +
             (captured.length - after_first_load),
             captured.length === after_first_load);

      const second_instance = $('<div>').appendTo(stage).component('Lrn_Sink', {}).component();
      await second_instance.ready();
      assert('a second INSTANCE of the same component warns again 0 times -> ' +
             (captured.length - after_first_load),
             captured.length === after_first_load);
      assert('the second instance was normalized too',
             second_instance.data.when instanceof Date && !('on_select' in second_instance.data));

      console.log('');
      console.log('F. PRODUCTION MODE CONVERTS SILENTLY:');
      window.jqhtml.configure({ mode: 'production' });
      assert('mode is production -> ' + window.jqhtml.get_config().mode,
             window.jqhtml.get_config().mode === 'production');

      const prod = $('<div>').appendTo(stage).component('Lrn_Prod', {}).component();
      await prod.ready();

      assert('a never-seen component name emitted no warning -> ' +
             (captured.length - after_first_load),
             captured.length === after_first_load);
      assert('...but its data was still normalized',
             prod.data.when instanceof Date && !('on_select' in prod.data) &&
             prod.data.model instanceof window.Lrn_Registered);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    } finally {
      console.warn = real_warn;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
