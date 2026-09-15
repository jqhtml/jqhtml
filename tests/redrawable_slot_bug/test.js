class Test_Page extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    const grid = this.$.find('.Child_Grid').component();
    const header_cells = this.$.find('thead th');
    const rows = this.$.find('tbody tr');

    console.log('');
    console.log('1. A $redrawable thead STILL RENDERS ITS SLOT CONTENT:');
    assert('the grid mounted', grid instanceof Jqhtml_Component);
    assert('thead exists', this.$.find('thead').length === 1);
    assert('two header cells rendered', header_cells.length === 2);
    assert('first header cell is ID', header_cells.eq(0).text().trim() === 'ID');
    assert('second header cell is Name', header_cells.eq(1).text().trim() === 'Name');

    console.log('');
    console.log('2. THE ROW SLOT RENDERED FOR EVERY ROW:');
    assert('three data rows rendered', rows.length === 3);
    assert('row 0 is John', rows.eq(0).text().includes('John'));
    assert('row 1 is Jane', rows.eq(1).text().includes('Jane'));
    assert('row 2 is Bob', rows.eq(2).text().includes('Bob'));
    assert('row 0 carries its id cell', rows.eq(0).find('td').eq(0).text().trim() === '1');

    console.log('');
    console.log('3. THE $redrawable IS A REAL COMPONENT AND RE-RENDERS:');
    const header_component = grid && grid.sid('table_header');
    assert('$sid="table_header" resolves to a component', header_component instanceof Jqhtml_Component);
    await grid.render('table_header');
    const after = this.$.find('thead th');
    assert('slot content survives a targeted re-render', after.length === 2
      && after.eq(0).text().trim() === 'ID' && after.eq(1).text().trim() === 'Name');
    assert('the body was left alone', this.$.find('tbody tr').length === 3);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
