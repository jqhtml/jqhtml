/**
 * load_flags_child_opt_out
 *
 * Target: packages/core/src/instruction-processor.ts ~254-255
 *
 *   const propagate_load_only = parentArgs?._load_only === true && props._load_only === undefined;
 *   const propagate_load_render_only = parentArgs?._load_render_only === true && props._load_render_only === undefined;
 *
 * A parent component with `_load_only` (or `_load_render_only`) set on its own
 * `this.args` automatically cascades that flag onto every child it invokes in
 * its template, UNLESS the child's own invocation already sets that prop
 * (docs/reference/14_lifecycle_complete_specification.md documents explicit
 * `false`, e.g. `$_load_render_only=false`, as the way a child opts out).
 *
 * NOTE ON TEST DESIGN (boot-skip):
 * boot_component() in lifecycle-manager.ts skips _render() ENTIRELY for a
 * component booted with `_load_only: true` (render_id = 0, no DOM created;
 * see tests/load_only_flag, which asserts exactly this: "No child components
 * created"). Since process_component_to_html (the cascade code under test)
 * only runs *during* a `_render()` pass, the cascade for `_load_only` can
 * never fire during the component's own boot - there is no render pass for
 * it to fire during. It only becomes observable if something later calls
 * `.render()` on that same component while `_load_only` is still true in its
 * args (the public render() API does not gate on the flag - only
 * boot_component's initial dispatch does). This test does exactly that:
 * boot Parent_Component with `_load_only: true` (mirroring tests/load_only_flag
 * to confirm the boot-time truncation still behaves as documented), then
 * explicitly call `parent.render()` to exercise the cascade in
 * instruction-processor.ts against two children declared in its template.
 *
 * REGRESSION NOTE - `$`-prefix key mismatch (found by this test, then fixed):
 * The parser compiles `$`-prefixed component attributes keeping the literal
 * `$` in the key (`$_load_only=false` -> `{"$_load_only": false}`), while the
 * cascade decision and options-forcing check in instruction-processor.ts
 * originally read only the unprefixed `props._load_only` - so a child's
 * template-authored opt-out (or opt-in) was invisible and the cascade always
 * overwrote it. instruction-processor.ts now consults BOTH spellings (the
 * plain key for cascaded/programmatic values, the `$`-prefixed key for
 * template-authored ones) in the cascade condition and the options check.
 * Child_B's assertions below are the regression coverage for that fix: with
 * `$_load_only=false` in its invocation, it must run its FULL lifecycle even
 * though its parent is cascading `_load_only`.
 */

class Test_Load_Flags_Child_Opt_Out extends Jqhtml_Component {
  on_create() {
    window.__cascade_parent_on_load_fired = false;
    window.__cascade_parent_on_render_fired = false;
    window.__cascade_parent_after_load_fired = false;
    window.__cascade_parent_on_ready_fired = false;

    window.__cascade_child_a_on_load_fired = false;
    window.__cascade_child_a_on_render_fired = false;
    window.__cascade_child_a_after_load_fired = false;
    window.__cascade_child_a_on_ready_fired = false;

    window.__cascade_child_b_on_load_fired = false;
    window.__cascade_child_b_on_render_fired = false;
    window.__cascade_child_b_after_load_fired = false;
    window.__cascade_child_b_on_ready_fired = false;
  }

