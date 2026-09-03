class Test_Content_Handler_Context extends Jqhtml_Component {
  on_create() {
    this.state.records = [{name: 'a'}, {name: 'b'}];
    this.state.none = [];
  }

  on_slot_click() {
    this.slot_click_this = this;
  }

  on_default_click() {
    this.default_click_this = this;
  }

  on_noop() {}

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name);
        failed++;
      }
    }

    const box = this.sid('box');
    const box2 = this.sid('box2');
    const definer = this;

    console.log('');
    console.log('1. HANDLER IN A SLOT BODY BINDS TO THE DEFINING COMPONENT:');
    this.$sid('slot_btn').click();
    assert('this in @click === the component whose template wrote it', definer.slot_click_this === definer);
    assert('the receiving component was not used as this', box.slot_click_this === undefined);

    console.log('');
    console.log('2. $sid IN A SLOT BODY IS SCOPED TO THE DEFINER (unchanged):');
    assert("definer.$sid('slot_btn') resolves", definer.$sid('slot_btn').length === 1);
    assert("receiver.$sid('slot_btn') does not", box.$sid('slot_btn').length === 0);

    console.log('');
    console.log('3. HAND-WRITTEN id= IN A SLOT BODY SCOPES TO THE DEFINER CID:');
    assert('id="slot_plain" became slot_plain:<definer cid>', document.getElementById('slot_plain:' + definer._cid) !== null);
    assert('...and not slot_plain:<receiver cid>', document.getElementById('slot_plain:' + box._cid) === null);

    console.log('');
    console.log('4. A COMPONENT WRITTEN IN A SLOT BODY REPORTS THE DEFINER AS INSTANTIATOR:');
    const marker = this.sid('slot_marker');
    assert('component in slot body was created', !!marker);
    assert('instantiator() is the definer', marker && marker.instantiator() === definer);
    assert('instantiator() is not the receiver', marker && marker.instantiator() !== box);

    console.log('');
    console.log('5. DEFAULT CONTENT (between component tags) BEHAVES THE SAME:');
    this.$sid('default_btn').click();
    assert('this in @click === the definer', definer.default_click_this === definer);
    assert('receiver was not used as this', box2.default_click_this === undefined);
    const dmarker = this.sid('default_marker');
    assert('component in default content: instantiator() is the definer', dmarker && dmarker.instantiator() === definer);

    console.log('');
    console.log('6. CHILD -> SLOT DATA CHANNEL IS UNCHANGED:');
    const rows = box.$.find('.row-line').map((_, el) => el.textContent).get();
    assert('$params="record, index" receives both arguments -> ' + JSON.stringify(rows),
      JSON.stringify(rows) === JSON.stringify(['0:a', '1:b']));
    const legacy = box.$.find('.legacy-line').text();
    assert('undeclared slot still receives its value as a parameter named after the slot', legacy === 'L');

    console.log('');
    console.log("7. THE RECEIVER'S OWN TEMPLATE IS UNAFFECTED:");
    box.$sid('own_btn').click();
    assert("this in the receiver's own @click === the receiver", box.own_click_this === box);
    assert("receiver.$sid('own_btn') resolves", box.$sid('own_btn').length === 1);
    assert("definer.$sid('own_btn') does not", definer.$sid('own_btn').length === 0);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
