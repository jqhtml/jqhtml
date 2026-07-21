class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('ATTRIBUTE PRECEDENCE TEST:');
    console.log('========================================');
    console.log('');

    console.log('PART 1: BASIC ATTRIBUTE OVERRIDE TEST');
    console.log('========================================');
    console.log('');

    // Get button component
    const btn = this.sid('override');
    const $elem = btn.$;

    // Check tag name
    const tag_name = $elem.prop('tagName').toLowerCase();
    console.log(`Tag name: ${tag_name}`);
    console.log(`  Expected: span (invocation override)`);
    console.log(`  Define had: button`);
    console.log('');

    // Check style attribute
    const style = $elem.attr('style');
    console.log(`Style: ${style}`);
    console.log(`  Expected: color: blue; (invocation wins)`);
    console.log(`  Define had: color: red;`);
    console.log('');

    // Check data-theme
    const theme = $elem.attr('data-theme');
    console.log(`data-theme: ${theme}`);
    console.log(`  Expected: dark (invocation wins)`);
    console.log(`  Define had: light`);
    console.log('');

    // Check classes
    const class_attr = $elem.attr('class');
    const classes = class_attr.split(' ').filter(c => c.length > 0);
    console.log(`Classes: ${classes.join(', ')}`);
    console.log(`  Expected: btn AND btn-primary (merged)`);
    console.log(`  Define had: btn`);
    console.log(`  Invocation added: btn-primary`);
    console.log('');

    // Validate
    const tests = [];

    console.log('========================================');
    console.log('VALIDATION:');
    console.log('========================================');
    console.log('');

    // TEST 1: Tag is span
    if (tag_name === 'span') {
      console.log('✅ TEST 1 PASS: Tag is span (invocation override worked)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 1 FAIL: Expected <span>, got <${tag_name}>`);
      tests.push(false);
    }

    // TEST 2: Style is blue
    if (style && style.includes('blue')) {
      console.log('✅ TEST 2 PASS: Style is blue (invocation wins)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 2 FAIL: Expected style with blue, got: ${style}`);
      tests.push(false);
    }

    // TEST 3: data-theme is dark
    if (theme === 'dark') {
      console.log('✅ TEST 3 PASS: data-theme is dark (invocation wins)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 3 FAIL: Expected data-theme="dark", got: ${theme}`);
      tests.push(false);
    }

    // TEST 4: Both btn and btn-primary classes present
    const has_btn = classes.includes('btn');
    const has_btn_primary = classes.includes('btn-primary');
    if (has_btn && has_btn_primary) {
      console.log('✅ TEST 4 PASS: Both btn and btn-primary classes present (merged)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 4 FAIL: Expected both btn and btn-primary`);
      console.log(`  has btn: ${has_btn}, has btn-primary: ${has_btn_primary}`);
      tests.push(false);
    }

    console.log('');

    // PART 2: CLASS MERGING PERMUTATION TESTS
    console.log('========================================');
    console.log('PART 2: CLASS MERGING PERMUTATION TESTS');
    console.log('========================================');
    console.log('');

    // TEST 5: Overlapping classes (Define: "foo baz", Invocation: "foo bar")
    // Expected: "foo bar baz" - foo appears once, bar and baz both present
    console.log('TEST 5: Overlapping classes');
    const overlap_elem = this.sid('overlap').$;
    const overlap_classes = overlap_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Define: "foo baz"`);
    console.log(`  Invocation: "foo bar"`);
    console.log(`  Result: ${overlap_classes.join(' ')}`);
    console.log(`  Expected: foo bar baz (foo not duplicated)`);
    const has_foo = overlap_classes.filter(c => c === 'foo').length === 1; // Only ONE foo
    const has_bar = overlap_classes.includes('bar');
    const has_baz = overlap_classes.includes('baz');
    if (has_foo && has_bar && has_baz) {
      console.log('✅ TEST 5 PASS: Classes merged correctly (foo bar baz)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 5 FAIL: foo=${has_foo}, bar=${has_bar}, baz=${has_baz}`);
      tests.push(false);
    }
    console.log('');

    // TEST 6: No overlap (Define: "gamma delta", Invocation: "alpha beta")
    // Expected: "alpha beta gamma delta"
    console.log('TEST 6: No overlapping classes');
    const no_overlap_elem = this.sid('no_overlap').$;
    const no_overlap_classes = no_overlap_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Define: "gamma delta"`);
    console.log(`  Invocation: "alpha beta"`);
    console.log(`  Result: ${no_overlap_classes.join(' ')}`);
    console.log(`  Expected: alpha beta gamma delta`);
    const has_alpha = no_overlap_classes.includes('alpha');
    const has_beta = no_overlap_classes.includes('beta');
    const has_gamma = no_overlap_classes.includes('gamma');
    const has_delta = no_overlap_classes.includes('delta');
    if (has_alpha && has_beta && has_gamma && has_delta) {
      console.log('✅ TEST 6 PASS: All 4 classes present');
      tests.push(true);
    } else {
      console.log(`❌ TEST 6 FAIL: alpha=${has_alpha}, beta=${has_beta}, gamma=${has_gamma}, delta=${has_delta}`);
      tests.push(false);
    }
    console.log('');

    // TEST 7: Invocation only (Define: none, Invocation: "xyz")
    // Expected: "xyz" (plus framework classes)
    console.log('TEST 7: Invocation only has classes');
    const invocation_only_elem = this.sid('invocation_only').$;
    const invocation_only_classes = invocation_only_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Define: (none)`);
    console.log(`  Invocation: "xyz"`);
    console.log(`  Result: ${invocation_only_classes.join(' ')}`);
    console.log(`  Expected: xyz (plus framework classes)`);
    const has_xyz = invocation_only_classes.includes('xyz');
    if (has_xyz) {
      console.log('✅ TEST 7 PASS: Invocation class present');
      tests.push(true);
    } else {
      console.log(`❌ TEST 7 FAIL: xyz not found in classes`);
      tests.push(false);
    }
    console.log('');

    // TEST 8: Define only (Define: "default-class another-default", Invocation: none)
    // Expected: "default-class another-default" (plus framework classes)
    console.log('TEST 8: Define only has classes');
    const define_only_elem = this.sid('define_only').$;
    const define_only_classes = define_only_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Define: "default-class another-default"`);
    console.log(`  Invocation: (none)`);
    console.log(`  Result: ${define_only_classes.join(' ')}`);
    console.log(`  Expected: default-class another-default (plus framework classes)`);
    const has_default = define_only_classes.includes('default-class');
    const has_another_default = define_only_classes.includes('another-default');
    if (has_default && has_another_default) {
      console.log('✅ TEST 8 PASS: Define classes present');
      tests.push(true);
    } else {
      console.log(`❌ TEST 8 FAIL: default-class=${has_default}, another-default=${has_another_default}`);
      tests.push(false);
    }
    console.log('');

    // TEST 9: Same class in both (Define: "same-class", Invocation: "same-class")
    // Expected: "same-class" - appears only ONCE
    console.log('TEST 9: Same class in both (deduplication)');
    const single_both_elem = this.sid('single_both').$;
    const single_both_classes = single_both_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Define: "same-class"`);
    console.log(`  Invocation: "same-class"`);
    console.log(`  Result: ${single_both_classes.join(' ')}`);
    console.log(`  Expected: same-class (appears only ONCE)`);
    const same_class_count = single_both_classes.filter(c => c === 'same-class').length;
    if (same_class_count === 1) {
      console.log('✅ TEST 9 PASS: same-class appears only once (deduplicated)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 9 FAIL: same-class appears ${same_class_count} times, expected 1`);
      tests.push(false);
    }
    console.log('');

    // PART 3: PROGRAMMATIC COMPONENT CREATION
    console.log('========================================');
    console.log('PART 3: PROGRAMMATIC COMPONENT CREATION');
    console.log('========================================');
    console.log('');

    // TEST 10: Create component on existing DOM element with existing classes
    console.log('TEST 10: Programmatic component creation on existing element');
    const $target = this.$sid('programmatic_target');
    console.log(`  Existing element classes: ${$target.attr('class')}`);
    console.log(`  Creating Class_Overlap_Define component (has "foo baz" in Define)`);

    // Attach component to existing element
    $target.component('Class_Overlap_Define');
    const programmatic_comp = $target.component();

    const programmatic_classes = $target.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Result: ${programmatic_classes.join(' ')}`);
    console.log(`  Expected: existing-class-1 existing-class-2 foo baz (all merged)`);

    const has_existing_1 = programmatic_classes.includes('existing-class-1');
    const has_existing_2 = programmatic_classes.includes('existing-class-2');
    const has_programmatic_foo = programmatic_classes.includes('foo');
    const has_programmatic_baz = programmatic_classes.includes('baz');

    if (has_existing_1 && has_existing_2 && has_programmatic_foo && has_programmatic_baz) {
      console.log('✅ TEST 10 PASS: All classes merged (existing + Define)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 10 FAIL: existing-1=${has_existing_1}, existing-2=${has_existing_2}, foo=${has_programmatic_foo}, baz=${has_programmatic_baz}`);
      tests.push(false);
    }
    console.log('');

    // PART 4: TEMPLATE INHERITANCE CLASS MERGING
    console.log('========================================');
    console.log('PART 4: TEMPLATE INHERITANCE CLASS MERGING');
    console.log('========================================');
    console.log('');

    // TEST 11: Template inheritance chain (Base -> Parent -> Child) with invocation classes
    console.log('TEST 11: Template inheritance class merging');
    const inheritance_elem = this.sid('inheritance_test').$;
    const inheritance_classes = inheritance_elem.attr('class').split(' ').filter(c => c.length > 0);
    console.log(`  Base_Component Define: "base-class"`);
    console.log(`  Parent_Component extends Base, Define: "parent-class"`);
    console.log(`  Child_Component extends Parent, Define: "child-class"`);
    console.log(`  Invocation: "invocation-class"`);
    console.log(`  Result: ${inheritance_classes.join(' ')}`);
    console.log(`  Expected: base-class parent-class child-class invocation-class (all merged)`);

    const has_base = inheritance_classes.includes('base-class');
    const has_parent = inheritance_classes.includes('parent-class');
    const has_child = inheritance_classes.includes('child-class');
    const has_invocation = inheritance_classes.includes('invocation-class');

    if (has_base && has_parent && has_child && has_invocation) {
      console.log('✅ TEST 11 PASS: All inheritance chain classes merged');
      tests.push(true);
    } else {
      console.log(`❌ TEST 11 FAIL: base=${has_base}, parent=${has_parent}, child=${has_child}, invocation=${has_invocation}`);
      tests.push(false);
    }
    console.log('');

    // PART 5: STYLE MERGING TESTS
    console.log('========================================');
    console.log('PART 5: STYLE MERGING TESTS');
    console.log('========================================');
    console.log('');

    // Helper function to parse style string into object
    const parseStyle = (styleStr) => {
      if (!styleStr) return {};
      const styles = {};
      styleStr.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s.trim());
        if (prop && val) styles[prop] = val;
      });
      return styles;
    };

    // TEST 12: Overlapping styles (color in both, invocation wins)
    console.log('TEST 12: Overlapping styles');
    const overlap_style_elem = this.sid('style_overlap').$;
    const overlap_style = parseStyle(overlap_style_elem.attr('style'));
    console.log(`  Define: "color: red; font-size: 14px"`);
    console.log(`  Invocation: "color: blue; margin: 10px"`);
    console.log(`  Result: ${overlap_style_elem.attr('style')}`);
    console.log(`  Expected: color blue (invocation wins), font-size 14px (Define), margin 10px (invocation)`);

    if (overlap_style['color'] === 'blue' &&
        overlap_style['font-size'] === '14px' &&
        overlap_style['margin'] === '10px') {
      console.log('✅ TEST 12 PASS: Style properties merged correctly (invocation wins conflicts)');
      tests.push(true);
    } else {
      console.log(`❌ TEST 12 FAIL: color=${overlap_style['color']}, font-size=${overlap_style['font-size']}, margin=${overlap_style['margin']}`);
      tests.push(false);
    }
    console.log('');

    // TEST 13: No overlapping styles
    console.log('TEST 13: No overlapping styles');
    const no_overlap_style_elem = this.sid('style_no_overlap').$;
    const no_overlap_style = parseStyle(no_overlap_style_elem.attr('style'));
    console.log(`  Define: "padding: 5px; border: 1px solid black"`);
    console.log(`  Invocation: "color: green; margin: 20px"`);
    console.log(`  Result: ${no_overlap_style_elem.attr('style')}`);
    console.log(`  Expected: all 4 properties present`);

    if (no_overlap_style['padding'] === '5px' &&
        no_overlap_style['border'] === '1px solid black' &&
        no_overlap_style['color'] === 'green' &&
        no_overlap_style['margin'] === '20px') {
      console.log('✅ TEST 13 PASS: All style properties merged');
      tests.push(true);
    } else {
      console.log(`❌ TEST 13 FAIL: padding=${no_overlap_style['padding']}, border=${no_overlap_style['border']}, color=${no_overlap_style['color']}, margin=${no_overlap_style['margin']}`);
      tests.push(false);
    }
    console.log('');

    // TEST 14: Invocation only has style
    console.log('TEST 14: Invocation only has style');
    const invocation_only_style_elem = this.sid('style_invocation_only').$;
    const invocation_only_style = parseStyle(invocation_only_style_elem.attr('style'));
    console.log(`  Define: (none)`);
    console.log(`  Invocation: "background: yellow"`);
    console.log(`  Result: ${invocation_only_style_elem.attr('style')}`);
    console.log(`  Expected: background yellow`);

    if (invocation_only_style['background'] === 'yellow') {
      console.log('✅ TEST 14 PASS: Invocation style present');
      tests.push(true);
    } else {
      console.log(`❌ TEST 14 FAIL: background=${invocation_only_style['background']}`);
      tests.push(false);
    }
    console.log('');

    // TEST 15: Define only has style
    console.log('TEST 15: Define only has style');
    const define_only_style_elem = this.sid('style_define_only').$;
    const define_only_style = parseStyle(define_only_style_elem.attr('style'));
    console.log(`  Define: "text-align: center; font-weight: bold"`);
    console.log(`  Invocation: (none)`);
    console.log(`  Result: ${define_only_style_elem.attr('style')}`);
    console.log(`  Expected: text-align center, font-weight bold`);

    if (define_only_style['text-align'] === 'center' &&
        define_only_style['font-weight'] === 'bold') {
      console.log('✅ TEST 15 PASS: Define styles present');
      tests.push(true);
    } else {
      console.log(`❌ TEST 15 FAIL: text-align=${define_only_style['text-align']}, font-weight=${define_only_style['font-weight']}`);
      tests.push(false);
    }
    console.log('');

    // Final result
    console.log('========================================');
    console.log('FINAL RESULTS');
    console.log('========================================');
    const all_passed = tests.every(t => t);
    if (all_passed) {
      console.log(`✅ ALL ${tests.length} TESTS PASSED`);
      this.$sid('results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      const passed_count = tests.filter(t => t).length;
      console.log(`❌ ${passed_count}/${tests.length} TESTS PASSED`);
      this.$sid('results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
    console.log('');
  }
}
