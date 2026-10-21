/**
 * interpolated_attribute_expressions - expressions inside attribute values keep their
 * operator precedence (ternary, &&, ||, comparison), including inside a loop.
 */
class Test_Interpolated_Attributes extends Jqhtml_Component {
  on_ready() {
    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };
    // The div whose text starts with `label`, and its class attribute
    const class_of = (label) => {
      const $el = this.$.children('div').filter((i, el) => $(el).text().trim().startsWith(label));
      return $el.length === 1 ? $el.attr('class') : '(' + $el.length + ' matches)';
    };

    assert('Test 1: class="my-class"', class_of('Test 1') === 'my-class', class_of('Test 1'));
    assert('Test 2: class="active"', class_of('Test 2') === 'active', class_of('Test 2'));
    assert('Test 3: class="static active"', class_of('Test 3') === 'static active', class_of('Test 3'));

    const items = this.$.children('div').filter((i, el) => /^Item \d$/.test($(el).text().trim()));
    const item_classes = items.map((i, el) => $(el).attr('class')).get();
    assert('Test 4: loop classes item-1, item-2, item-3',
      JSON.stringify(item_classes) === JSON.stringify(['item-1', 'item-2', 'item-3']), item_classes);

    const pages = this.$.find('ul.pagination li').map((i, el) => $(el).attr('class').trim()).get();
    assert('Test 5: only page 2 is active',
      JSON.stringify(pages) === JSON.stringify(['page-item', 'page-item active', 'page-item']), pages);

    assert('Test 6: && -> class="visible"', class_of('Test 6') === 'visible', class_of('Test 6'));
    assert('Test 7: || -> class="hidden"', class_of('Test 7') === 'hidden', class_of('Test 7'));
    assert('Test 8: comparison -> class="not-first"', class_of('Test 8') === 'not-first', class_of('Test 8'));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
