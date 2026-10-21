#!/bin/bash

echo "=========================================="
echo "JQHTML Test: content() Returns '' For An Empty Slot"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/es_leaf.jqhtml" \
  "$SCRIPT_DIR/es_row.jqhtml" \
  "$SCRIPT_DIR/es_fwd.jqhtml" \
  "$SCRIPT_DIR/es_box.jqhtml" \
  "$SCRIPT_DIR/es_list.jqhtml" \
  "$SCRIPT_DIR/es_row_empty_note.jqhtml" \
  "$SCRIPT_DIR/es_row_text_note.jqhtml" \
  --delay=3
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. An absent slot and a slot that emits nothing (empty, HTML whitespace, '' / null) are falsy"
echo "2. A slot emitting text, an element, a component, &nbsp;, U+00A0 or 0 is truthy and splices"
echo "3. '' printed unconditionally prints nothing"
echo "4. A slot passed down to another component counts by what it emits"
echo "5. Default content() follows the same rule"
echo "6. Slot-only inheritance follows the same rule"
echo "7. A slot with \$params is judged per call"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
