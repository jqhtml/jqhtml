// @click handlers in caller-written content run with `this` = the component whose
// template wrote them (content_handler_context covers the plain one-level case).
// This test covers the three paths that one does not:
//   A. a slot-only template: its slot bodies are rendered inside the parent template it
//      inherits, by extends="" and by the JS class prototype chain
//   B. slot content after the RECEIVING component calls render() (and after the
//      definer re-renders)
//   C. a slot body forwarded through a middle component (<Slot:item><%= content('item',
//      item) %></Slot:item>) and rendered by a third

class Slot_Handler_Binding_Paths extends Jqhtml_Component {
  on_box_slot_click() { this.box_slot_click_this = this; }
  on_box_default_click() { this.box_default_click_this = this; }
  on_forwarded_click() { this.forwarded_click_this = this; this.forwarded_clicks = (this.forwarded_clicks || 0) + 1; }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const name_of = (c) => c ? (c.constructor && c.constructor.name) + '#' + c._cid : String(c);
    const page = this;

    try {
      for (const [label, sid, cls] of [['extends=""', 'ext_grid', 'Shb_Extends_Grid'], ['JS class chain', 'cls_grid', 'Shb_Class_Grid']]) {
        console.log('');
        console.log('A. SLOT-ONLY TEMPLATE (' + label + '):');
        const grid = this.sid(sid);
        assert(cls + ' rendered through the parent template', !!grid && grid.$.find('.grid-header').length === 1 && grid.$.find('.row-btn').length === 1);
        grid.$sid('hdr_btn').click();
        assert('@click in its <Slot:header> runs with this = the ' + cls + ' instance -> ' + name_of(grid.header_click_this),
               grid.header_click_this === grid);
        assert('the page that invoked it was not used as this', page.header_click_this === undefined);
        grid.$.find('.row-btn').click();
        assert('@click in its <Slot:row> (called with an argument) runs with this = the instance -> ' + name_of(grid.row_click_this),
               grid.row_click_this === grid);
        const marker = grid.sid('hdr_marker');
        assert('a component in its slot body was created and $sid-scoped to the instance', !!marker);
        assert('instantiator() of that component is the ' + cls + ' instance -> ' + name_of(marker && marker.instantiator()),
               !!marker && marker.instantiator() === grid);
      }

      console.log('');
      console.log('B. AFTER THE RECEIVING COMPONENT RE-RENDERS:');
      const box = this.sid('box');
      const box2 = this.sid('box2');
      const renders = box.state.renders;
      const renders2 = box2.state.renders;
      await box.render();
      await box2.render();
      assert('both boxes re-rendered -> ' + renders + '/' + renders2 + ' -> ' + box.state.renders + '/' + box2.state.renders,
             box.state.renders === renders + 1 && box2.state.renders === renders2 + 1);
      this.$sid('box_slot_btn').click();
      assert('@click in a <Slot:> body still runs with this = the definer -> ' + name_of(page.box_slot_click_this),
             page.box_slot_click_this === page);
      assert('the receiver was not used as this', box.box_slot_click_this === undefined);
      this.$sid('box_default_btn').click();
      assert('@click in default content still runs with this = the definer -> ' + name_of(page.box_default_click_this),
             page.box_default_click_this === page);
      assert('the receiver was not used as this', box2.box_default_click_this === undefined);
      const box_marker = this.sid('box_slot_marker');
      assert('a component in the slot body still reports the definer from instantiator() -> ' + name_of(box_marker && box_marker.instantiator()),
             !!box_marker && box_marker.instantiator() === page);

      console.log('');
      console.log('B2. AFTER THE DEFINER RE-RENDERS:');
      page.box_slot_click_this = undefined;
      await page.render();
      const box_after = this.sid('box');
      this.$sid('box_slot_btn').click();
      assert('@click in the slot body runs with this = the definer -> ' + name_of(page.box_slot_click_this),
             page.box_slot_click_this === page);
      assert('the (new) receiver was not used as this', !!box_after && box_after.box_slot_click_this === undefined);

      console.log('');
      console.log('C. THREE-LEVEL FORWARDING (page -> Shb_Middle -> Shb_Leaf):');
      const middle = this.sid('middle');
      const leaf = middle.sid('leaf');
      const buttons = middle.$.find('.fwd-btn');
      assert('the forwarded slot rendered once per leaf item -> ' + buttons.map((_, el) => el.textContent).get().join(','),
             buttons.length === 2 && buttons.eq(0).text() === 'x' && buttons.eq(1).text() === 'y');
      buttons.eq(1).click();
      assert('@click in the forwarded slot body runs with this = the page that wrote it -> ' + name_of(page.forwarded_click_this),
             page.forwarded_click_this === page && page.forwarded_clicks === 1);
      assert('the middle component was not used as this', middle.forwarded_click_this === undefined);
      assert('the leaf component was not used as this', !!leaf && leaf.forwarded_click_this === undefined);
      const fwd_marker = middle.$.find('.fwd-marker').first().component();
      assert('a component in the forwarded slot body reports the page from instantiator() -> ' + name_of(fwd_marker && fwd_marker.instantiator()),
             !!fwd_marker && fwd_marker.instantiator() === page);

      console.log('');
      console.log('C2. FORWARDED SLOT AFTER THE LEAF RE-RENDERS:');
      await leaf.render();
      page.forwarded_click_this = undefined;
      middle.$.find('.fwd-btn').eq(0).click();
      assert('@click still runs with this = the page -> ' + name_of(page.forwarded_click_this),
             page.forwarded_click_this === page);
      assert('the leaf was not used as this', leaf.forwarded_click_this === undefined);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + (error && error.stack || error));
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
