#!/bin/bash

echo "=========================================="
echo "JQHTML Test: extends= vs JS Class Parent"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

# Order matters: a parent's .js must be inlined before any class that extends it.
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ejc_grid_a.jqhtml" \
  "$SCRIPT_DIR/ejc_grid_a.js" \
  "$SCRIPT_DIR/ejc_grid_b.jqhtml" \
  "$SCRIPT_DIR/ejc_grid_b.js" \
  "$SCRIPT_DIR/ejc_grid_mid.jqhtml" \
  "$SCRIPT_DIR/ejc_grid_mid.js" \
  "$SCRIPT_DIR/ejc_helper.js" \
  "$SCRIPT_DIR/ejc_helper_b.js" \
  "$SCRIPT_DIR/ejc_conflict.jqhtml" \
  "$SCRIPT_DIR/ejc_conflict.js" \
  "$SCRIPT_DIR/ejc_full_conflict.jqhtml" \
  "$SCRIPT_DIR/ejc_full_conflict.js" \
  "$SCRIPT_DIR/ejc_skip.jqhtml" \
  "$SCRIPT_DIR/ejc_skip.js" \
  "$SCRIPT_DIR/ejc_via_helper.jqhtml" \
  "$SCRIPT_DIR/ejc_via_helper.js" \
  "$SCRIPT_DIR/ejc_helper_between.jqhtml" \
  "$SCRIPT_DIR/ejc_helper_between.js" \
  "$SCRIPT_DIR/ejc_direct.jqhtml" \
  "$SCRIPT_DIR/ejc_direct.js" \
  "$SCRIPT_DIR/ejc_slot_proto.jqhtml" \
  "$SCRIPT_DIR/ejc_slot_proto.js" \
  "$SCRIPT_DIR/ejc_full_own.jqhtml" \
  "$SCRIPT_DIR/ejc_full_own.js" \
  "$SCRIPT_DIR/ejc_missing.jqhtml" \
  "$SCRIPT_DIR/ejc_missing.js" \
  "$SCRIPT_DIR/ejc_tpl_only.jqhtml" \
  "$SCRIPT_DIR/ejc_late.jqhtml" \
  "$SCRIPT_DIR/ejc_late.js" \
  --delay=2 --expect-boot-errors | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A/B. extends= naming a template the class does not descend from is an error naming"
echo "     the component, the extends= target and the templated JS ancestors"
echo "C-I. extends= naming any templated ancestor, no templated ancestors (helper classes,"
echo "     Jqhtml_Component directly, template-only), a missing target, and no extends= at"
echo "     all keep working"
echo "K.   Registering a template resets the cached verdict"
echo ""

exit $STATUS
