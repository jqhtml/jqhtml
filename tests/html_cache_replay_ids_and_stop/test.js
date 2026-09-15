// The snapshot/replay machinery only exists in 'html' cache mode.
const VALID_MODES = ['html'];

class Html_Cache_Replay_Ids_And_Stop extends Jqhtml_Component {
  on_create() {
    // Must be on_create(): a second set_cache_key() call is a cache reset, and children
    // created before it would have booted against a different key.
    window.jqhtml.set_cache_key('html_cache_replay_ids_and_stop_key', 'html');
    window.__hc_renders = [];
    window.__hc_child_stops = 0;
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

    const renders_for = (cid, cached) =>
      window.__hc_renders.filter(r => r.cid === cid && r.cached === cached);

    // ---------------------------------------------------------------------------
    // WARM THE CACHE
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('WARMING: one <Hc_Card $id=1> loads and snapshots its HTML');
    const $warm = $('<div>').appendTo(this.$sid('warm'));
    $warm.component('Hc_Card', { id: 1 });
    const warm = $warm.component();
    await warm.ready();
    assert('warm card rendered its name -> ' + warm.$sid('name').text(),
           warm.$sid('name').text() === 'card 1');
    assert('warm card has one live child', warm._dom_children.size === 1);

    // ---------------------------------------------------------------------------
    // A. TWO INSTANCES HYDRATED FROM ONE SNAPSHOT DO NOT SHARE IDS
    //    Both are appended before .component(), so create() reads the cache for both
    //    and neither has written a new snapshot yet. The warm card is still in the
    //    document, so the snapshot's original owner is live too.
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('A. TWO CARDS HYDRATED FROM THE SAME SNAPSHOT:');
    const $pair = this.$sid('pair');
    const $a = $('<div>').appendTo($pair);
    const $b = $('<div>').appendTo($pair);
    $a.component('Hc_Card', { id: 1 });
    $b.component('Hc_Card', { id: 1 });
    const card_a = $a.component();
    const card_b = $b.component();

    const a_cached = renders_for(card_a._cid, true);
    const b_cached = renders_for(card_b._cid, true);
    assert('card a rendered from the cached snapshot', a_cached.length === 1);
    assert('card b rendered from the cached snapshot', b_cached.length === 1);

    if (a_cached.length === 1 && b_cached.length === 1) {
      assert('cached render: a.$sid("name") is inside card a', a_cached[0].own);
      assert('cached render: b.$sid("name") is inside card b', b_cached[0].own);
      assert('cached render: "name:" + a._cid is unique in the document', a_cached[0].unique);
      assert('cached render: "name:" + b._cid is unique in the document', b_cached[0].unique);
      assert('cached render: a and b have different name elements',
             !!a_cached[0].el && a_cached[0].el !== b_cached[0].el);
    }

    await card_a.ready();
    await card_b.ready();

    const a_name = card_a.$sid('name')[0];
    const b_name = card_b.$sid('name')[0];
    assert('after ready: a.$sid("name") is inside card a',
           !!a_name && a_name.closest('.Hc_Card') === card_a.$[0]);
    assert('after ready: b.$sid("name") is inside card b',
           !!b_name && b_name.closest('.Hc_Card') === card_b.$[0]);
    assert('after ready: "name:" + a._cid is unique in the document',
           document.querySelectorAll('[id="name:' + card_a._cid + '"]').length === 1);
    assert('after ready: "name:" + b._cid is unique in the document',
           document.querySelectorAll('[id="name:' + card_b._cid + '"]').length === 1);
    assert('after ready: a and b have different name elements', a_name !== b_name);

    // ---------------------------------------------------------------------------
    // B. A CACHE-MODE RELOAD STOPS THE CHILDREN IT OVERWRITES
    //    variant is not part of cache_id(), so args changed but the key did not:
    //    check_cache_on_reload() finds the snapshot and injects it over the live subtree.
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('B. RELOAD THAT INJECTS CACHED HTML OVER A LIVE SUBTREE:');
    const stops_before = window.__hc_child_stops;
    const renders_before = window.__hc_renders.length;
    const old_child = warm.sid('child');
    assert('warm card has a live child component before reload', !!old_child);

    warm.args.variant = 2;
    await warm.reload();

    // The reload renders twice: the cache injection first, then the template - the
    // injected snapshot is inert markup, so the re-render is not conditional on the
    // freshly loaded data differing.
    const reload_renders = window.__hc_renders.slice(renders_before).filter(r => r.cid === warm._cid);

    assert('the replaced child was stopped exactly once -> ' +
           (window.__hc_child_stops - stops_before),
           window.__hc_child_stops - stops_before === 1);
    assert('the replaced child is marked stopped', !!old_child && old_child._stopped === true);

    assert('the reload rendered twice: cache injection then template -> ' + reload_renders.length,
           reload_renders.length === 2);
    if (reload_renders.length >= 1) {
      assert('no stale children survived the injection -> _dom_children ' +
             reload_renders[0].dom_children,
             reload_renders[0].dom_children === 0);
      assert('the injected markup carries this card\'s own scoped id', reload_renders[0].own);
      assert('the injected scoped id is unique in the document', reload_renders[0].unique);
    }

    const live_children = warm.$.find('.Component').filter(function () {
      const c = $(this).data('_component');
      return !!c && !c._stopped;
    }).length;
    assert('_dom_children matches the live children after the re-render -> ' +
           warm._dom_children.size + ' vs ' + live_children,
           warm._dom_children.size === live_children && live_children === 1);
    assert('the new child is a different instance', warm.sid('child') !== old_child);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
