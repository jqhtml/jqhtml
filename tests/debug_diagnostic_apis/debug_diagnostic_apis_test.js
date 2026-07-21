class Debug_Diagnostic_Apis_Test extends Jqhtml_Component {
  async on_ready() {
    const j = window.jqhtml;
    const tests = [];

    function check(n, cond, msg) {
      if (cond) {
        console.log(`✅ TEST ${n} PASS: ${msg}`);
        tests.push(true);
      } else {
        console.log(`❌ TEST ${n} FAIL: ${msg}`);
        tests.push(false);
      }
    }

    console.log('========================================');
    console.log('TESTING window.jqhtml DEBUG/DIAGNOSTIC APIS:');
    console.log('========================================');

    // TEST 1: get_component_names() includes this registered component
    const names = typeof j.get_component_names === 'function' ? j.get_component_names() : null;
    check(
      1,
      Array.isArray(names) && names.includes('Debug_Diagnostic_Apis_Test'),
      `get_component_names() includes 'Debug_Diagnostic_Apis_Test' (got: ${JSON.stringify(names)})`
    );

    // TEST 2: get_registered_templates() includes this registered component's template
    const templateNames = typeof j.get_registered_templates === 'function' ? j.get_registered_templates() : null;
    check(
      2,
      Array.isArray(templateNames) && templateNames.includes('Debug_Diagnostic_Apis_Test'),
      `get_registered_templates() includes 'Debug_Diagnostic_Apis_Test' (got: ${JSON.stringify(templateNames)})`
    );

    // TEST 3: list_components() reports both a class and a template for this component
    const listed = typeof j.list_components === 'function' ? j.list_components() : null;
    const entry = listed ? listed['Debug_Diagnostic_Apis_Test'] : null;
    check(
      3,
      !!entry && entry.has_class === true && entry.has_template === true,
      `list_components()['Debug_Diagnostic_Apis_Test'] = ${JSON.stringify(entry)}`
    );

    // TEST 4: _version() returns a real, non-placeholder version string
    const v = typeof j._version === 'function' ? j._version() : null;
    check(
      4,
      typeof v === 'string' && v.length > 0 && v !== '__VERSION__',
      `_version() returns a real version string (got "${v}")`
    );

    // TEST 5: enableDebugMode('basic') flips the documented basic-mode flags
    j.enableDebugMode('basic');
    check(
      5,
      j.debug.logCreationReady === true && j.debug.logDispatch === true && j.debug.flashComponents === true,
      `enableDebugMode('basic') set logCreationReady/logDispatch/flashComponents (debug=${JSON.stringify(j.debug)})`
    );

    // TEST 6: setDebugSettings() merges new settings in without clobbering existing ones
    j.setDebugSettings({ logFullLifecycle: true });
    check(
      6,
      j.debug.logFullLifecycle === true && j.debug.logCreationReady === true,
      `setDebugSettings({logFullLifecycle:true}) merged (debug=${JSON.stringify(j.debug)})`
    );

    // TEST 7: clearDebugSettings() resets the debug settings object
    j.clearDebugSettings();
    check(
      7,
      j.debug && typeof j.debug === 'object' && Object.keys(j.debug).length === 0,
      `clearDebugSettings() reset debug to an empty object (debug=${JSON.stringify(j.debug)})`
    );

    const all_passed = tests.every(t => t);

    $('#results').html(
      all_passed
        ? '<span style="color: green;">✅ All tests passed</span>'
        : '<span style="color: red;">❌ Some tests failed</span>'
    );

    console.log('');
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('========================================');

    window.testPassed = all_passed;
  }
}
