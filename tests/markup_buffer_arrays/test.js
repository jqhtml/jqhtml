class Test_Markup_Buffer_Arrays extends Jqhtml_Component {
  on_create() {
    this.state.evil = [
      '<img class="injected" src="x" onerror="window.__mb_injected = true">',
      '<b class="injected">bold</b>',
    ];
    // The shape content() used to return: [instructions, context]
    this.state.tuple = [['<i class="injected">tuple</i>'], {}];
    this.state.records = [{name: 'a'}, {name: 'b'}];
    this.state.none = [];
  }

  on_default_click() { this.default_click_this = this; }
  on_row_click() { this.row_click_this = this; }
  on_fwd_click() { this.fwd_click_this = this; }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;
    await new Promise((r) => setTimeout(r, 200)); // let an injected onerror fire, if any

    let passed = 0;
    let failed = 0;
    function assert(name, condition) {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    }
    const text = (sid) => this.$sid(sid).text();
    const definer = this;

    console.log('');
    console.log('1. AN ARRAY OF STRINGS PRINTS (Array) IN ALL THREE FORMS:');
    assert('<%= array %> -> ' + JSON.stringify(text('esc')), text('esc') === '(Array)');
    assert('<%!= array %> -> ' + JSON.stringify(text('raw')), text('raw') === '(Array)');
    assert('<%br= array %> -> ' + JSON.stringify(text('br')), text('br') === '(Array)');
    assert('<%= [] %> -> ' + JSON.stringify(text('empty')), text('empty') === '(Array)');

    console.log('');
    console.log('2. AN ARRAY SHAPED LIKE THE OLD [instructions, context] PAIR PRINTS (Array):');
    assert('<%= pair %> -> ' + JSON.stringify(text('tuple_esc')), text('tuple_esc') === '(Array)');
    assert('<%!= pair %> -> ' + JSON.stringify(text('tuple_raw')), text('tuple_raw') === '(Array)');
    assert('<%br= pair %> -> ' + JSON.stringify(text('tuple_br')), text('tuple_br') === '(Array)');

    console.log('');
    console.log('3. NO ARRAY ELEMENT REACHED THE PAGE AS MARKUP:');
    assert('no .injected element exists', document.querySelectorAll('.injected').length === 0);
    assert('no injected handler ran', window.__mb_injected === undefined);

    console.log('');
    console.log('4. DEFAULT CONTENT STILL SPLICES, BOUND TO ITS DEFINER:');
    const default_box = this.sid('default_box');
    assert('default content rendered inside the box', default_box.$.find('.default').find('button').length === 1);
    this.$sid('default_btn').click();
    assert('this in @click === the definer', definer.default_click_this === definer);
    assert('the receiver was not used as this', default_box.default_click_this === undefined);

    console.log('');
    console.log('5. A NAMED SLOT WITH $params STILL SPLICES, BOUND TO ITS DEFINER:');
    const slot_box = this.sid('slot_box');
    const rows = slot_box.$.find('.row-line').map((_, el) => el.textContent).get();
    assert('rows -> ' + JSON.stringify(rows), JSON.stringify(rows) === JSON.stringify(['0:a', '1:b']));
    slot_box.$.find('.row-line').first().click();
    assert('this in a slot @click === the definer', definer.row_click_this === definer);
    assert('the receiver was not used as this', slot_box.row_click_this === undefined);

    console.log('');
    console.log('6. A SLOT FORWARDED THROUGH THREE LEVELS STILL SPLICES, BOUND TO ITS DEFINER:');
    const fwd = this.sid('fwd');
    const items = fwd.$.find('.fwd-item').map((_, el) => el.textContent).get();
    assert('forwarded items -> ' + JSON.stringify(items), JSON.stringify(items) === JSON.stringify(['p', 'q']));
    fwd.$.find('.fwd-item').first().click();
    assert('this in the forwarded @click === the original definer', definer.fwd_click_this === definer);
    assert('the middle component was not used as this', fwd.fwd_click_this === undefined);

    console.log('');
    console.log('7. A COMPONENT WITH NO TEMPLATE STILL RENDERS ITS DEFAULT CONTENT:');
    const undef = this.sid('undef');
    assert('content rendered -> ' + JSON.stringify(undef.$.find('.undef-content').text()),
      undef.$.find('.undef-content').text() === 'undefined wrapper content');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
