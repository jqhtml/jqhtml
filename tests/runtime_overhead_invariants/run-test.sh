#!/bin/bash
# Runtime overhead invariants: the per-class caches, the single .data() write and the
# .call() event dispatch change no observable behaviour. See test.js.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  --delay=1
