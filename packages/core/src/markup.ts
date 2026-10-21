/**
 * JQHTML v2 Markup Buffer
 *
 * What every compiled render function, content function and slot function
 * returns: the instructions it produced, and the component whose template
 * wrote them (the definer).
 *
 * The compiler emits one buffer per function invocation:
 *
 *   let _output = new jqhtml.Markup(this); ... _output.p(...); ... return _output;
 *
 * and never stores it on a component - a slot body runs as a closure over its
 * definer while the receiving component is mid-render, so shared component
 * state could interleave two buffers.
 *
 * `<%= %>`, `<%!= %>` and `<%br= %>` splice a buffer (content(), a slot) into
 * the enclosing one; the instruction processor renders it in its definer, so
 * `this` in handler attributes, id= scoping and instantiator() agree with
 * `<%= %>` and `$sid`, which are closures over the definer already. Being a
 * buffer is the ONLY thing that splices: any other array prints "(Array)".
 */

export class Jqhtml_Markup {
  /** The instructions, in output order. */
  readonly instructions: any[] = [];

  /** The component whose template wrote these instructions. */
  readonly definer: any;

  /**
   * Append instructions. The compiler merges consecutive appends on one line into
   * one call, so this takes any number of arguments. It is the instruction
   * array's own native push, bound once per buffer: measured against a method
   * looping over `arguments` it removes a 3-7% slowdown on a 1000-row table
   * render (tests_benchmark load_table_*), and allocates nothing per call.
   */
  readonly p: (...instructions: any[]) => number;

  constructor(definer: any) {
    this.definer = definer;
    this.p = this.instructions.push.bind(this.instructions);
  }
}

/**
 * Whether a buffer emits anything: an element, a component, or text that is not
 * only HTML whitespace (space, tab, LF, FF, CR - a non-breaking space is content).
 * A spliced buffer counts by what it emits itself, so a slot that only forwards
 * an empty slot is empty too. A component counts even if it later renders
 * nothing; that is not knowable without booting it.
 *
 * content() returns '' for a buffer without content: a caller cannot omit a
 * <Slot:> tag conditionally, so writing it empty is how a caller says "nothing
 * here", and it must test falsy like an absent slot.
 */
export function markup_has_content(markup: Jqhtml_Markup): boolean {
  for (const instruction of markup.instructions) {
    if (instruction instanceof Jqhtml_Markup) {
      if (markup_has_content(instruction)) return true;
    } else if (instruction !== null && typeof instruction === 'object') {
      return true;
    } else if (/[^ \t\n\f\r]/.test(String(instruction))) {
      return true;
    }
  }
  return false;
}
