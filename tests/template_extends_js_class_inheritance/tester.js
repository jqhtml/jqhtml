class Tester extends Jqhtml_Component {
  async on_ready() {
    console.log('[Tester] on_ready: Validating template extends JS class inheritance...');

    // Instantiate programmatically using jQuery plugin
    console.log('[Tester] Creating Contacts_DataGrid programmatically via $().component()...');
    this.$sid('contacts_grid_target').component('Contacts_DataGrid', {});

    // Wait a moment for it to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test both instances
    const declarative = this.sid('contacts_grid_declarative');
    const programmatic = this.$sid('contacts_grid_target').data('_component');

    const results = [];

    // Test declarative instance
    console.log('[Tester] Testing declarative instance...');
    this.testInstance(declarative, 'Declarative', results);

    // Test programmatic instance
    console.log('[Tester] Testing programmatic instance...');
    this.testInstance(programmatic, 'Programmatic', results);

    // Display results
    const $results = this.$sid('results');
    results.forEach(result => {
      const $line = $('<div>').text(result).css('margin-bottom', '5px');
      if (result.startsWith('✓')) {
        $line.css('color', 'green');
      } else {
        $line.css('color', 'red');
      }
      $results.append($line);
    });

    console.log('[Tester] All tests complete');
  }

  testInstance(grid, label, results) {
    // Test 1: Component rendered successfully
    if (grid) {
      results.push(`✓ ${label}: Contacts_DataGrid rendered successfully`);
      console.log(`[Tester] ✓ ${label} Test 1 passed: Component rendered`);
    } else {
      results.push(`✗ ${label}: Contacts_DataGrid failed to render`);
      console.log(`[Tester] ✗ ${label} Test 1 failed: Component not found`);
      return; // Can't continue without instance
    }

    // Test 2: Component instance has correct class
    // Should be Contacts_DataGrid when .js file exists, DataGrid_Abstract when it doesn't
    if (grid.constructor.name === 'Contacts_DataGrid' || grid.constructor.name === 'DataGrid_Abstract') {
      results.push(`✓ ${label}: Using ${grid.constructor.name} class`);
      console.log(`[Tester] ✓ ${label} Test 2 passed: Correct class type (${grid.constructor.name})`);
    } else {
      results.push(`✗ ${label}: Wrong class type (expected Contacts_DataGrid or DataGrid_Abstract, got ${grid.constructor.name})`);
      console.log(`[Tester] ✗ ${label} Test 2 failed: Wrong class`);
    }

    // Test 3: on_create executed (data structure initialized)
    if (grid.data && Array.isArray(grid.data.rows)) {
      results.push(`✓ ${label}: on_create() executed (data.rows initialized)`);
      console.log(`[Tester] ✓ ${label} Test 3 passed: on_create executed`);
    } else {
      results.push(`✗ ${label}: on_create() did not execute properly`);
      console.log(`[Tester] ✗ ${label} Test 3 failed: data.rows not initialized`);
    }

    // Test 4: on_load executed (data loaded)
    if (grid.data.loaded === true) {
      results.push(`✓ ${label}: on_load() executed (data.loaded = true)`);
      console.log(`[Tester] ✓ ${label} Test 4 passed: on_load executed`);
    } else {
      results.push(`✗ ${label}: on_load() did not execute properly`);
      console.log(`[Tester] ✗ ${label} Test 4 failed: data.loaded not true`);
    }

    // Test 5: Data populated with correct number of rows
    if (grid.data.rows && grid.data.rows.length === 3) {
      results.push(`✓ ${label}: Data populated with 3 rows`);
      console.log(`[Tester] ✓ ${label} Test 5 passed: Data populated correctly`);
    } else {
      results.push(`✗ ${label}: Wrong row count (expected 3, got ${grid.data.rows.length})`);
      console.log(`[Tester] ✗ ${label} Test 5 failed: Wrong row count`);
    }

    // Test 6: Parent class method available
    if (typeof grid.get_row_count === 'function') {
      const count = grid.get_row_count();
      if (count === 3) {
        results.push(`✓ ${label}: Parent class method works: get_row_count() = ${count}`);
        console.log(`[Tester] ✓ ${label} Test 6 passed: Parent method works`);
      } else {
        results.push(`✗ ${label}: Parent method returned wrong value: ${count}`);
        console.log(`[Tester] ✗ ${label} Test 6 failed: Wrong count`);
      }
    } else {
      results.push(`✗ ${label}: Parent class method not available`);
      console.log(`[Tester] ✗ ${label} Test 6 failed: Method not available`);
    }

    // Test 7: Table structure rendered (parent template)
    const $table = grid.$.find('table');
    if ($table.length > 0) {
      results.push(`✓ ${label}: Table structure rendered (parent template)`);
      console.log(`[Tester] ✓ ${label} Test 7 passed: Table found`);
    } else {
      results.push(`✗ ${label}: Table not found (parent template failed)`);
      console.log(`[Tester] ✗ ${label} Test 7 failed: No table`);
    }

    // Test 8: Header slot rendered (child slot DG_Table_Header)
    const $headerCells = grid.$.find('thead th');
    if ($headerCells.length === 4) {
      const headers = $headerCells.map((i, el) => $(el).text()).get();
      if (headers.join(',') === 'ID,Name,Email,Phone') {
        results.push(`✓ ${label}: Header slot rendered correctly (child slot)`);
        console.log(`[Tester] ✓ ${label} Test 8 passed: Headers: ${headers.join(', ')}`);
      } else {
        results.push(`✗ ${label}: Header slot wrong content: ${headers.join(', ')}`);
        console.log(`[Tester] ✗ ${label} Test 8 failed: Wrong headers`);
      }
    } else {
      results.push(`✗ ${label}: Header slot not rendered (expected 4 th, got ${$headerCells.length})`);
      console.log(`[Tester] ✗ ${label} Test 8 failed: Wrong header count`);
    }

    // Test 9: Row slots rendered (child slot DG_Table_Row)
    const $bodyRows = grid.$.find('tbody tr');
    if ($bodyRows.length === 3) {
      results.push(`✓ ${label}: Row slots rendered (3 data rows from child slot)`);
      console.log(`[Tester] ✓ ${label} Test 9 passed: 3 rows rendered`);
    } else {
      results.push(`✗ ${label}: Wrong row count in DOM (expected 3, got ${$bodyRows.length})`);
      console.log(`[Tester] ✗ ${label} Test 9 failed: Wrong row count`);
    }

    // Test 10: Row data rendered correctly (slot parameter passing)
    const $firstRow = grid.$.find('tbody tr:first td');
    if ($firstRow.length === 4) {
      const firstRowData = $firstRow.map((i, el) => $(el).text()).get();
      if (firstRowData[0] === '1' && firstRowData[1] === 'John Doe') {
        results.push(`✓ ${label}: Row data rendered correctly (slot params work)`);
        console.log(`[Tester] ✓ ${label} Test 10 passed: First row: ${firstRowData.join(', ')}`);
      } else {
        results.push(`✗ ${label}: Row data wrong: ${firstRowData.join(', ')}`);
        console.log(`[Tester] ✗ ${label} Test 10 failed: Wrong data`);
      }
    } else {
      results.push(`✗ ${label}: Row structure wrong (expected 4 td, got ${$firstRow.length})`);
      console.log(`[Tester] ✗ ${label} Test 10 failed: Wrong structure`);
    }
  }
}
