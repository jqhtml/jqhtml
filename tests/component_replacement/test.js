class Test_Container extends Jqhtml_Component {
  async on_ready() {
    const results = [];

    // TEST 1: Create First_Component on target element
    console.log('Creating First_Component...');
    this.$sid('target_element').component('First_Component');
    await this.sid('target_element').ready();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify first component is rendered
    const hasFirstContent = this.$sid('target_element').find('.first-content').length > 0;
    const hasFirstClass = this.$sid('target_element').hasClass('First_Component');
    console.log('First component content present:', hasFirstContent);
    console.log('First component class present:', hasFirstClass);

    // TEST 2: Replace with Second_Component
    console.log('Replacing with Second_Component...');
    this.$sid('target_element').component('Second_Component');
    await this.sid('target_element').ready();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Validation checks
    const hasSecondContent = this.$sid('target_element').find('.second-content').length > 0;
    const firstContentRemoved = this.$sid('target_element').find('.first-content').length === 0;
    const firstClassRemoved = !this.$sid('target_element').hasClass('First_Component');
    const hasSecondClass = this.$sid('target_element').hasClass('Second_Component');

    results.push({
      name: 'Second_Component content is present',
      passed: hasSecondContent
    });
    results.push({
      name: 'First_Component content was removed',
      passed: firstContentRemoved
    });
    results.push({
      name: 'First_Component class was removed',
      passed: firstClassRemoved
    });
    results.push({
      name: 'Second_Component class was added',
      passed: hasSecondClass
    });

    // Output results
    console.log('\n=== VALIDATION RESULTS ===');
    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.name}`);
      if (!result.passed) allPassed = false;
    }

    console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
  }
}