  async on_ready() {
    const $results = this.$sid('results');
    const tests = [];

    console.log('');
    console.log('========================================');
    console.log('TESTING _load_only CASCADE + CHILD OPT-OUT');
    console.log(`Cache mode: ${window.__JQHTML_TEST_CACHE_MODE__ || 'none'}`);
    console.log('========================================');

    // ---- Phase 1: boot Parent_Component with _load_only (mirrors tests/load_only_flag) ----
    const $parent = $('<div>').appendTo($results);
    $parent.component('Parent_Component', { _load_only: true });
    const parent = $parent.component();
    await parent.ready();

    // Allow a tick for any straggling async
    await new Promise(r => setTimeout(r, 50));

    console.log('');
    console.log('-- Phase 1: parent boot-time truncation (_load_only) --');

    if (window.__cascade_parent_on_load_fired === true) {
      console.log('✅ TEST 1 PASS: parent on_load() fired');
      tests.push(true);
    } else {
      console.log('❌ TEST 1 FAIL: parent on_load() did not fire');
      tests.push(false);
    }

    if (window.__cascade_parent_on_render_fired === false) {
      console.log('✅ TEST 2 PASS: parent on_render() suppressed');
      tests.push(true);
    } else {
      console.log('❌ TEST 2 FAIL: parent on_render() fired (should be suppressed by _load_only)');
      tests.push(false);
    }

    if (window.__cascade_parent_after_load_fired === false) {
      console.log('✅ TEST 3 PASS: parent on_loaded() suppressed');
      tests.push(true);
    } else {
      console.log('❌ TEST 3 FAIL: parent on_loaded() fired (should be suppressed by _load_only)');
      tests.push(false);
    }

    if (window.__cascade_parent_on_ready_fired === false) {
      console.log('✅ TEST 4 PASS: parent on_ready() suppressed');
      tests.push(true);
    } else {
      console.log('❌ TEST 4 FAIL: parent on_ready() fired (should be suppressed by _load_only)');
      tests.push(false);
    }

    if (window.__cascade_child_a_on_load_fired === false && window.__cascade_child_b_on_load_fired === false) {
      console.log('✅ TEST 5 PASS: no children created during _load_only boot (render() never ran, so the template - and any cascade - never executed)');
      tests.push(true);
    } else {
      console.log('❌ TEST 5 FAIL: a child fired on_load() before the parent ever ran its template');
      tests.push(false);
    }

    // ---- Phase 2: manually trigger parent.render() to exercise the cascade ----
    // parent.args._load_only is still true here. This render pass is what
    // instruction-processor.ts's process_component_to_html actually sees:
    // parentArgs._load_only === true, so it cascades _load_only onto
    // Child_A (undefined -> inherits) but not onto Child_B (explicitly false -> opts out).
    console.log('');
    console.log('-- Phase 2: manual parent.render() exercises the cascade --');
    await parent.render();

    // Wait for any straggling async in children
    await new Promise(r => setTimeout(r, 50));

    // Child A: no override -> inherits cascaded _load_only -> truncated lifecycle
    if (window.__cascade_child_a_on_load_fired === true) {
      console.log('✅ TEST 6 PASS: Child A on_load() fired (cascaded _load_only still loads data)');
      tests.push(true);
    } else {
      console.log('❌ TEST 6 FAIL: Child A on_load() did not fire');
      tests.push(false);
    }

    if (window.__cascade_child_a_on_render_fired === false) {
      console.log('✅ TEST 7 PASS: Child A on_render() suppressed (cascaded _load_only)');
      tests.push(true);
    } else {
      console.log('❌ TEST 7 FAIL: Child A on_render() fired (cascade should have suppressed it)');
      tests.push(false);
    }

    if (window.__cascade_child_a_after_load_fired === false) {
      console.log('✅ TEST 8 PASS: Child A on_loaded() suppressed (cascaded _load_only)');
      tests.push(true);
    } else {
      console.log('❌ TEST 8 FAIL: Child A on_loaded() fired (cascade should have suppressed it)');
      tests.push(false);
    }

    if (window.__cascade_child_a_on_ready_fired === false) {
      console.log('✅ TEST 9 PASS: Child A on_ready() suppressed (cascaded _load_only)');
      tests.push(true);
    } else {
      console.log('❌ TEST 9 FAIL: Child A on_ready() fired (cascade should have suppressed it)');
      tests.push(false);
    }

    // Child B: explicit $_load_only=false in its template invocation opts out
    // of the parent's cascade and runs the FULL lifecycle (regression coverage
    // for the $-prefix key mismatch fix - see file header).
    console.log('');
    if (window.__cascade_child_b_on_load_fired === true) {
      console.log('✅ TEST 10 PASS: Child B on_load() fired');
      tests.push(true);
    } else {
      console.log('❌ TEST 10 FAIL: Child B on_load() did not fire');
      tests.push(false);
    }

    if (window.__cascade_child_b_on_render_fired === true) {
      console.log('✅ TEST 11 PASS: Child B on_render() fired ($_load_only=false opted out of cascade)');
      tests.push(true);
    } else {
      console.log('❌ TEST 11 FAIL: Child B on_render() suppressed despite $_load_only=false opt-out');
      tests.push(false);
    }

    if (window.__cascade_child_b_after_load_fired === true) {
      console.log('✅ TEST 12 PASS: Child B on_loaded() fired');
      tests.push(true);
    } else {
      console.log('❌ TEST 12 FAIL: Child B on_loaded() suppressed despite opt-out');
      tests.push(false);
    }

    if (window.__cascade_child_b_on_ready_fired === true) {
      console.log('✅ TEST 13 PASS: Child B on_ready() fired');
      tests.push(true);
    } else {
      console.log('❌ TEST 13 FAIL: Child B on_ready() suppressed despite opt-out');
      tests.push(false);
    }

    // DOM sanity checks: Child B's own template rendered real text; Child A's
    // own template never ran, so its wrapper element (created by the PARENT's
    // render regardless of the child's flag - Define IS the element) has no
    // inner text from its own template.
    const $childA = this.$sid('results').find('.child-a');
    const childA_text = $childA.length > 0 ? $childA.text().trim() : '';
    if (childA_text === '') {
      console.log('✅ TEST 14 PASS: Child A has no rendered content (its own render() never ran)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 14 FAIL: Child A shows content "${childA_text}" despite cascaded _load_only`);
      tests.push(false);
    }

    const $childB = this.$sid('results').find('.child-b');
    const childB_text = $childB.length > 0 ? $childB.text().trim() : '';
    if (childB_text !== '') {
      console.log(`✅ TEST 15 PASS: Child B rendered its own content ("${childB_text}")`);
      tests.push(true);
    } else {
      console.log('❌ TEST 15 FAIL: Child B rendered no content despite $_load_only=false opt-out');
      tests.push(false);
    }

    console.log('');
    if (tests.every(t => t)) {
      console.log('✅ ALL TESTS PASSED');
      $results.append('<p style="color: green;">✅ All tests passed</p>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      $results.append('<p style="color: red;">❌ Some tests failed</p>');
    }
    console.log('========================================');

    window.testPassed = tests.every(t => t);
    window.testReady = true;
  }
}
