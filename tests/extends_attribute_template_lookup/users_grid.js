class Users_Grid extends Jqhtml_Component {
  on_create() {
    this.data.rows = [
      {id: 1, name: 'Alice'},
      {id: 2, name: 'Bob'}
    ];
  }

  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('extends ATTRIBUTE TEMPLATE LOOKUP TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];

    // TEST 1: Table structure from DataGrid_Base
    console.log('TEST 1: Parent template structure');
    const has_table = this.$.find('table.table').length > 0;
    const has_thead = this.$.find('thead').length > 0;
    const has_tbody = this.$.find('tbody').length > 0;

    console.log(`  Has <table class="table">: ${has_table}`);
    console.log(`  Has <thead>: ${has_thead}`);
    console.log(`  Has <tbody>: ${has_tbody}`);

    if (has_table && has_thead && has_tbody) {
      console.log('✅ PASS: Parent template structure rendered');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Parent template structure missing');
      tests.push(false);
    }
    console.log('');

    // TEST 2: Header slot filled
    console.log('TEST 2: Header slot content');
    const header_cells = this.$.find('thead th');
    console.log(`  Header cells: ${header_cells.length}`);
    console.log(`  First: "${header_cells.eq(0).text()}"`);
    console.log(`  Second: "${header_cells.eq(1).text()}"`);

    if (header_cells.length === 2 &&
        header_cells.eq(0).text().trim() === 'ID' &&
        header_cells.eq(1).text().trim() === 'Name') {
      console.log('✅ PASS: Header slot filled correctly');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Header slot not filled correctly');
      tests.push(false);
    }
    console.log('');

    // TEST 3: Row slots filled
    console.log('TEST 3: Row slot content');
    const rows = this.$.find('tbody tr');
    console.log(`  Body rows: ${rows.length}`);

    const first_row_cells = rows.eq(0).find('td');
    const first_id = first_row_cells.eq(0).text().trim();
    const first_name = first_row_cells.eq(1).text().trim();

    console.log(`  First row: ID="${first_id}", Name="${first_name}"`);

    if (rows.length === 2 && first_id === '1' && first_name === 'Alice') {
      console.log('✅ PASS: Row slots filled correctly');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Row slots not filled correctly');
      tests.push(false);
    }
    console.log('');

    // Final result
    console.log('========================================');
    const all_passed = tests.every(t => t);
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
    console.log('');
  }
}
