class Test_Empty_Slot_Content extends Jqhtml_Component {
  on_create() {
    this.state.records = [
      {name: 'a', show: true},
      {name: 'b', show: false},
      {name: 'c', show: true},
    ];
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    function assert(name, condition) {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    }
    // Es_Row draws .note only when content('note') was truthy
    const note_drawn = (sid) => this.sid(sid).$.find('.note').length === 1;
    const fwd_note_drawn = (sid) => this.sid(sid).$.find('.Es_Row .note').length === 1;

    console.log('');
    console.log('1. A SLOT THAT EMITS NOTHING IS FALSY, LIKE AN ABSENT ONE:');
    assert('absent slot', !note_drawn('absent'));
    assert('<Slot:note></Slot:note>', !note_drawn('written_empty'));
    assert('slot holding only line breaks and indentation', !note_drawn('whitespace'));
    assert("slot whose expressions print '' / null and whose if is false", !note_drawn('empty_values'));

    console.log('');
    console.log('2. A SLOT THAT EMITS SOMETHING IS TRUTHY AND SPLICES:');
    assert('text', note_drawn('text') && this.sid('text').$.find('.note').text() === 'Text');
    assert('an empty element', note_drawn('tag') && this.sid('tag').$.find('.note b').length === 1);
    assert('a component that renders nothing', note_drawn('component') && this.sid('component').$.find('.note .Es_Leaf').length === 1);
    assert('&nbsp; written in the template', note_drawn('nbsp_entity'));
    assert('a printed U+00A0 (not HTML whitespace)', note_drawn('nbsp_char'));
    assert('a printed 0', note_drawn('zero') && this.sid('zero').$.find('.note').text() === '0');

    console.log('');
    console.log("3. '' PRINTED UNCONDITIONALLY PRINTS NOTHING:");
    assert('absent', this.sid('absent').$.find('.unconditional').html() === '');
    assert('written empty', this.sid('written_empty').$.find('.unconditional').html() === '');

    console.log('');
    console.log('4. A SLOT PASSED DOWN COUNTS BY WHAT IT EMITS:');
    assert('empty slot passed down is falsy below', !fwd_note_drawn('fwd_empty'));
    assert('absent slot passed down is falsy below', !fwd_note_drawn('fwd_absent'));
    assert('text passed down is truthy below', fwd_note_drawn('fwd_text') &&
      this.sid('fwd_text').$.find('.note').text() === 'passed down');

    console.log('');
    console.log('5. DEFAULT CONTENT FOLLOWS THE SAME RULE:');
    assert('<Es_Box />', this.sid('box_none').$.find('.body').length === 0);
    assert('whitespace-only body', this.sid('box_whitespace').$.find('.body').length === 0);
    assert('text body', this.sid('box_text').$.find('.body').text() === 'body text');

    console.log('');
    console.log('6. SLOT-ONLY INHERITANCE FOLLOWS THE SAME RULE:');
    assert('inherited empty slot', !note_drawn('inherit_empty'));
    assert('inherited text slot', note_drawn('inherit_text') &&
      this.sid('inherit_text').$.find('.note').text() === 'inherited note');

    console.log('');
    console.log('7. A SLOT WITH $params IS JUDGED PER CALL:');
    const items = this.sid('list').$.find('.item').map((_, el) => el.textContent).get();
    assert('items -> ' + JSON.stringify(items), JSON.stringify(items) === JSON.stringify(['a', 'c']));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
