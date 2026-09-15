class Slot_Forwarding_Test extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    console.log('');
    console.log('1. A SLOT FORWARDED THROUGH THREE LEVELS (A -> B -> C):');
    const a = this.$.find('.Component_A').component();
    const c = this.$.find('.Component_C').component();
    const a_rows = this.$.find('.Component_C .alert-success');
    assert('all three components mounted', a && c && this.$.find('.Component_B').length === 1);
    assert('Component_C rendered one row per data row', a_rows.length === 3);
    assert("row 1 used Component_A's markup and data", a_rows.eq(0).text().includes("Row from Component_A's slot")
      && a_rows.eq(0).text().includes('First Row') && a_rows.eq(0).text().includes('ID: 1'));
    assert('row 3 carries its own row data', a_rows.eq(2).text().includes('Third Row')
      && a_rows.eq(2).text().includes('ID: 3'));
    assert('the slot parameter was not shared between iterations',
      new Set(a_rows.map((i, el) => $(el).text().trim()).get()).size === 3);
    assert('the forwarded markup rendered inside Component_C, not B',
      a_rows.eq(0).closest('.Component_C').length === 1);

    console.log('');
    console.log('2. THREE SLOTS FORWARDED INDEPENDENTLY (Parent -> Middle -> Child):');
    const child = this.$.find('.Multi_Slot_Child').component();
    const header = this.$.find('.Multi_Slot_Child .alert-primary');
    const m_rows = this.$.find('.Multi_Slot_Child .badge');
    const footer = this.$.find('.Multi_Slot_Child .alert-secondary');
    assert('the header slot rendered once', header.length === 1);
    assert('the header slot got the child data', header.text().includes('Test Report Header'));
    assert('the row slot rendered three times', m_rows.length === 3);
    assert('each row slot got its own row', m_rows.eq(0).text().includes('Item Alpha')
      && m_rows.eq(1).text().includes('Item Beta') && m_rows.eq(2).text().includes('Item Gamma'));
    assert('the footer slot rendered once with its data',
      footer.length === 1 && footer.text().includes('End of Report - 3 items total'));
    assert('header renders before the rows, footer after',
      header.index() < m_rows.closest('.my-2').index()
      && m_rows.closest('.my-2').index() < footer.index());
    assert('no slot leaked into another', header.text().indexOf('Row Slot') === -1
      && footer.text().indexOf('Row Slot') === -1);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
