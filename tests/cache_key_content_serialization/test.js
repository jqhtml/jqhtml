class Test_Cache_Key_Content extends Jqhtml_Component {
  on_create() {
    window.jqhtml.set_cache_key('cache_key_content_test', 'data');
    // Rebuilt objects - exactly what a template does on every render
    this.state.params = { parent_type: 'Contact_Model', parent_id: 12 };
    this.state.with_fn = { parent_id: 12, on_select: () => {} };
  }

  async on_ready() {
    if (this.state.ran) return; this.state.ran = true;
    let passed = 0, failed = 0;
    const assert = (n, c) => { console.log((c ? '   PASS: ' : '   FAIL: ') + n); c ? passed++ : failed++; };

    const plain = this.sid('plain');
    const fn = this.sid('fn');

    console.log('\n1. PLAIN DATA OBJECT ARG IS NOW CACHEABLE:');
    assert('no data-nocache on plain-data component', plain.$.attr('data-nocache') === undefined);
    assert('component has a cache key', typeof plain._cache_key === 'string' && plain._cache_key.length > 0);

    console.log('\n2. EQUAL CONTENT REBUILT -> SAME KEY (through the real pipeline):');
    const build = () => ({ parent_type: 'Contact_Model', parent_id: 12 });
    const spawn = async (params) => {
      const $el = $('<div>').appendTo(this.$);
      $el.component('Ck_Child', { params });
      const c = $el.component();
      await c.ready();
      return c;
    };
    const a = await spawn(build());
    const b = await spawn(build());
    const c_diff = await spawn({ parent_type: 'Contact_Model', parent_id: 99 });
    assert('two separately-built equal objects share one cache key',
           a._cache_key === b._cache_key && typeof a._cache_key === 'string');
    assert('a different value produces a different key', a._cache_key !== c_diff._cache_key);

    console.log('\n3. FUNCTION ARG STILL DECLINES, WITH A REASON:');
    const nocache = fn.$.attr('data-nocache');
    assert('data-nocache present on function-arg component', typeof nocache === 'string');
    assert('data-nocache names the arg', !!nocache && nocache.startsWith('params:'));
    assert('data-nocache carries the reason', nocache === 'params:function');

    console.log('\n4. BOTH COMPONENTS STILL WORK:');
    assert('plain child loaded', plain.$.text().trim() === 'loaded');
    assert('function-arg child loaded', fn.$.text().trim() === 'loaded');

    console.log('\n========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================\n');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
