class Define_Defaults_Nearest_Template_Wins extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const style_of = (comp) => {
      const rules = {};
      String(comp.$.attr('style') || '').split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s.trim());
        if (prop && val) rules[prop] = val;
      });
      return rules;
    };
    // args, data-* attribute and jQuery data must all agree
    const arg_everywhere = (comp, name, expected) =>
      comp.args[name] === expected && comp.$.attr('data-' + name) === expected &&
      comp.$.data(name) === expected;
    const arg_report = (comp, name) =>
      comp.args[name] + ' / ' + comp.$.attr('data-' + name) + ' / ' + comp.$.data(name);

    try {
      console.log('');
      console.log('A. CHILD DEFINE BEATS PARENT DEFINE (Dn_Parent extends Dn_Grand):');

      const parent = this.sid('parent');
      // Pre-fix each of these got Dn_Grand's value.
      assert('plain attribute: title="parent" -> ' + parent.$.attr('title'),
             parent.$.attr('title') === 'parent');
      assert('data- arg: mode="parent" in this.args, data-mode and .data() -> ' +
             arg_report(parent, 'mode'), arg_everywhere(parent, 'mode', 'parent'));
      const parent_style = style_of(parent);
      assert('style property: color green -> ' + parent.$.attr('style'),
             parent_style.color === 'green');
      assert('style properties only one Define sets are kept (margin 1px, padding 2px)',
             parent_style.margin === '1px' && parent_style.padding === '2px');

      console.log('');
      console.log('B. THREE-LEVEL CHAIN: THE NEAREST DEFINE WINS (Dn_Child > Dn_Parent > Dn_Grand):');

      const child = this.sid('child');
      assert('title="child" -> ' + child.$.attr('title'), child.$.attr('title') === 'child');
      assert('tabindex="-1" -> ' + child.$.attr('tabindex'), child.$.attr('tabindex') === '-1');
      assert('mode="child" in this.args, data-mode and .data() -> ' + arg_report(child, 'mode'),
             arg_everywhere(child, 'mode', 'child'));
      const child_style = style_of(child);
      assert('color blue, margin 1px, padding 2px -> ' + child.$.attr('style'),
             child_style.color === 'blue' && child_style.margin === '1px' && child_style.padding === '2px');
      // Style property order: the losing side's remaining properties first, the
      // winner's last (merge_style), so a losing shorthand cannot reset a winning
      // longhand. color is Dn_Child's, so it comes after Dn_Grand's margin and
      // Dn_Parent's padding.
      assert('style property order is margin, padding, color -> ' + child.$.attr('style'),
             Object.keys(child_style).join(',') === 'margin,padding,color');
      // Dn_Child's $kind (a defineArgs default) beats Dn_Parent's data-kind.
      assert('child $kind beats parent data-kind -> ' + child.args.kind,
             child.args.kind === 'child kind');

      console.log('');
      console.log('C. CLASS STILL MERGES IN THE SAME ORDER:');

      // Farthest Define first, nearer ones appended, de-duplicated - unchanged by the fix.
      assert('Dn_Child class attribute -> ' + child.$.attr('class'),
             child.$.attr('class') === 'Dn_Child Component g1 shared p1 c1');

      console.log('');
      console.log('D. THE INVOCATION BEATS EVERY DEFINE:');

      const invoked = this.sid('invoked');
      assert('invocation title wins -> ' + invoked.$.attr('title'),
             invoked.$.attr('title') === 'invocation');
      assert('invocation tabindex="0" wins -> ' + invoked.$.attr('tabindex'),
             invoked.$.attr('tabindex') === '0');
      assert('invocation data-mode wins in this.args, data-mode and .data() -> ' +
             arg_report(invoked, 'mode'), arg_everywhere(invoked, 'mode', 'invocation'));
      assert('invocation $kind wins -> ' + invoked.args.kind, invoked.args.kind === 'invocation kind');
      const invoked_style = style_of(invoked);
      assert('invocation color wins, Define-only properties still added -> ' + invoked.$.attr('style'),
             invoked_style.color === 'black' && invoked_style.margin === '1px' &&
             invoked_style.padding === '2px');
      assert('invocation + Define classes in the same order -> ' + invoked.$.attr('class'),
             invoked.$.attr('class') === 'inv c1 Dn_Child Component g1 shared p1');

      console.log('');
      console.log('E. SLOT-ONLY JS SUBCLASS (class Dn_Slot_Child extends Dn_Slot_Base, no extends=):');

      const slot_child = this.sid('slot_child');
      assert('rendered the parent template body -> ' + slot_child.$.text().trim(),
             slot_child.$.text().trim() === 'slot child body');
      assert('title="slot child" -> ' + slot_child.$.attr('title'),
             slot_child.$.attr('title') === 'slot child');
      assert('mode="slot child" in this.args, data-mode and .data() -> ' +
             arg_report(slot_child, 'mode'), arg_everywhere(slot_child, 'mode', 'slot child'));
      const slot_style = style_of(slot_child);
      assert('color blue (child), margin 1px (parent) -> ' + slot_child.$.attr('style'),
             slot_style.color === 'blue' && slot_style.margin === '1px');

      console.log('');
      console.log('F. $ KEYS IN defaultAttributes (hand-written templates) AND $ / data- COLLISIONS:');

      // The compiler routes $foo on a <Define> to defineArgs, so a literal $ key in
      // defaultAttributes comes only from a hand-written template. The runtime treats
      // $foo and data-foo as the same arg; across templates the nearer spelling wins.
      const render = function(data, args, content, jqhtml) {
        const _output = new jqhtml.Markup(this); _output.p('<span>hand</span>'); return _output;
      };
      jqhtml.register_template({
        name: 'Dn_Hand_Base', tag: 'div', render,
        defaultAttributes: { '$level': 'base', '$kind': 'base kind', 'data-flag': 'base flag',
                             title: 'hand base' }
      });
      jqhtml.register_template({
        name: 'Dn_Hand_Child', tag: 'div', render, extends: 'Dn_Hand_Base',
        defaultAttributes: { '$level': 'child', 'data-kind': 'child kind', '$flag': 'child flag' }
      });

      const stage = this.$sid('stage');
      const hand = $('<div>').appendTo(stage).component('Dn_Hand_Child', {}).component();
      assert('Dn_Hand_Child reaches ready', await settled(hand.ready(), 2000));
      assert('child $level beats base $level -> ' + arg_report(hand, 'level'),
             arg_everywhere(hand, 'level', 'child'));
      assert('child data-kind beats base $kind -> ' + arg_report(hand, 'kind'),
             arg_everywhere(hand, 'kind', 'child kind'));
      assert('child $flag beats base data-flag -> ' + arg_report(hand, 'flag'),
             arg_everywhere(hand, 'flag', 'child flag'));
      assert('a key only the base sets is still inherited -> ' + hand.$.attr('title'),
             hand.$.attr('title') === 'hand base');

      const hand_inv = $('<div tabindex="0">').appendTo(stage)
        .component('Dn_Hand_Child', { level: 'invocation' }).component();
      assert('programmatic Dn_Hand_Child reaches ready', await settled(hand_inv.ready(), 2000));
      assert('invocation arg beats both $level defaults -> ' + hand_inv.args.level,
             hand_inv.args.level === 'invocation');
      assert('invocation tabindex="0" survives -> ' + hand_inv.$.attr('tabindex'),
             hand_inv.$.attr('tabindex') === '0');
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
