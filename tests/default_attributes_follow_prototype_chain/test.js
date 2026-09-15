class Default_Attributes_Follow_Prototype_Chain extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);

    try {
      console.log('');
      console.log('A. A SLOT-ONLY JS SUBCLASS INHERITS THE PARENT DEFINE\'S ATTRIBUTES:');

      const child = this.sid('child');
      assert('Da_Child booted -> ' + !!child, !!child);

      // Pre-fix these three failed: the extends= chain is empty for Da_Child, so
      // Da_Base's <Define> attributes were never collected.
      assert('Da_Child has the parent Define class "card" -> ' + child.$.attr('class'),
             child.$.hasClass('card'));
      assert('Da_Child has role="region" -> ' + child.$.attr('role'),
             child.$.attr('role') === 'region');
      assert('Da_Child has tabindex="-1" -> ' + child.$.attr('tabindex'),
             child.$.attr('tabindex') === '-1');

      // The template itself still comes from the same chain, as it always did.
      assert('Da_Child rendered the parent template body -> ' + child.$.text().trim(),
             child.$.text().trim() === 'child body');
      assert('Da_Child still carries its own component class', child.$.hasClass('Da_Child'));

      console.log('');
      console.log('B. AN INVOCATION ATTRIBUTE OF "0" OR "" IS NOT A DEFINE DEFAULT:');

      const zero = this.sid('zero');
      // Pre-fix: !this.$.attr('tabindex') is true for "0", so the Define's -1 won.
      assert('an invocation tabindex="0" survives the Define default -> ' + zero.$.attr('tabindex'),
             zero.$.attr('tabindex') === '0');

      // Pre-fix this failed: attr('title') is "" -> falsy -> the Define's
      // title="define default" overwrote a deliberately blank attribute.
      const empty = this.sid('empty');
      assert('an invocation title="" is not replaced by the Define default -> ' +
             JSON.stringify(empty.$.attr('title')),
             empty.$.attr('title') === '');
      assert('a Da_Base with no title DOES get the Define default -> ' + zero.$.attr('title'),
             zero.$.attr('title') === 'define default');

      console.log('');
      console.log('C. THE SAME HOLDS FOR A PROGRAMMATICALLY CREATED COMPONENT:');

      const stage = this.$sid('stage');
      const made = $('<div tabindex="0">').appendTo(stage).component('Da_Child', {}).component();
      assert('the programmatic Da_Child reaches ready', await settled(made.ready(), 2000));
      assert('it inherited class "card" -> ' + made.$.attr('class'), made.$.hasClass('card'));
      assert('its own tabindex="0" survived -> ' + made.$.attr('tabindex'),
             made.$.attr('tabindex') === '0');
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
