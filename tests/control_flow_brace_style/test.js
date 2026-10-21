class Control_Flow_Test extends Jqhtml_Component {
  on_create() {
    // Set up test data
    this.data.show_message = true;
    this.data.is_admin = false;
    this.data.items = [
      { name: 'Apple' },
      { name: 'Banana' },
      { name: 'Cherry' }
    ];
  }

  on_ready() {
    console.log('✅ Control Flow Test component ready!');

    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };
    const text = (selector) => this.$.find(selector).text().replace(/\s+/g, ' ').trim();

    // Test 1: if (true) renders its body
    assert('Test 1: if renders "Message is visible!"', text('.test-1') === 'Message is visible!', text('.test-1'));

    // Test 2: if/else takes the else branch only
    assert('Test 2: else branch "Regular user" only', text('.test-2') === 'Regular user', text('.test-2'));

    // Test 3: for..of emits one <li> per item, in order
    const items = this.$.find('.test-3 li').map((i, el) => $(el).text().trim()).get();
    assert('Test 3: for..of renders Apple, Banana, Cherry',
      JSON.stringify(items) === JSON.stringify(['Apple', 'Banana', 'Cherry']), items);

    // Test 4: nested if + indexed for
    assert('Test 4: "Items Found" heading', text('.test-4 h3') === 'Items Found', text('.test-4 h3'));
    const rows = this.$.find('.test-4 > div').map((i, el) => $(el).text().replace(/\s+/g, ' ').trim()).get();
    assert('Test 4: numbered items 1-3',
      JSON.stringify(rows) === JSON.stringify(['Item 1: Apple', 'Item 2: Banana', 'Item 3: Cherry']), rows);
    assert('Test 4: else branch not rendered', this.$.find('.test-4 p').length === 0);

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
