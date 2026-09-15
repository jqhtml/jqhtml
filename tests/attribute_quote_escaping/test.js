class Test_Attribute_Quote_Escaping extends Jqhtml_Component {
  on_create() {
    this.state.evil = 'x" onmouseover="alert(1)" data-injected="yes';
  }

  on_click() {}

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;
    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const evil = this.state.evil;

    console.log('');
    console.log('1. A " IN AN INTERPOLATED ATTRIBUTE VALUE STAYS INSIDE THE ATTRIBUTE:');
    const plain_id_el = $(document.getElementById('label'));
    for (const sid of ['plain', 'tracked', 'plain_id', 'child']) {
      const el = sid === 'plain_id' ? plain_id_el : this.$sid(sid);
      assert(sid + ': title holds the whole value -> ' + JSON.stringify(el.attr('title')), el.attr('title') === evil);
      assert(sid + ': no injected attribute appeared', el.attr('data-injected') === undefined && el.attr('onmouseover') === undefined);
    }

    console.log('');
    console.log('2. A HAND-WRITTEN id ON A TRACKED ELEMENT IS EMITTED VERBATIM:');
    // A plain id is never rewritten. It used to become `<value>:<cid>` when - and only
    // when - the element carried some other tracked attribute (@click here), so two
    // otherwise identical elements disagreed. $sid is the per-instance id.
    assert('id="label" resolves as exactly label', plain_id_el.length === 1);
    const label = $(document.getElementById('plain_label'));
    assert('id="plain_label" resolves as exactly plain_label', label.length === 1);
    assert('the <label> kept its for attribute -> ' + label.attr('for'), label.attr('for') === 'x');
    const scoped_ids = Array.from(document.querySelectorAll('[id]'))
      .map(el => el.id)
      .filter(id => id.indexOf('label:') === 0 || id.indexOf('plain_label:') === 0);
    assert('no scoped label:<cid> / plain_label:<cid> id exists -> ' + scoped_ids.join(','),
           scoped_ids.length === 0);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
