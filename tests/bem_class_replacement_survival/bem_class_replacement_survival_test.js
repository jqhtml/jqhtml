class Bem_Class_Replacement_Survival_Test extends Jqhtml_Component {
  on_ready() {
    // Only drive the test from the FIRST on_ready; re-renders re-enter here
    if (this.state.testing) return;
    this.state.testing = true;

    setTimeout(async () => {
      console.log('');
      console.log('========================================');
      console.log('TESTING BEM CLASS SURVIVAL DURING REPLACEMENT:');
      console.log('========================================');
      const tests = [];

      // STEP 1: Create First_Comp on the target element
      console.log('Creating First_Comp on target element...');
      this.$sid('target').component('First_Comp');
      await this.sid('target').ready();

      // STEP 2: Manually add a BEM-style class and a plain state class,
      // simulating app code that decorates a component's root element
      // after it has booted (e.g. a parent adding 'Widget__icon active').
      this.$sid('target').addClass('Widget__icon active');

      const startingClasses = this.$sid('target').attr('class');
      console.log('Starting classes:', startingClasses);

      // TEST 1: sanity check - starting state has all 3 expected classes
      const startOk =
        this.$sid('target').hasClass('First_Comp') &&
        this.$sid('target').hasClass('Widget__icon') &&
        this.$sid('target').hasClass('active');
      if (startOk) {
        console.log('✅ TEST 1 PASS: starting classes include First_Comp, Widget__icon, active');
        tests.push(true);
      } else {
        console.log(`❌ TEST 1 FAIL: starting classes were "${startingClasses}", missing expected class(es)`);
        tests.push(false);
      }

      // STEP 3: Replace First_Comp with Second_Comp on the same element
      console.log('Replacing with Second_Comp...');
      this.$sid('target').component('Second_Comp');
      await this.sid('target').ready();

      const finalClasses = this.$sid('target').attr('class');
      console.log('Final classes:', finalClasses);

      // TEST 2: First_Comp class removed (capital-letter component class, no '__')
      const firstCompRemoved = !this.$sid('target').hasClass('First_Comp');
      if (firstCompRemoved) {
        console.log('✅ TEST 2 PASS: First_Comp class was removed');
        tests.push(true);
      } else {
        console.log('❌ TEST 2 FAIL: First_Comp class is still present');
        tests.push(false);
      }

      // TEST 3: Second_Comp class present (new component's identity class)
      const secondCompPresent = this.$sid('target').hasClass('Second_Comp');
      if (secondCompPresent) {
        console.log('✅ TEST 3 PASS: Second_Comp class is present');
        tests.push(true);
      } else {
        console.log('❌ TEST 3 FAIL: Second_Comp class is missing');
        tests.push(false);
      }

      // TEST 4: Widget__icon PRESERVED - contains '__', so it survives even
      // though it starts with a capital letter
      const bemPreserved = this.$sid('target').hasClass('Widget__icon');
      if (bemPreserved) {
        console.log('✅ TEST 4 PASS: Widget__icon (BEM class) was preserved');
        tests.push(true);
      } else {
        console.log('❌ TEST 4 FAIL: Widget__icon (BEM class) was stripped - it should survive since it contains "__"');
        tests.push(false);
      }

      // TEST 5: active preserved (plain lowercase class, never stripped)
      const activePreserved = this.$sid('target').hasClass('active');
      if (activePreserved) {
        console.log('✅ TEST 5 PASS: active class was preserved');
        tests.push(true);
      } else {
        console.log('❌ TEST 5 FAIL: active class was stripped');
        tests.push(false);
      }

      // TEST 6: new content actually rendered (sanity check replacement really happened)
      const hasSecondContent = this.$sid('target').find('.second-content').length > 0;
      const firstContentRemoved = this.$sid('target').find('.first-content').length === 0;
      if (hasSecondContent && firstContentRemoved) {
        console.log('✅ TEST 6 PASS: Second_Comp content rendered, First_Comp content removed');
        tests.push(true);
      } else {
        console.log(`❌ TEST 6 FAIL: hasSecondContent=${hasSecondContent}, firstContentRemoved=${firstContentRemoved}`);
        tests.push(false);
      }

      console.log('');
      if (tests.every(t => t)) {
        console.log('✅ ALL TESTS PASSED');
        $('#results').html('<span style="color: green;">✅ All tests passed</span>');
      } else {
        console.log('❌ SOME TESTS FAILED');
        $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
      }
      console.log('========================================');
    }, 300);
  }
}
