#!/bin/bash
# cache_shared_reference_serialization - regression test for the shared
# (non-circular) reference fix in local-storage.ts process_for_serialization
# (commit 91f1bc59). Only exercises assertions in 'data' cache mode; instant
# passes in 'none' and 'html' modes.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/shared_ref_child.jqhtml" \
  "$SCRIPT_DIR/shared_ref_child.js" \
  --delay=2 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
