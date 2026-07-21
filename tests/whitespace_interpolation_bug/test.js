class Test_Whitespace_Interpolation extends Jqhtml_Component {
  on_create() {
    // Set a title to pass to child component
    this.args.title = this.args.title || 'Dynamic Title';
  }

  on_ready() {
    console.log('========================================');
    console.log('WHITESPACE INTERPOLATION BUG TEST');
    console.log('========================================');

    // Check all the titles
    this.$.find('.card-widget__title').each(function(index) {
      const title = $(this).text();
      console.log('Title ' + (index + 1) + ':', JSON.stringify(title));

      // Check for expected whitespace
      if (title.includes('(PLACEHOLDER)') || title.includes('(MULTIPLE SPACES)')) {
        if (title.includes(' (')) {
          console.log('  ✅ PASS: Space before parenthesis preserved');
        } else {
          console.log('  ❌ FAIL: Space before parenthesis MISSING');
        }
      }
    });

    console.log('========================================');
    console.log('EXPECTED: "Dynamic Title (PLACEHOLDER)"');
    console.log('BUG SHOWS: "Dynamic Title(PLACEHOLDER)"');
    console.log('========================================');
  }
}
