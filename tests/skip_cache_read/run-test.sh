#!/bin/bash
# skip_cache_read: a subtree that never paints from the component cache (no data
# hydration, no html snapshot) but still writes it; inherited by every component created
# inside it; reserved (not in this.args, not in the cache or dedup key).
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  scr_node.js \
  scr_grand.jqhtml \
  scr_late.jqhtml \
  scr_child.jqhtml \
  scr_page.jqhtml \
  scr_wrap.jqhtml \
  --delay=3 "$@"
