/**
 * redrawable_and_scoped_sids - $sid scopes ids to the RENDERING component's _cid (on HTML
 * tags and component tags alike), plain id passes through, $sid wins over id, and a
 * $redrawable element is a Redrawable component that render(sid) re-renders alone.
 */
class Span_Redrawable_Test extends Jqhtml_Component {
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
    const cid = this._cid;

    // $sid on an HTML tag
    const $p = this.$sid('test_p');
    assert('<p $sid="test_p"> -> id="test_p:<parent cid>"', $p.is('p') && $p.attr('id') === 'test_p:' + cid, $p.attr('id'));
    assert('<p $sid> carries data-sid="test_p"', $p.attr('data-sid') === 'test_p', $p.attr('data-sid'));

    // $redrawable span
    const $span = this.$sid('test_span');
    const span = this.sid('test_span');
    assert('$redrawable keeps its tag (span)', $span.is('span'), $span.prop('tagName'));
    assert('$redrawable span scoped to the parent cid', $span.attr('id') === 'test_span:' + cid, $span.attr('id'));
    assert('$redrawable span keeps its classes', $span.hasClass('badge') && $span.hasClass('bg-primary'), $span.attr('class'));
    assert('$redrawable element is a component (sid() returns it)', !!span && span.$[0] === $span[0]);
    assert('$redrawable content rendered', $span.text().replace(/\s+/g, ' ').trim() === 'Counter: 42', $span.text());

    // render(sid) re-renders only the redrawable; siblings are the same nodes
    const p_node = $p[0];
    let span_renders = 0;
    span.on('render', () => { span_renders++; });
    const base_renders = span_renders;  // sticky: counts the boot render
    await this.render('test_span');
    assert('render("test_span") re-rendered the span', span_renders === base_renders + 1, span_renders - base_renders);
    assert('render("test_span") left <p $sid="test_p"> untouched', this.$sid('test_p')[0] === p_node);
    assert('span keeps its scoped id after render(sid)', this.$sid('test_span').attr('id') === 'test_span:' + cid);

    // $sid on a component tag: scoped to the PARENT's cid, not the child's own
    const $test_id = this.$sid('test_id');
    const test_id_comp = $test_id.component();
    assert('<TestUndefined $sid="test_id"> -> id="test_id:<parent cid>"', $test_id.attr('id') === 'test_id:' + cid, $test_id.attr('id'));
    assert('component tag carries data-sid="test_id"', $test_id.attr('data-sid') === 'test_id');
    assert('scoped with the parent cid, not its own', !!test_id_comp && test_id_comp._cid !== cid);
    assert('sid("test_id") returns that component', this.sid('test_id') === test_id_comp);

    // Plain id passes through unchanged
    const $section = this.$.find('#regular_section_id');
    assert('<section id="regular_section_id"> unchanged', $section.length === 1 && $section.is('section'));
    const $component_id = this.$.find('#regular_component_id');
    assert('<AnotherUndefined id="regular_component_id"> unchanged',
      $component_id.length === 1 && $component_id.hasClass('AnotherUndefined'));

    // Both id and $sid: $sid wins
    const $article = this.$.find('article');
    assert('<article id $sid> -> scoped id wins', $article.attr('id') === 'scoped_article_id:' + cid, $article.attr('id'));
    assert('<article> regular id not rendered', this.$.find('#regular_article_id').length === 0);
    const $yet = this.$.find('.YetAnother');
    assert('<YetAnother id $sid> -> scoped id wins', $yet.attr('id') === 'scoped_yet_id:' + cid, $yet.attr('id'));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
