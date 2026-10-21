class Define_Args_Inherited extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    // The template must render what this.args holds
    const rendered = (comp) => comp.$.find('.ia-size').first().text().trim();

    try {
      console.log('');
      console.log('A. A PARENT $ DEFAULT REACHES AN extends= CHILD THAT DOES NOT SET IT (Ia_Mid extends Ia_Base):');

      const mid = this.sid('mid');
      assert('args.size = parent "base size" -> ' + mid.args.size, mid.args.size === 'base size');
      assert('template renders "base size" -> ' + rendered(mid), rendered(mid) === 'base size');
      assert('args.flag = parent "base flag" -> ' + mid.args.flag, mid.args.flag === 'base flag');
      assert('own $level beats parent -> ' + mid.args.level, mid.args.level === 'mid');

      console.log('');
      console.log('B. THE CHILD\'S OWN $size BEATS THE PARENT\'S (Ia_Sized extends Ia_Base):');

      const sized = this.sid('sized');
      assert('args.size = "sized size" -> ' + sized.args.size, sized.args.size === 'sized size');
      assert('template renders "sized size" -> ' + rendered(sized), rendered(sized) === 'sized size');
      assert('unset $level still inherited -> ' + sized.args.level, sized.args.level === 'base');

      console.log('');
      console.log('C. THREE-LEVEL CHAIN (Ia_Leaf extends Ia_Mid extends Ia_Base):');

      const leaf = this.sid('leaf');
      assert('$size from the grandparent -> ' + leaf.args.size, leaf.args.size === 'base size');
      assert('$flag from the grandparent -> ' + leaf.args.flag, leaf.args.flag === 'base flag');
      assert('$mid_only from the parent -> ' + leaf.args.mid_only, leaf.args.mid_only === 'mid only');
      assert('$level set at all three levels: nearest wins -> ' + leaf.args.level, leaf.args.level === 'leaf');
      assert('template renders "base size" -> ' + rendered(leaf), rendered(leaf) === 'base size');

      console.log('');
      console.log('D. SLOT-ONLY JS SUBCLASS (class Ia_Slot_Child extends Ia_Slot_Base, no extends=):');

      const slot_child = this.sid('slot_child');
      assert('$size from Ia_Slot_Base -> ' + slot_child.args.size, slot_child.args.size === 'slot base size');
      assert('own $level beats Ia_Slot_Base -> ' + slot_child.args.level, slot_child.args.level === 'slot child');
      const slot_text = slot_child.$.find('.ia-slot-body').text().replace(/\s+/g, ' ').trim();
      assert('parent template renders the inherited arg and the slot -> ' + slot_text,
             slot_text === 'slot base size | slot child body');

      console.log('');
      console.log('E. AN INVOCATION ARG BEATS EVERY <Define>:');

      const invoked = this.sid('invoked');
      assert('$size at the invocation -> ' + invoked.args.size, invoked.args.size === 'invocation size');
      assert('$level at the invocation -> ' + invoked.args.level, invoked.args.level === 'invocation level');
      assert('template renders the invocation value -> ' + rendered(invoked), rendered(invoked) === 'invocation size');

      const stage = this.$sid('stage');
      const prog = $('<div>').appendTo(stage).component('Ia_Leaf', { size: 'programmatic size' }).component();
      assert('programmatic Ia_Leaf reaches ready', await settled(prog.ready(), 2000));
      assert('programmatic arg beats the inherited $size -> ' + prog.args.size, prog.args.size === 'programmatic size');
      assert('programmatic: unset args still inherited -> ' + prog.args.flag + ' / ' + prog.args.mid_only,
             prog.args.flag === 'base flag' && prog.args.mid_only === 'mid only');

      console.log('');
      console.log('F. A data- ATTRIBUTE AT THE INVOCATION BEATS EVERY <Define>:');

      const data_invoked = this.sid('data_invoked');
      assert('data-size at the invocation -> ' + data_invoked.args.size, data_invoked.args.size === 'data size');
      assert('data-level at the invocation -> ' + data_invoked.args.level, data_invoked.args.level === 'data level');
      assert('template renders the data- value -> ' + rendered(data_invoked), rendered(data_invoked) === 'data size');

      const prog_data = $('<div data-size="element data size">').appendTo(stage).component('Ia_Leaf', {}).component();
      assert('programmatic Ia_Leaf on a data- element reaches ready', await settled(prog_data.ready(), 2000));
      assert('element data-size beats the inherited $size -> ' + prog_data.args.size,
             prog_data.args.size === 'element data size');

      console.log('');
      console.log('G. $ ARG AND data- ATTRIBUTE DEFAULTS: THE NEARER <Define> WINS, EITHER SPELLING:');

      const data_mid = this.sid('data_mid');
      assert('Ia_Data_Mid data-size beats Ia_Base $size -> ' + data_mid.args.size + ' / ' + data_mid.$.attr('data-size'),
             data_mid.args.size === 'mid data' && data_mid.$.attr('data-size') === 'mid data');
      const data_leaf = this.sid('data_leaf');
      assert('Ia_Data_Leaf (sets nothing) gets Ia_Data_Mid data-size, not Ia_Base $size -> ' + data_leaf.args.size,
             data_leaf.args.size === 'mid data');
      const arg_mid = this.sid('arg_mid');
      assert('Ia_Arg_Mid $size beats Ia_Data_Top data-size -> ' + arg_mid.args.size, arg_mid.args.size === 'mid arg');
      const arg_leaf = this.sid('arg_leaf');
      assert('Ia_Arg_Leaf (sets nothing) gets Ia_Arg_Mid $size, not Ia_Data_Top data-size -> ' + arg_leaf.args.size,
             arg_leaf.args.size === 'mid arg');
      assert('Ia_Arg_Leaf renders "mid arg" -> ' + rendered(arg_leaf), rendered(arg_leaf) === 'mid arg');

      console.log('');
      console.log('H. on_load() AND THE CACHE KEY SEE THE INHERITED ARG (Ia_Loaded extends Ia_Base):');

      const loaded = this.sid('loaded');
      assert('on_load() read args.size = "base size" -> ' + loaded.data.seen_size, loaded.data.seen_size === 'base size');
      assert('rendered after load -> ' + loaded.$.find('.ia-loaded').text().trim(),
             loaded.$.find('.ia-loaded').text().trim() === 'base size');
      // _cache_key is null when no cache is configured; when there is one it is built
      // from this.args, so it must carry the inherited value.
      assert('cache key (when caching) carries the inherited arg -> ' + loaded._cache_key,
             !loaded._cache_key || String(loaded._cache_key).includes('base size'));
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
