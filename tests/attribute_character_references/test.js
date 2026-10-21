/**
 * attribute_character_references
 *
 * A quoted attribute value means what it means in static HTML on every path. The
 * compiler resolves character references in literal value text (&amp; &lt; &quot;
 * &#39; &copy ..., with the HTML tokenizer's rules), and the runtime encodes & and "
 * when it writes attribute HTML. Before, only a plain tag got the decoded value: a
 * tag with @click/$sid, a component attribute, a $ arg and a Define default kept the
 * raw "&amp;" text, and interpolated text was decoded on a plain tag only.
 *
 * Expected values come from the browser's own parse of the same markup.
 */
class Attribute_Character_References extends Jqhtml_Component {
  on_create() {
    this.state.v = '&lt; &amp; "q" &copy';
  }

  on_click() {}

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };
    const static_value = (attr_text) => {
      const div = document.createElement('div');
      div.innerHTML = '<b title="' + attr_text + '"></b>';
      return div.firstChild.getAttribute('title');
    };

    // The spec value of 'a &lt;i&gt; &amp; &quot;q&quot; &#39;s&#x27; &amp=x &copy; &copyx &#x80;'.
    // Written out rather than taken from innerHTML: Chromium's innerHTML/DOMParser fast
    // path decodes "&amp=x" and "&copyx" when the same value also holds a non-ASCII
    // reference such as &#x80; (its full document parser, Firefox, WebKit and the spec
    // keep them literal - the historical attribute rule).
    const expected = 'a <i> & "q" \'s\' &amp=x \u00a9 &copyx \u20ac';

    console.log('');
    console.log('1. STATIC VALUES MATCH STATIC HTML:');
    assert('plain tag', this.$.find('.plain').attr('title') === expected, this.$.find('.plain').attr('title'));
    assert('tag with @click and $sid', this.$sid('tracked').attr('title') === expected, this.$sid('tracked').attr('title'));
    assert('data-x attribute and .data()', this.$sid('tracked').attr('data-x') === '1 & 2' && this.$sid('tracked').data('x') === '1 & 2',
      [this.$sid('tracked').attr('data-x'), this.$sid('tracked').data('x')]);
    assert('component invocation attribute', this.$sid('invoked').attr('title') === expected, this.$sid('invoked').attr('title'));
    assert('$ arg', this.sid('invoked').args.arg === static_value('v &lt;i&gt; &amp;'), this.sid('invoked').args.arg);
    assert('Define default', this.$sid('defaulted').attr('title') === static_value('d &lt;i&gt; &amp; &quot;q&quot; &copy x'),
      this.$sid('defaulted').attr('title'));
    assert('textarea (raw content tag)', this.$.find('.raw').attr('title') === 'r & <', this.$.find('.raw').attr('title'));
    assert('id on a tag', this.$.find('.id_plain').attr('id') === 'x&y', this.$.find('.id_plain').attr('id'));
    assert('id on a component', this.$.find('.id_comp').attr('id') === 'c&d', this.$.find('.id_comp').attr('id'));

    console.log('');
    console.log('2. INTERPOLATED VALUES ARE LITERAL:');
    const v = this.state.v;
    assert('plain tag', this.$.find('.dyn_plain').attr('title') === v, this.$.find('.dyn_plain').attr('title'));
    assert('tag with @click and $sid', this.$sid('dyn_tracked').attr('title') === v, this.$sid('dyn_tracked').attr('title'));
    assert('component, literal text around it resolved', this.$sid('dyn_comp').attr('title') === 'pre & ' + v, this.$sid('dyn_comp').attr('title'));

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
