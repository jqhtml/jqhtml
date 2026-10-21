class Interpolated_Sid_Precedence_Test extends Jqhtml_Component {
  on_ready() {
    const results = [];
    const check = (label, ok, detail) => {
      console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} (${detail})`);
      results.push(ok);
    };

    const ternary_id = this.$.find('.ternary_row').attr('id');
    check("this.$sid('row_pos') finds the ternary element", this.$sid('row_pos').hasClass('ternary_row'), `id="${ternary_id}"`);
    check('ternary element id is row_pos:<cid>', ternary_id === `row_pos:${this._cid}`, `id="${ternary_id}"`);
    check("this.$sid('row_neg') finds nothing", this.$sid('row_neg').length === 0, `length=${this.$sid('row_neg').length}`);

    const or_id = this.$.find('.or_row').attr('id');
    check("this.$sid('name_none') finds the || element", this.$sid('name_none').hasClass('or_row'), `id="${or_id}"`);

    const passed = results.every(Boolean);
    console.log(`SUMMARY: ${results.filter(Boolean).length}/${results.length} passed`);
    window.testPassed = passed;
  }
}
