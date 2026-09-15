// $() must unwrap a Jqhtml_Component to its root element. The old duck-type test looked
// for an id() method the class never had, so $(component) wrapped the plain object and
// every jQuery call on it was a silent no-op.
class Jquery_Unwraps_Component extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    const $host = this.$sid('host');
    $host.component('Unwrap_Target', {});
    const comp = $host.component();
    await comp.ready();

    console.log('');
    console.log('A. $(component) IS the component\'s jQuery element:');
    const $wrapped = $(comp);
    assert('$(comp)[0] === comp.$[0]', $wrapped[0] === comp.$[0]);
    assert('$(comp).length === 1 -> ' + $wrapped.length, $wrapped.length === 1);
    assert('$(comp) is a jQuery object', $wrapped instanceof $);
    assert('$(comp).is a document element', $wrapped[0] === $host[0]);

    console.log('');
    console.log('B. jQuery methods land on the root element:');
    $(comp).addClass('unwrapped_marker');
    assert('addClass through $(comp) reaches the root element',
           comp.$.hasClass('unwrapped_marker'));
    assert('the class is really in the DOM',
           document.querySelectorAll('.unwrapped_marker').length === 1);

    $(comp).attr('data-unwrapped', 'yes');
    assert('attr through $(comp) reaches the root element',
           comp.$[0].getAttribute('data-unwrapped') === 'yes');

    console.log('');
    console.log('C. traversal works through the unwrapped element:');
    const $inner = $(comp).find('.inner_marker');
    assert('$(comp).find() finds the component\'s own descendant -> ' + $inner.length,
           $inner.length === 1 && $inner[0] === comp.$.find('.inner_marker')[0]);
    assert('$(comp).find() of a scoped element matches $sid()',
           $(comp).find('#label\\:' + comp._cid)[0] === comp.$sid('label')[0]);
    assert('$(comp).children() matches comp.$.children()',
           $(comp).children().length === comp.$.children().length &&
           $(comp).children().length > 0);

    console.log('');
    console.log('D. plain selectors and elements still work:');
    assert('$(element) still wraps an element', $(comp.$[0])[0] === comp.$[0]);
    assert('$("body") still works', $('body').length === 1);
    assert('$(null) is still an empty set', $(null).length === 0);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
