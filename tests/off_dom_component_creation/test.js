/**
 * off_dom_component_creation - a component created with $('<div>').component() boots its
 * whole subtree off-DOM (bottom-up), sid()/$sid() work there, and the result is intact
 * once it is attached.
 */
class Off_DOM_Test extends Jqhtml_Component {
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

    // Base_Component.on_ready() awaited the off-DOM boot and the attach, so it is done.
    const log = window.__off_dom_log || [];
    assert('order: Fourth on_ready, Third on_ready, Second on_ready, then attach',
      JSON.stringify(log) === JSON.stringify(['Fourth_Level_Child.on_ready', 'Third_Level_Child.on_ready', 'Second_Component.on_ready', 'attach']), log);

    const seen = window.__off_dom_seen || {};
    assert('Second_Component.on_ready() ran off-DOM', seen.connected === false, seen.connected);
    assert('sid("child") found Third_Level_Child off-DOM', seen.child_is_third_level === true);
    assert('$sid("deep_child") found Fourth_Level_Child off-DOM', seen.deep_child_found === true);

    const before = window.__off_dom_before_attach || {};
    assert('still detached and ready just before attach', before.connected === false && before.ready === true, before);
    assert('text was set off-DOM, before attach', before.text === 'Modified by Second_Component', before.text);

    const base = this.$.find('.Base_Component').component();
    const $second = base.$sid('off_dom_target').children('.Second_Component');
    assert('Second_Component attached inside Base_Component', $second.length === 1 && $second[0].isConnected);
    const $fourth = $second.find('.Fourth_Level_Child');
    assert('after attach, Fourth_Level_Child text is "Modified by Second_Component"',
      $fourth.text().trim() === 'Modified by Second_Component', $fourth.text().trim());

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
