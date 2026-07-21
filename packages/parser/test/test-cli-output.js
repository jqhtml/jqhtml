// Compiled from: CliTest.jqhtml
(function() {
  'use strict';

  // Component definition with version tracking
  const template_CliTest = {
  _v: '2.2.57',
  name: 'CliTest',
  as: 'div',
  defaultAttributes: {},
  render: function render(data, args, content, jqhtml) { let _output = []; const _cid = this._cid; const that = this;
_output.push({tag: ["div", {"class": "test"}, false]}); _output.push({tag: ["h1", {}, false]}); _output.push("CLI Test"); _output.push("</h1>"); (() => { const result = this.data.message; if (Array.isArray(result)) { if (result.length === 2 && Array.isArray(result[0])) { _output.push(...result[0]); } else { _output.push(...result); } } else { _output.push(jqhtml.escape_html(result)); } })(); if (this.data.show) { _output.push({tag: ["span", {}, false]}); _output.push("Visible"); _output.push("</span>"); } _output.push("</div>"); return [_output, this]; },
  dependencies: []
};

  // Self-register with jqhtml runtime
  // Must use window.jqhtml since we're in bundle scope
  if (!window.jqhtml) {
    throw new Error('FATAL: window.jqhtml is not defined. The jqhtml runtime must be loaded before registering templates.');
  }

  // Auto-register following standard jqhtml pattern
  window.jqhtml.register_template(template_CliTest);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QtY2xpLXNvdXJjZW1hcC5qcWh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUVRLHlCQUNELHlQQUNELHFCQUNNLHdCQUNOIiwiZmlsZSI6InRlc3QtY2xpLXNvdXJjZW1hcC5qcyIsInNvdXJjZXNDb250ZW50IjpbIjxEZWZpbmU6Q2xpVGVzdD5cbiAgPGRpdiBjbGFzcz1cInRlc3RcIj5cbiAgICA8aDE+Q0xJIFRlc3Q8L2gxPlxuICAgIDwlPSB0aGlzLmRhdGEubWVzc2FnZSAlPlxuICAgIDwlIGlmICh0aGlzLmRhdGEuc2hvdyk6ICU+XG4gICAgICA8c3Bhbj5WaXNpYmxlPC9zcGFuPlxuICAgIDwlIGVuZGlmOyAlPlxuICA8L2Rpdj5cbjwvRGVmaW5lOkNsaVRlc3Q+Il19