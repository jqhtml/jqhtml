/**
 * lifecycle_bottom_up_timing - asserts the ORDER of on_ready() START/END entries the
 * components push to window.__bottom_up_log (not their timing):
 *   - bottom-up: each sibling starts only after both its children ended, and the root
 *     starts only after all three siblings ended;
 *   - parallel within a level: every component of a level starts before any of that
 *     level ends (sequential execution would interleave START/END).
 */
class Lifecycle_Test extends Jqhtml_Component {
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

    const log = window.__bottom_up_log || [];
    const at = (entry) => log.indexOf(entry);
    const siblings = ['A', 'B', 'C'];
    const children = [];
    for (const s of siblings) children.push(s + '_child1', s + '_child2');
    const all = ['Root', ...siblings.map((s) => 'Sibling_' + s), ...children.map((c) => 'Child_' + c)];

    console.log('Order: ' + log.join(', '));

    // Every component ran on_ready() once, under its own $id (args reach every level)
    assert('20 entries: START and END for each of the 10 components', log.length === 20, log.length);
    for (const name of all) {
      assert(name + ': START then END', at(name + ' START') >= 0 && at(name + ' START') < at(name + ' END'));
    }

    // Bottom-up
    for (const s of siblings) {
      const last_child_end = Math.max(at('Child_' + s + '_child1 END'), at('Child_' + s + '_child2 END'));
      assert('Sibling_' + s + ' starts after both its children ended', at('Sibling_' + s + ' START') > last_child_end);
    }
    const last_sibling_end = Math.max(...siblings.map((s) => at('Sibling_' + s + ' END')));
    assert('Root starts after all siblings ended', at('Root START') > last_sibling_end);

    // Parallel within a level
    const level_parallel = (names) => {
      const last_start = Math.max(...names.map((n) => at(n + ' START')));
      const first_end = Math.min(...names.map((n) => at(n + ' END')));
      return last_start < first_end;
    };
    assert('the 6 children all start before any child ends', level_parallel(children.map((c) => 'Child_' + c)));
    assert('the 3 siblings all start before any sibling ends', level_parallel(siblings.map((s) => 'Sibling_' + s)));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
