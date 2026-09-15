class Money { constructor(cents) { this.cents = cents; } toString() { return 'coerced:' + this.cents; } }
class Markup { constructor(html) { this.html = html; } }
class Rich_Text { constructor(html, label) { this.html = html; this.label = label; } }

let printer_calls = 0;
window.jqhtml.add_object_printer((v) => {
  printer_calls++;
  if (v instanceof Money) return '$' + (v.cents / 100).toFixed(2) + ' <b>&</b>';
  if (v instanceof Markup) return v.html;
  if (v instanceof Rich_Text) return { component: { name: 'Vp_Rich_Text', args: { value: v.html, label: v.label }, attrs: { class: 'rich-text', 'data-kind': 'rich' } } };
  return undefined;
});

class Test_Value_Printers extends Jqhtml_Component {
  on_create() {
    this.state.price = new Money(1234);
    this.state.markup = new Markup('<i>it</i> & co');
    this.state.lines = new Markup('a\n<b>');
    this.state.rich = new Rich_Text('<p>hello</p>', 'first');
    this.state.rows = [1, 2, 3].map((n) => ({ body: new Rich_Text('<em>row ' + n + '</em>', 'row' + n) }));
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;
    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    console.log('');
    console.log('1. STRING RESULTS FOLLOW THE CONSTRUCT:');
    assert('<%= %> escapes a printer string -> ' + this.$sid('money').html(), this.$sid('money').html() === '$12.34 &lt;b&gt;&amp;&lt;/b&gt;');
    assert('<%= %> escapes markup from a printer', this.$sid('escaped').html() === '&lt;i&gt;it&lt;/i&gt; &amp; co');
    assert('<%!= %> leaves a printer string unescaped', this.$sid('raw').find('i').length === 1);
    assert('<%br= %> escapes and converts newlines', this.$sid('nl2br').html() === 'a<br>&lt;b&gt;');

    console.log('');
    console.log('2. A DESCRIPTOR MOUNTS THE NAMED COMPONENT WITH ARGS AND ATTRS:');
    const rich = this.$sid('rich').find('.Vp_Rich_Text').first();
    const rich_component = rich.length ? rich.component() : null;
    assert('component element mounted', rich.length === 1);
    assert('it is a live Vp_Rich_Text instance', rich_component && rich_component.component_name() === 'Vp_Rich_Text');
    assert('args arrived ($value, $label)', rich_component && rich_component.args.value === '<p>hello</p>' && rich_component.args.label === 'first');
    assert('attrs landed on the element (class, data-kind)', rich.hasClass('rich-text') && rich.attr('data-kind') === 'rich');
    assert('the component rendered its arg', rich.find('p').text() === 'hello' && rich.find('.label').text() === 'first');
    assert('no wrapper element between the host and the component', rich.parent()[0] === this.$sid('rich')[0]);

    console.log('');
    console.log('3. A PRINTER-PRODUCED COMPONENT IN A LIST RENDERS ONCE PER ROW:');
    const rows = this.$sid('list').find('li');
    assert('three rows', rows.length === 3);
    assert('each row holds exactly one Vp_Rich_Text', rows.toArray().every((li) => li.querySelectorAll('.Vp_Rich_Text').length === 1));
    assert('rows carry their own args -> ' + rows.last().find('.label').text(), rows.last().find('.label').text() === 'row3' && rows.first().find('em').text() === 'row 1');

    console.log('');
    console.log('4. ATTRIBUTE POSITION DOES NOT USE PRINTERS:');
    const title = this.$sid('attr').attr('title');
    assert('title attribute is not the printer output -> ' + JSON.stringify(title), title !== '$12.34 <b>&</b>' && !(title || '').includes('12.34'));
    assert('no Vp_Rich_Text was mounted from an attribute', this.$sid('attr').find('.Component').length === 0);

    console.log('');
    console.log('5. PRIMITIVES NEVER ENTER THE CHAIN:');
    const before = printer_calls;
    const probe = $('<div>').component('Vp_Primitives', { s: 'str', n: 5, b: true }).appendTo(this.$).component();
    await probe.ready();
    assert('rendered primitives -> ' + probe.$.text().trim(), probe.$.text().replace(/\s+/g, ' ').trim() === 'str 5 true a,b');
    assert('printer was not invoked for string, number, boolean, null, undefined or array', printer_calls === before);

    console.log('');
    console.log('6. AN UNHANDLED OBJECT THROWS:');
    const boot_errors = [];
    const original_error = console.error;
    console.error = (...a) => { boot_errors.push(a.map(String).join(' ')); original_error.apply(console, a); };
    $('<div>').component('Vp_Orphan', { obj: new Date(0) }).appendTo(this.$);
    await new Promise((r) => setTimeout(r, 300));
    console.error = original_error;
    assert('Date reaching <%= %> throws naming the constructor', boot_errors.some((m) => /Cannot interpolate a Date object/.test(m)));
    assert('the orphan never mounted a rendered body', this.$.find('.Vp_Orphan').text().trim() === '');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
