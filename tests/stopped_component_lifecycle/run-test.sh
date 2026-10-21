#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Stopped Component Lifecycle"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/stop_wait_parent.jqhtml" \
  "$SCRIPT_DIR/stop_wait_child.jqhtml" \
  "$SCRIPT_DIR/stop_wait_grand.jqhtml" \
  "$SCRIPT_DIR/stop_load_card.jqhtml" \
  --delay=3
STATUS=$?

echo ""
echo "Expected: a component stopped while waiting for its children never runs on_ready()"
echo "or fires ready; one stopped mid-fetch never runs on_loaded(); dedup followers of a"
echo "stopped leader still receive its data, and a stopped follower is dropped cleanly."
echo ""

exit $STATUS
