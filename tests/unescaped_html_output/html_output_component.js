class Html_Output_Component extends Jqhtml_Component {
  on_create() {
    console.log('[Html_Output_Component] on_create() called');

    // Set test data
    this.data.html_string = '<strong>Bold Text</strong>';
    this.data.xss_string = '<script>alert("XSS Attack!")</script>';

    console.log('[Html_Output_Component] Test data set:');
    console.log('  html_string:', this.data.html_string);
    console.log('  xss_string:', this.data.xss_string);
  }

  on_ready() {
    console.log('[Html_Output_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');

    // Test 1: Escaped output
    const escaped_content = this.$sid('escaped').html();
    const escaped_text = this.$sid('escaped').text();
    console.log('');
    console.log('1. ESCAPED OUTPUT (<%= %>):');
    console.log('   HTML content:', escaped_content);
    console.log('   Text content:', escaped_text);
    console.log('   Contains <strong> tag?', escaped_content.includes('<strong>'));
    console.log('   Contains &lt;strong&gt;?', escaped_content.includes('&lt;strong&gt;'));

    if (escaped_content.includes('&lt;strong&gt;') || escaped_text === '<strong>Bold Text</strong>') {
      console.log('   ✅ PASS: HTML is escaped (shows as literal text)');
    } else if (escaped_content.includes('<strong>')) {
      console.log('   ❌ FAIL: HTML is NOT escaped (security vulnerability!)');
    } else {
      console.log('   ⚠️  UNEXPECTED: Neither escaped nor unescaped format detected');
    }

    // Test 2: Unescaped output
    const unescaped_content = this.$sid('unescaped').html();
    const unescaped_has_strong = this.$sid('unescaped').find('strong').length > 0;
    console.log('');
    console.log('2. UNESCAPED OUTPUT (<%!= %>):');
    console.log('   HTML content:', unescaped_content);
    console.log('   Has <strong> element?', unescaped_has_strong);
    console.log('   Inner text:', this.$sid('unescaped').text());

    if (unescaped_has_strong && unescaped_content.includes('<strong>')) {
      console.log('   ✅ PASS: HTML is rendered (contains actual <strong> element)');
    } else if (unescaped_content.includes('&lt;strong&gt;')) {
      console.log('   ❌ FAIL: HTML is escaped when it should be raw');
    } else {
      console.log('   ⚠️  UNEXPECTED: Unexpected output format');
    }

    // Test 3: XSS protection
    const xss_content = this.$sid('xss_escaped').html();
    const xss_text = this.$sid('xss_escaped').text();
    console.log('');
    console.log('3. XSS PROTECTION TEST (<%= script tag %>):');
    console.log('   HTML content:', xss_content);
    console.log('   Text content:', xss_text);
    console.log('   Contains <script> tag?', xss_content.includes('<script>'));
    console.log('   Contains &lt;script&gt;?', xss_content.includes('&lt;script&gt;'));

    if (xss_content.includes('&lt;script&gt;') || xss_text.includes('<script>')) {
      console.log('   ✅ PASS: XSS string is escaped (secure)');
    } else if (xss_content.includes('<script>')) {
      console.log('   ❌ FAIL: XSS string NOT escaped (MAJOR SECURITY ISSUE!)');
    } else {
      console.log('   ⚠️  UNEXPECTED: XSS test inconclusive');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
