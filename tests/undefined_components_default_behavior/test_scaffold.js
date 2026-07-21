class Test_Scaffold extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('UNDEFINED COMPONENTS DEFAULT BEHAVIOR TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];

    // TEST 1: Undefined components render as divs
    console.log('TEST 1: Undefined components render as <div> elements');

    const header = this.$.find('.Undefined_Header');
    const logo = this.$.find('.Undefined_Logo');
    const nav = this.$.find('.Undefined_Nav');
    const links = this.$.find('.Undefined_Link');

    console.log(`  Undefined_Header found: ${header.length > 0}`);
    console.log(`  Undefined_Header tag: ${header.prop('tagName')}`);
    console.log(`  Undefined_Logo found: ${logo.length > 0}`);
    console.log(`  Undefined_Logo tag: ${logo.prop('tagName')}`);
    console.log(`  Undefined_Nav found: ${nav.length > 0}`);
    console.log(`  Undefined_Link count: ${links.length}`);

    const all_divs =
      header.prop('tagName') === 'DIV' &&
      logo.prop('tagName') === 'DIV' &&
      nav.prop('tagName') === 'DIV' &&
      links.eq(0).prop('tagName') === 'DIV';

    if (all_divs && header.length > 0 && logo.length > 0 && nav.length > 0 && links.length === 2) {
      console.log('✅ PASS: All undefined components render as <div>');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Undefined components did not render as <div>');
      tests.push(false);
    }
    console.log('');

    // TEST 2: Component name added as class
    console.log('TEST 2: Component names added to class attribute');

    const header_has_class = header.hasClass('Undefined_Header');
    const logo_has_class = logo.hasClass('Undefined_Logo');
    const nav_has_class = nav.hasClass('Undefined_Nav');
    const link_has_class = links.eq(0).hasClass('Undefined_Link');

    console.log(`  Undefined_Header has class: ${header_has_class}`);
    console.log(`  Undefined_Logo has class: ${logo_has_class}`);
    console.log(`  Undefined_Nav has class: ${nav_has_class}`);
    console.log(`  Undefined_Link has class: ${link_has_class}`);

    if (header_has_class && logo_has_class && nav_has_class && link_has_class) {
      console.log('✅ PASS: All component names added as classes');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Component names not added as classes');
      tests.push(false);
    }
    console.log('');

    // TEST 3: Jqhtml_Component class added
    console.log('TEST 3: Jqhtml_Component marker class added');

    const header_has_marker = header.hasClass('Jqhtml_Component');
    const logo_has_marker = logo.hasClass('Jqhtml_Component');

    console.log(`  Undefined_Header has Jqhtml_Component: ${header_has_marker}`);
    console.log(`  Undefined_Logo has Jqhtml_Component: ${logo_has_marker}`);

    if (header_has_marker && logo_has_marker) {
      console.log('✅ PASS: Jqhtml_Component marker class added');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Jqhtml_Component marker class missing');
      tests.push(false);
    }
    console.log('');

    // TEST 4: Content preserved
    console.log('TEST 4: Content passes through correctly');

    const first_link_text = links.eq(0).text().trim();
    const second_link_text = links.eq(1).text().trim();

    console.log(`  First link text: "${first_link_text}"`);
    console.log(`  Second link text: "${second_link_text}"`);
    console.log(`  Expected: "Home" and "About"`);

    if (first_link_text === 'Home' && second_link_text === 'About') {
      console.log('✅ PASS: Content preserved correctly');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Content not preserved');
      tests.push(false);
    }
    console.log('');

    // TEST 5: Nesting structure preserved
    console.log('TEST 5: Component hierarchy preserved');

    const logo_in_header = header.find('.Undefined_Logo').length;
    const nav_in_header = header.find('.Undefined_Nav').length;
    const links_in_nav = nav.find('.Undefined_Link').length;

    console.log(`  Logo inside Header: ${logo_in_header > 0}`);
    console.log(`  Nav inside Header: ${nav_in_header > 0}`);
    console.log(`  Links inside Nav: ${links_in_nav}`);

    if (logo_in_header > 0 && nav_in_header > 0 && links_in_nav === 2) {
      console.log('✅ PASS: Component hierarchy preserved');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Component hierarchy broken');
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
