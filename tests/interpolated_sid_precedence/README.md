# Interpolated $sid Operator Precedence

Validates that an expression interpolated into `$sid` keeps its operator precedence.

`<div $sid="row_<%= this.args.i > 0 ? 'pos' : 'neg' %>">` with `$i=1` must produce
`id="row_pos:<cid>"`, so `this.$sid('row_pos')` finds it. Without parentheses around the
interpolated expression the ternary swallowed the `"row_" +` prefix and the scoped id was
always `neg:<cid>`. A `||` fallback is checked the same way.
