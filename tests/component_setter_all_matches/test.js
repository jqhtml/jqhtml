// $(selector).component('Name', args) must create one instance on EVERY matched element
// (it used this.first(), so the rest stayed plain elements), each with its own shallow
// copy of args, and return the set for chaining. The getter returns the first match's
// component and warns when the set holds more than one element.
class Component_Setter_All_Matches extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    // ---------------------------------------------------------------------------
    console.log('');
    console.log('A. SETTER ON THREE MATCHES CREATES THREE INDEPENDENT INSTANCES:');
    const shared = { n: 1 };
    const args = { theme: 'dark', shared };
    const $set = this.$sid('host_a').find('.slot');
    assert('the selector matched three elements', $set.length === 3);

    const $ret = $set.component('Multi_Card', args);

    const comps = $set.toArray().map((el) => $(el).data('_component'));
    assert('every matched element holds a component',
           comps.every((c) => c instanceof Jqhtml_Component));
    assert('every component is a Multi_Card',
           comps.every((c) => c && c.component_name() === 'Multi_Card'));
    const cids = comps.map((c) => c && c._cid);
    assert('the three _cid values are distinct -> ' + cids.join(','),
           new Set(cids).size === 3 && cids.every((c) => c !== undefined));

    if (comps.every((c) => c)) {
      await Promise.all(comps.map((c) => c.ready()));
    }
    assert('all three booted and fired on_ready -> ' + window.__mc_ready, window.__mc_ready === 3);
    assert('all three rendered', $set.find('.label').length === 3);

    const themes = comps.map((c) => c && c.args.theme);
    assert('the first instance changed its own top-level arg -> ' + themes.join(','),
           themes[0] === 'mutated');
    assert('the other instances kept their own copy', themes[1] === 'dark' && themes[2] === 'dark');
    assert('the caller\'s args object was not modified', args.theme === 'dark' && !('_component_name' in args));
    assert('nested objects stay shared',
           comps.every((c) => c && c.args.shared === shared));

    console.log('');
    console.log('B. CHAINING RETURNS THE SAME jQuery SET:');
    assert('the setter returns the original jQuery object', $ret === $set);
    assert('the returned set still holds three elements -> ' + $ret.length, $ret.length === 3);

    // ---------------------------------------------------------------------------
    console.log('');
    console.log('C. SETTER OVER FRESH ELEMENTS AND EXISTING COMPONENTS REPLACES THE EXISTING ONES:');
    const $c = this.$sid('host_c').find('.slot');
    $c.eq(0).component('Old_Card', {});
    $c.eq(2).component('Old_Card', {});
    const olds = [$c.eq(0).component(), $c.eq(2).component()];
    await Promise.all(olds.map((o) => o.ready()));
    assert('two of the three elements start as Old_Card',
           olds.every((o) => o && o.component_name() === 'Old_Card') && !$c.eq(1).component());

    $c.component('Multi_Card', { theme: 'mix' });
    const mixed = $c.toArray().map((el) => $(el).data('_component'));
    assert('every element now holds a Multi_Card',
           mixed.every((m) => m && m.component_name() === 'Multi_Card'));
    assert('the old components were stopped -> ' + window.__old_stopped,
           window.__old_stopped === 2 && olds.every((o) => o._stopped));
    assert('the old component class was removed', $c.filter('.Old_Card').length === 0);
    assert('three new distinct instances',
           mixed.every((m) => m && m._cid) && new Set(mixed.map((m) => m && m._cid)).size === 3);
    if (mixed.every((m) => m)) await Promise.all(mixed.map((m) => m.ready()));
    assert('all three replacements rendered', $c.find('.label').length === 3 && $c.find('.old').length === 0);

    // ---------------------------------------------------------------------------
    const warnings = [];
    const original_warn = console.warn;
    console.warn = function (...a) {
      const text = a.map(String).join(' ');
      if (text.includes('.component() getter')) warnings.push(text);
      return original_warn.apply(this, a);
    };
    try {
      console.log('');
      console.log('D. GETTER ON ONE MATCH RETURNS IT WITHOUT A WARNING:');
      const one = $set.eq(1).component();
      assert('the getter returns that element\'s component', one === comps[1]);
      assert('no warning was logged -> ' + warnings.length, warnings.length === 0);

      console.log('');
      console.log('E. GETTER ON SEVERAL MATCHES RETURNS THE FIRST AND WARNS ONCE PER CALL:');
      const first = $set.component();
      assert('the getter returns the first element\'s component', first === comps[0]);
      assert('exactly one warning for the call -> ' + warnings.length, warnings.length === 1);
      assert('the warning names the count -> ' + warnings[0], !!warnings[0] && warnings[0].includes('3 elements'));
      $set.component();
      assert('a second call warns once more -> ' + warnings.length, warnings.length === 2);
    } finally {
      console.warn = original_warn;
    }

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
