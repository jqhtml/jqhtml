class Br_Output_Component extends Jqhtml_Component {
  on_create() {
    console.log('[Br_Output_Component] on_create() called');

    // Set test data with multiline strings
    this.data.multiline_text = 'Line 1\nLine 2\nLine 3';
    this.data.html_multiline = '<strong>Bold</strong>\n<script>alert("XSS")</script>\nNormal text';

    console.log('[Br_Output_Component] Test data set:');
    console.log('  multiline_text:', JSON.stringify(this.data.multiline_text));
    console.log('  html_multiline:', JSON.stringify(this.data.html_multiline));
  }

  on_ready() {
    console.log('[Br_Output_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');

    let passed = 0;
    let failed = 0;

    // Test 1: Standard escaped output - no BR conversion
    const escaped_html = this.$sid('escaped').html();
    console.log('');
    console.log('1. STANDARD ESCAPED (<%= %>):');
    console.log('   HTML content:', escaped_html);
    console.log('   Contains <br /> tags?', escaped_html.includes('<br />'));

    // In escaped output, newlines stay as literal characters (not converted to BR)
    if (!escaped_html.includes('<br />') && !escaped_html.includes('<br>')) {
      console.log('   PASS: No <br /> tags (as expected)');
      passed++;
    } else {
      console.log('   FAIL: Contains <br /> tags when it should not');
      failed++;
    }

    // Test 2: BR output - should have BR tags
    const br_html = this.$sid('br_escaped').html();
    console.log('');
    console.log('2. BR OUTPUT (<%br= %>):');
    console.log('   HTML content:', br_html);
    // Browser may serialize as <br> or <br /> - accept both
    console.log('   Contains <br> or <br /> tags?', br_html.includes('<br>') || br_html.includes('<br />'));

    // Count BR tags - browser may serialize as <br> or <br /> - accept both
    // Should have 2 (for 2 newlines in "Line 1\nLine 2\nLine 3")
    const br_count = (br_html.match(/<br\s*\/?>/g) || []).length;
    console.log('   Number of BR tags:', br_count);

    if (br_count === 2) {
      console.log('   PASS: Correct number of BR tags');
      passed++;
    } else {
      console.log('   FAIL: Expected 2 BR tags, got ' + br_count);
      failed++;
    }

    // Test 3: BR output with HTML - should escape HTML but still add BR
    const br_with_html = this.$sid('br_with_html').html();
    console.log('');
    console.log('3. BR OUTPUT WITH HTML CHARACTERS (<%br= %>):');
    console.log('   HTML content:', br_with_html);

    // Browser may serialize as <br> or <br /> - accept both
    const has_br_tags = br_with_html.includes('<br>') || br_with_html.includes('<br />');
    const has_escaped_strong = br_with_html.includes('&lt;strong&gt;');
    const has_escaped_script = br_with_html.includes('&lt;script&gt;');
    const has_raw_strong = br_with_html.includes('<strong>');
    const has_raw_script = br_with_html.includes('<script>');

    console.log('   Has BR tags?', has_br_tags);
    console.log('   Has escaped &lt;strong&gt;?', has_escaped_strong);
    console.log('   Has escaped &lt;script&gt;?', has_escaped_script);
    console.log('   Has raw <strong> (bad)?', has_raw_strong);
    console.log('   Has raw <script> (bad)?', has_raw_script);

    if (has_br_tags && has_escaped_strong && has_escaped_script && !has_raw_strong && !has_raw_script) {
      console.log('   PASS: HTML escaped AND BR tags added');
      passed++;
    } else if (!has_br_tags) {
      console.log('   FAIL: Missing BR tags');
      failed++;
    } else if (has_raw_strong || has_raw_script) {
      console.log('   FAIL: HTML not escaped (security issue!)');
      failed++;
    } else {
      console.log('   FAIL: Unexpected output');
      failed++;
    }

    // Test 4: Unescaped - no BR conversion
    const unescaped_html = this.$sid('unescaped').html();
    console.log('');
    console.log('4. UNESCAPED OUTPUT (<%!= %>) - comparison:');
    console.log('   HTML content:', unescaped_html);
    console.log('   Contains <br /> tags?', unescaped_html.includes('<br />'));

    if (!unescaped_html.includes('<br />')) {
      console.log('   PASS: No <br /> tags (as expected for unescaped)');
      passed++;
    } else {
      console.log('   FAIL: Unexpected <br /> tags in unescaped output');
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    // Set test result for automated testing
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
