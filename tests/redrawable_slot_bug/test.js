class Test_Page extends Jqhtml_Component {
  on_ready() {
    console.log('=== Test Page Ready ===');

    // Check if thead exists
    const thead = this.$.find('thead');
    console.log('thead found:', thead.length);
    console.log('thead HTML:', thead.html());

    // Check if header content is present
    const headerCells = this.$.find('thead th');
    console.log('Header cells found:', headerCells.length);
    headerCells.each((i, el) => {
      console.log(`  th[${i}]:`, $(el).text());
    });

    // Check tbody rows
    const rows = this.$.find('tbody tr');
    console.log('Data rows found:', rows.length);
    rows.each((i, el) => {
      console.log(`  row[${i}]:`, $(el).text());
    });
  }
}
