class Void_Elements_Component extends Jqhtml_Component {
  on_ready() {
    console.log('[Void_Elements_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('TEST RESULTS:');
    console.log('========================================');
    console.log('');

    // Test all void elements
    const void_elements = [
      {id: 'text_input', type: 'input', tag: 'INPUT'},
      {id: 'checkbox', type: 'input', tag: 'INPUT'},
      {id: 'radio', type: 'input', tag: 'INPUT'},
      {id: 'image', type: 'img', tag: 'IMG'},
      {id: 'line_break', type: 'br', tag: 'BR'},
      {id: 'horizontal_rule', type: 'hr', tag: 'HR'},
      {id: 'meta_tag', type: 'meta', tag: 'META'},
      {id: 'link_tag', type: 'link', tag: 'LINK'},
      {id: 'area_tag', type: 'area', tag: 'AREA'},
      {id: 'col_tag', type: 'col', tag: 'COL'},
      {id: 'embed_tag', type: 'embed', tag: 'EMBED'},
      {id: 'source_tag', type: 'source', tag: 'SOURCE'},
      {id: 'track_tag', type: 'track', tag: 'TRACK'},
      {id: 'wbr_tag', type: 'wbr', tag: 'WBR'}
    ];

    let all_passed = true;
    let results = [];

    console.log('VOID ELEMENT TESTS:');
    console.log('');

    void_elements.forEach(elem => {
      const $elem = this.$sid(elem.id);
      const exists = $elem.length > 0;
      const correct_tag = exists && $elem.prop('tagName') === elem.tag;

      const status = exists && correct_tag ? '✅ PASS' : '❌ FAIL';

      console.log(`${elem.type} (${elem.id}):`);
      console.log(`   Element exists: ${exists}`);
      console.log(`   Correct tag (${elem.tag}): ${correct_tag}`);
      console.log(`   ${status}`);
      console.log('');

      if (!exists || !correct_tag) {
        all_passed = false;
      }

      results.push({
        type: elem.type,
        id: elem.id,
        exists: exists,
        correct_tag: correct_tag,
        passed: exists && correct_tag
      });
    });

    console.log('========================================');
    console.log('SUMMARY:');
    console.log('========================================');
    console.log('');

    const passed_count = results.filter(r => r.passed).length;
    const total_count = results.length;

    console.log(`Tests passed: ${passed_count}/${total_count}`);
    console.log('');

    if (all_passed) {
      console.log('✅ ALL VOID ELEMENTS RENDERED CORRECTLY');
      console.log('   - All elements exist in DOM');
      console.log('   - All elements have correct tag names');
      console.log('   - Auto-closing worked without errors');
    } else {
      console.log('❌ SOME VOID ELEMENTS FAILED');
      console.log('');
      console.log('Failed elements:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.type} (${r.id})`);
      });
    }

    console.log('');
    console.log('========================================');
    console.log('');

    // Display summary in DOM
    const summary = all_passed
      ? `✅ All ${total_count} void elements rendered successfully`
      : `❌ ${total_count - passed_count} void elements failed`;

    this.$sid('results').html(`<h3>${summary}</h3>`);
  }
}
