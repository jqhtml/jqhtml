class Comment_Component extends Jqhtml_Component {
  on_ready() {
    console.log('[Comment_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');

    // Get full DOM content
    const full_html = this.$.html();
    const full_text = this.$.text();

    console.log('');
    console.log('SEARCHING FOR COMMENT ARTIFACTS:');
    console.log('');

    // Check for comment artifacts (actual comment text, not legitimate headings)
    const comment_patterns = [
      'This is a single-line comment that should not appear',
      'Single line comment between elements',
      'It spans multiple lines',
      'It should be completely removed from the output',
      'None of this text should appear in the DOM',
      'Comment with <tags>, "quotes", and \'apostrophes\' & symbols!'
    ];

    let found_any = false;

    comment_patterns.forEach(pattern => {
      const found_in_html = full_html.includes(pattern);
      const found_in_text = full_text.includes(pattern);

      if (found_in_html || found_in_text) {
        console.log(`❌ FOUND comment artifact: "${pattern}"`);
        console.log(`   In HTML: ${found_in_html}, In Text: ${found_in_text}`);
        found_any = true;
      }
    });

    if (!found_any) {
      console.log('✅ PASS: No comment artifacts found in DOM');
    } else {
      console.log('');
      console.log('❌ FAIL: Found comment text in rendered output!');
    }

    console.log('');
    console.log('CHECKING VISIBLE CONTENT:');
    console.log('');

    // Check that visible content is present
    const checks = [
      {
        id: 'after_multiline',
        expected: 'Content after multi-line comment'
      },
      {
        id: 'after_special',
        expected: 'Content after special chars comment'
      },
      {
        id: 'final_content',
        expected: 'All visible content rendered successfully'
      }
    ];

    let all_visible_ok = true;

    checks.forEach(check => {
      const elem = this.$sid(check.id);
      const text = elem.text().trim();
      const found = text === check.expected;

      console.log(`Element #${check.id}:`);
      console.log(`   Expected: "${check.expected}"`);
      console.log(`   Found: "${text}"`);
      console.log(`   ${found ? '✅ PASS' : '❌ FAIL'}`);
      console.log('');

      if (!found) all_visible_ok = false;
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (!found_any && all_visible_ok) {
      console.log('✅ ALL TESTS PASSED');
      console.log('   - No comment artifacts in output');
      console.log('   - All visible content rendered correctly');
    } else {
      console.log('❌ TEST FAILED');
      if (found_any) console.log('   - Comment artifacts found in output');
      if (!all_visible_ok) console.log('   - Visible content rendering issues');
    }

    console.log('========================================');
    console.log('');
  }
}
