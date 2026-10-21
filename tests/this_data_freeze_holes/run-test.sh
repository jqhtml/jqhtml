#!/bin/bash

echo "=========================================="
echo "JQHTML Test: this.data Freeze Holes"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/assert_helpers.js" \
  "$SCRIPT_DIR/holes_target.jqhtml" \
  "$SCRIPT_DIR/alias_loader.jqhtml" \
  "$SCRIPT_DIR/warn_target.jqhtml" \
  --delay=2 | tee "$OUTPUT_LOG"

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
echo "A/B. Object.defineProperty, Reflect.defineProperty, Object.setPrototypeOf,"
echo "     Object.preventExtensions/seal/freeze throw on frozen this.data and nested values"
echo "C. A property descriptor hands out the read-only view, never the raw object"
echo "D. Error messages name the full dotted path"
echo "E/G. on_create() aliasing (this.state.list = this.data.list = []) cannot reach"
echo "     frozen this.data, with and without on_load()"
echo "F. Reads and unfrozen writes behave as before"
echo ""

exit $STATUS
