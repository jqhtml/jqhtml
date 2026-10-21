# component_setter_all_matches

`$(selector).component('Name', args)` creates one instance on every matched element and
returns the original jQuery set. Each instance gets its own shallow copy of `args`
(top-level changes stay local, nested objects stay shared). Elements that already hold a
component have it stopped and replaced.

`$(selector).component()` returns the first matched element's component; on a set of
more than one element it also logs one console warning per call.

Sections:
- A. three matches -> three instances, distinct `_cid`, independent `this.args`, all ready
- B. the setter returns the same jQuery object
- C. a mix of fresh elements and existing components: the existing ones are replaced
- D. getter on one match: no warning
- E. getter on three matches: returns the first, one warning per call
