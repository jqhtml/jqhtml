#!/bin/bash
# cache_entry_size_cap - behavioral test for Jqhtml_Local_Storage.set()'s 1MB entry
# size cap (packages/core/src/local-storage.ts ~622-640): oversized serialized values
# are silently skipped, and writing an oversized value removes any existing cache
# entry under that same key.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/size_cap_component.jqhtml" \
  "$SCRIPT_DIR/size_cap_component.js" \
  "$SCRIPT_DIR/cache_entry_size_cap_test.jqhtml" \
  "$SCRIPT_DIR/cache_entry_size_cap_test.js" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
