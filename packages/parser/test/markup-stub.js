/**
 * Stand-in for core's Jqhtml_Markup (packages/core/src/markup.ts) - the buffer
 * every compiled render, content and slot function creates as
 * `new jqhtml.Markup(this)` and returns. Tests that run compiled render
 * functions against a stub `jqhtml` object pass this as its `Markup`.
 */
export class Markup {
  constructor(definer) {
    this.definer = definer;
    this.instructions = [];
  }

  p() {
    for (let i = 0; i < arguments.length; i++) {
      this.instructions.push(arguments[i]);
    }
  }
}
