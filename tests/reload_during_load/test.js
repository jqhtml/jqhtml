class Test extends Jqhtml_Component {
  async on_ready() {
    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const parent = this.sid('parent');
    const child = parent.sid('child_component');

    // Wait for parent to be fully ready (which means child should have gone through the reload attempt)
    await parent.ready();

    // Give a bit more time for any queued reloads to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    const log = (window.__child_log || []).join(',');
    console.log('[TEST] Child load count:', window.__child_load_count || 0);
    console.log('[TEST] Child on_load log:', log);

    assert('reload() during on_load() did not throw' + (window.__test_error ? ' -> ' + window.__test_error : ''),
           !window.__test_error);
    assert('on_load() ran twice: the boot load and the reload -> ' + window.__child_load_count,
           window.__child_load_count === 2);
    assert('the reload waited for the boot load: no overlap -> ' + log, log === 'start:1,end:1,start:2,end:2');
    assert('the child ends with the reload\'s data -> ' + child.data.load_count, child.data.load_count === 2);
    assert('the DOM shows the reload\'s data', /Load count: 2/.test(child.$.text()));
    // Boot's on_ready() runs on the boot data, inside the lifecycle lock; the queued
    // reload starts after it and runs its own on_ready().
    assert('on_ready() ran for the boot load, then for the reload -> ' + JSON.stringify(window.__child_on_ready),
           JSON.stringify(window.__child_on_ready) === '[1,2]');
    assert('the child fired ready once, after the reload -> ' + JSON.stringify(window.__child_ready_events),
           window.__child_ready_events.length === 1 && window.__child_ready_events[0] === 2);

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
