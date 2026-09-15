// Three replacement edge cases in jquery-plugin.ts's .component() setter path:
//   A. stripping component classes must REMOVE the class attribute, not leave class=""
//   B. a throwing stop() must propagate - the element must NOT be replaced
//   C. a tag mismatch must be repaired even with empty inner content, carrying .data()
class Component_Replacement_Edge_Cases extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    // -------------------------------------------------------------------------------
    // A. CLASS ATTRIBUTE IS REMOVED, NOT EMPTIED
    //    The element carries only component classes ("Edge_First Component"), so the
    //    strip leaves nothing. The replacement's new component adds its own classes
    //    immediately afterwards, so the intermediate state is observed with a
    //    MutationObserver: each record's oldValue is the value the previous mutation
    //    left behind. oldValue === null means the attribute was absent (fixed);
    //    oldValue === '' means it was written as class="" (the bug).
    // -------------------------------------------------------------------------------
    console.log('');
    console.log('A. STRIPPING EVERY COMPONENT CLASS REMOVES THE ATTRIBUTE:');
    const $strip = $('<div>').appendTo(this.$sid('strip_host'));
    $strip.component('Edge_First', {});
    const first = $strip.component();
    await first.ready();
    assert('the element carries only component classes -> "' + $strip.attr('class') + '"',
           $strip.attr('class').split(/\s+/).every(c => c === 'Edge_First' || c === 'Component'));

    const class_history = [];
    const observer = new MutationObserver((records) => {
      for (const r of records) class_history.push(r.oldValue);
    });
    observer.observe($strip[0], { attributes: true, attributeFilter: ['class'], attributeOldValue: true });

    $strip.component('Edge_Second', {});
    await new Promise(r => setTimeout(r, 0));
    for (const r of observer.takeRecords()) class_history.push(r.oldValue);
    observer.disconnect();

    console.log('   class attribute history (oldValue per mutation): ' + JSON.stringify(class_history));
    assert('the class attribute was never written as "" -> ' + class_history.length + ' mutations',
           class_history.length >= 2 && !class_history.some(v => v === ''));
    assert('the class attribute was absent between strip and re-add',
           class_history.some(v => v === null));
    const second = $strip.component();
    await second.ready();
    assert('the replacement component booted', !!second && second.component_name() === 'Edge_Second');

    // -------------------------------------------------------------------------------
    // B. A THROWING stop() ABORTS THE REPLACEMENT
    // -------------------------------------------------------------------------------
    console.log('');
    console.log('B. A THROWING stop() PROPAGATES AND NOTHING IS REPLACED:');
    const $throw_host = $('<div>').appendTo(this.$sid('throw_host'));
    $throw_host.component('Edge_Thrower', {});
    const thrower = $throw_host.component();
    await thrower.ready();

    let caught = null;
    try {
      $throw_host.component('Edge_Second', {});
    } catch (error) {
      caught = error;
    }
    assert('.component() threw out of the replacement -> ' + (caught && caught.message),
           !!caught && /on_stop\(\) failed/.test(caught.message));
    assert('on_stop() really ran once', window.__edge_stop_attempts === 1);
    assert('the element still carries the old component\'s class',
           $throw_host.hasClass('Edge_Thrower'));
    assert('the element was NOT given a new component', $throw_host.data('_component') === thrower);
    assert('no Edge_Second markup was written', $throw_host.find('.Edge_Second').length === 0);

    // -------------------------------------------------------------------------------
    // C. TAG MISMATCH IS REPAIRED WITH EMPTY CONTENT, AND .data() SURVIVES
    //    No _inner_html at all here (this is not a boot placeholder), and the element
    //    is empty: before the fix that path only warned and left the wrong tag.
    // -------------------------------------------------------------------------------
    console.log('');
    console.log('C. TAG MISMATCH WITH EMPTY CONTENT:');
    const $tag_host = this.$sid('tag_host');
    const $wrong_tag = $('<div class="keepme">').appendTo($tag_host);
    $wrong_tag.data('carry', { v: 7 });
    $wrong_tag.attr('data-plain', 'kept');
    assert('the element starts as a <div> with no inner content',
           $wrong_tag[0].tagName === 'DIV' && $wrong_tag.html() === '');

    $wrong_tag.component('Edge_Span', {});
    const $span = $tag_host.children().first();
    const span_comp = $span.component();
    assert('the element was replaced with the template\'s tag -> <' +
           $span[0].tagName.toLowerCase() + '>', $span[0].tagName === 'SPAN');
    assert('the replacement element is not the original node', $span[0] !== $wrong_tag[0]);
    assert('jQuery .data() was carried across -> ' + JSON.stringify($span.data('carry')),
           !!$span.data('carry') && $span.data('carry').v === 7);
    assert('plain attributes were carried across', $span.attr('data-plain') === 'kept');
    assert('non-component classes were carried across', $span.hasClass('keepme'));
    assert('a component was created on the replacement element',
           !!span_comp && span_comp.component_name() === 'Edge_Span');
    if (span_comp) {
      await span_comp.ready();
      assert('the component rendered into the new element',
             span_comp.$sid('mark').length === 1 && span_comp.$[0] === $span[0]);
    }

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
