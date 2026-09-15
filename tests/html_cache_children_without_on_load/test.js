// The two html-cache defects found during the fix series:
//   25. a parent whose child has no on_load() hangs waiting for that child's post-load
//       render, which never comes
//   26. a cache-injecting reload() whose data comes back unchanged never re-renders, so
//       the injected snapshot stays on screen as inert markup with no live children
const VALID_MODES = ['html'];

class Html_Cache_Children_Without_On_Load extends Jqhtml_Component {
  on_create() {
    // Must be on_create(): a second set_cache_key() call is a cache reset, and children
    // created before it would have booted against a different key.
    window.jqhtml.set_cache_key('html_cache_children_without_on_load_key', 'html');
    window.__hcw_leaf_readies = 0;
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    if (!VALID_MODES.includes(mode)) {
      console.log('[SKIP] Test only applies to modes: ' + VALID_MODES.join(', ') + ' (current: ' + mode + ')');
      console.log('SUMMARY: skipped (mode ' + mode + ')');
      window.testPassed = true;
      return;
    }

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    const with_timeout = (promise, ms) =>
      Promise.race([promise.then(() => 'done'), new Promise(r => setTimeout(() => r('timeout'), ms))]);

    const live_children_of = ($el) => $el.find('.Component').filter(function () {
      const c = $(this).data('_component');
      return !!c && !c._stopped;
    });

    // ---------------------------------------------------------------------------
    // A. A PARENT WHOSE CHILD HAS NO on_load() STILL REACHES ready()
    //    Hcw_Parent is dynamic, so html mode makes its ready phase wait for every
    //    child's render to complete before snapshotting. Hcw_Leaf has no on_load(),
    //    so it never reaches the post-load render the wait used to poll for.
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('A. PARENT WITH A TEMPLATE-ONLY CHILD (no on_load):');
    const $parent = $('<div>').appendTo(this.$sid('parent_host'));
    $parent.component('Hcw_Parent', {});
    const parent = $parent.component();

    const parent_result = await with_timeout(parent.ready(), 1000);
    assert('the parent reached ready() within 1s -> ' + parent_result, parent_result === 'done');

    if (parent_result === 'done') {
      assert('the parent rendered its loaded data -> ' + parent.$sid('title').text(),
             parent.$sid('title').text() === 'parent');
      const leaf = parent.$sid('leaf').data('_component');
      assert('the template-only child is a live component', !!leaf && !leaf._stopped);
      assert('the child reached ready -> _ready_state ' + (leaf && leaf._ready_state),
             !!leaf && leaf._ready_state === 4);
      assert('the child was marked render-complete', !!leaf && leaf._on_render_complete === true);
      const keys = Object.keys(window.localStorage).filter(k => k.indexOf('hcw_parent') !== -1);
      assert('the parent got as far as writing its html snapshot -> ' + keys.length + ' key(s)',
             keys.length > 0);
    }

    // ---------------------------------------------------------------------------
    // B. A CACHE-INJECTING reload() WHOSE DATA COMES BACK UNCHANGED RE-RENDERS
    //    variant is in neither cache_id() nor on_load(), so the reload sees changed
    //    args (consults the cache, injects the snapshot) but unchanged data.
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('B. RELOAD THAT INJECTS CACHED HTML AND LOADS UNCHANGED DATA:');
    const $card = $('<div>').appendTo(this.$sid('card_host'));
    $card.component('Hcw_Card', { id: 1 });
    const card = $card.component();
    await card.ready();

    assert('the warm card rendered -> ' + card.$sid('name').text(),
           card.$sid('name').text() === 'card 1');
    assert('the warm card has one live child', live_children_of(card.$).length === 1);

    const data_before = JSON.stringify(card.data);
    card.args.variant = 2;
    const reload_result = await with_timeout(card.reload(), 1000);
    assert('reload() completed within 1s -> ' + reload_result, reload_result === 'done');

    assert('on_load() really returned unchanged data -> ' + JSON.stringify(card.data),
           JSON.stringify(card.data) === data_before);
    assert('the card used the cached html during the reload',
           window.localStorage.length > 0 && card._cache_key !== null);

    const children_after = live_children_of(card.$);
    assert('the card has a live child component after the reload -> ' + children_after.length,
           children_after.length === 1);
    const child_after = children_after.first().data('_component');
    assert('that child is a real instance in the ready state -> _ready_state ' +
           (child_after && child_after._ready_state),
           !!child_after && child_after instanceof Jqhtml_Component && child_after._ready_state === 4);
    assert('no stopped markup was left behind -> ' + card.$.find('._Component_Stopped').length,
           card.$.find('._Component_Stopped').length === 0);
    assert('_dom_children matches the live children -> ' + card._dom_children.size,
           card._dom_children.size === 1);
    assert('the card still shows its name after the reload -> ' + card.$sid('name').text(),
           card.$sid('name').text() === 'card 1');

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
