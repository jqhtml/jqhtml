#!/bin/bash
# on_load_error(error): the recovery hook for a failed on_load(). See README.md.
# --expect-boot-errors: components without an override (and one whose override
# rethrows) deliberately fail their boot.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/le_shared.js" \
  "$SCRIPT_DIR/le_plain.jqhtml" \
  "$SCRIPT_DIR/le_fallback.jqhtml" \
  "$SCRIPT_DIR/le_super.jqhtml" \
  "$SCRIPT_DIR/le_rethrow.jqhtml" \
  "$SCRIPT_DIR/le_async.jqhtml" \
  "$SCRIPT_DIR/le_parent.jqhtml" \
  --expect-boot-errors
