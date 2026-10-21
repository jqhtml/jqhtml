/**
 * render_sid_lookup_errors
 *
 * render(sid), redraw(sid) and the internal _render(sid) find the $redrawable child
 * behind a $sid with one shared lookup (Jqhtml_Component._redraw_target). Pins what
 * that lookup does: it delegates to the child for a $redrawable element, and throws
 * the same two errors - no such $sid, or an element that is not a component - from
 * every entry point, synchronously.
 */
class Test_Render_Sid_Lookup extends Jqhtml_Component {
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
    const thrown = (fn) => {
      try { fn(); } catch (e) { return e.message; }
      return null;
    };

    const no_such = '[JQHTML] render("missing") - no such id.\n' +
      'Component "Test_Render_Sid_Lookup" has no child element with $sid="missing".';
    const not_comp = '[JQHTML] render("plain") - element is not a component or does not have $redrawable attribute set.\n' +
      'Element with $sid="plain" exists but is not initialized as a component.\n' +
      'Add $redrawable attribute or make it a proper component.';

    console.log('');
    console.log('1. UNKNOWN $sid THROWS:');
    assert('render("missing")', thrown(() => this.render('missing')) === no_such, thrown(() => this.render('missing')));
    assert('redraw("missing")', thrown(() => this.redraw('missing')) === no_such, thrown(() => this.redraw('missing')));
    assert('_render("missing")', thrown(() => this._render('missing')) === no_such, thrown(() => this._render('missing')));

    console.log('');
    console.log('2. NON-COMPONENT $sid THROWS:');
    assert('render("plain")', thrown(() => this.render('plain')) === not_comp, thrown(() => this.render('plain')));
    assert('redraw("plain")', thrown(() => this.redraw('plain')) === not_comp, thrown(() => this.redraw('plain')));
    assert('_render("plain")', thrown(() => this._render('plain')) === not_comp, thrown(() => this._render('plain')));

    console.log('');
    console.log('3. $redrawable $sid DELEGATES TO THE CHILD:');
    const counter = this.sid('counter');
    let child_renders = 0;
    counter.on('render', () => { child_renders++; });
    const base = child_renders;  // 'render' is sticky: subscribing fired it once
    this.state.count = 5;
    await this.render('counter');
    assert('child re-rendered once', child_renders === base + 1, child_renders - base);
    assert('child shows the new state', this.$sid('counter').text().trim() === 'Count: 5', this.$sid('counter').text().trim());
    this.state.count = 6;
    await this.redraw('counter');
    assert('redraw(sid) re-rendered the child', this.$sid('counter').text().trim() === 'Count: 6', this.$sid('counter').text().trim());

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
