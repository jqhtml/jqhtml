class Test_Integration_Config_Modes extends Jqhtml_Component {
  async on_ready() {
    if (this.state.ran) return;
    this.state.ran = true;

    let passed = 0, failed = 0;
    const assert = (name, cond) => {
      console.log((cond ? '   PASS: ' : '   FAIL: ') + name);
      cond ? passed++ : failed++;
    };

    const jq = window.jqhtml;

    // Capture console.warn so we can assert on the diagnostic
    const warnings = [];
    const real_warn = console.warn;
    console.warn = function (...a) { warnings.push(a.map(x => String(x)).join(' ')); real_warn.apply(console, a); };
    const spawn = async (name, args) => {
      const $el = $('<div>').appendTo(this.$);
      $el.component(name, args);
      await $el.component().ready();
      return $el;
    };

    // ============================================================
    console.log('\n1. DEFAULT MODE IS DEVELOPMENT:');
    assert('default mode is development', jq.get_config().mode === 'development');
    assert('debug_attributes on by default', jq.get_config().debug_attributes === true);
    assert('warn_uncacheable_args on by default', jq.get_config().warn_uncacheable_args === true);

    // ============================================================
    console.log('\n2. DEV MODE EMITS data-sid:');
    assert('plain element has data-sid', this.$sid('probe').attr('data-sid') === 'probe');
    assert('component element has data-sid', this.$sid('child').attr('data-sid') === 'child');
    assert('nested element has data-sid', this.sid('child').$sid('inner').attr('data-sid') === 'inner');
    assert('scoped id present alongside', this.$sid('probe').attr('id') === 'probe:' + this._cid);
    assert('component has data-cid', this.sid('child').$.attr('data-cid') === this.sid('child')._cid);

    // ============================================================
    console.log('\n3. DEV MODE WARNS ON UNCACHEABLE ARGS:');
    warnings.length = 0;
    await spawn('Cfg_Cached', { filters: { id: 1 } });
    const warn = warnings.find(w => w.includes('Cfg_Cached'));
    assert('warned about uncacheable arg', !!warn);
    assert('names the offending arg', !!warn && warn.includes('$filters'));
    assert('explains cache reuse is lost', !!warn && /not be restored from cache/.test(warn));
    assert('recommends cache_id()', !!warn && warn.includes('cache_id()'));
    assert('gives a DevTools locator', !!warn && warn.includes('data-nocache'));

    // ============================================================
    console.log('\n4. WARNING IS DEDUPED PER COMPONENT:');
    warnings.length = 0;
    await spawn('Cfg_Cached', { filters: { id: 2 } });
    await spawn('Cfg_Cached', { filters: { id: 3 } });
    assert('repeat instances do not re-warn', warnings.filter(w => w.includes('Cfg_Cached')).length === 0);

    // ============================================================
    console.log('\n5. cache_id() SUPPRESSES THE WARNING:');
    warnings.length = 0;
    await spawn('Cfg_With_Id', { filters: { id: 9 } });
    assert('component with cache_id() is not warned about', !warnings.some(w => w.includes('Cfg_With_Id')));

    // ============================================================
    console.log('\n6. PRODUCTION MODE SUPPRESSES BOTH:');
    jq.configure({ mode: 'production' });
    assert('mode switched to production', jq.get_config().mode === 'production');
    assert('debug_attributes off', jq.get_config().debug_attributes === false);
    assert('warn_uncacheable_args off', jq.get_config().warn_uncacheable_args === false);

    warnings.length = 0;
    const $prod = await spawn('Cfg_Child', {});
    const prod_comp = $prod.component();
    assert('no data-sid on prod-rendered element', prod_comp.$sid('inner').attr('data-sid') === undefined);
    assert('no data-cid on prod-rendered component', prod_comp.$.attr('data-cid') === undefined);
    assert('scoped id STILL present in prod', prod_comp.$sid('inner').attr('id') === 'inner:' + prod_comp._cid);
    assert('$sid() still resolves in prod', prod_comp.$sid('inner').length === 1);
    assert('_cid property still set in prod', typeof prod_comp._cid === 'string' && prod_comp._cid.length > 0);
    // The transient data-cid placeholder is functional and must survive suppression:
    // if it were suppressed, nested children could never be matched and booted at all.
    assert('nested child booted in prod', !!prod_comp.$sid('inner').length);
    await prod_comp.reload();
    assert('reload() works in prod without data-cid', prod_comp.$sid('inner').text() === 'loaded');
    await prod_comp.render();
    assert('render() works in prod without data-cid', prod_comp.$sid('inner').length === 1);
    assert('render() does not reintroduce data-cid', prod_comp.$.attr('data-cid') === undefined);

    const $p2 = await spawn('Cfg_Cached', { filters: { id: 77 } });
    assert('no uncacheable warning in prod', !warnings.some(w => w.includes('not be restored from cache')));

    // ============================================================
    console.log('\n7. FLAGS OVERRIDE MODE INDEPENDENTLY:');
    jq.configure({ mode: 'production', debug_attributes: true });
    assert('mode stays production', jq.get_config().mode === 'production');
    assert('explicit flag overrides mode default', jq.get_config().debug_attributes === true);
    assert('other flag keeps mode default', jq.get_config().warn_uncacheable_args === false);

    jq.configure({ warn_uncacheable_args: true });
    assert('flag-only call leaves mode alone', jq.get_config().mode === 'production');
    assert('flag-only call applies the flag', jq.get_config().warn_uncacheable_args === true);

    // ============================================================
    console.log('\n8. UNKNOWN MODE THROWS:');
    let threw = false;
    try { jq.configure({ mode: 'staging' }); } catch (e) { threw = true; }
    assert('configure() rejects an unknown mode', threw);

    // restore for cleanliness
    jq.configure({ mode: 'development' });
    console.warn = real_warn;

    console.log('\n========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================\n');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
