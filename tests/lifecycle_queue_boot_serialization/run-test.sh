#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Lifecycle Queue - Boot Serialization"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FILES=("$SCRIPT_DIR/test.jqhtml")
for name in lq_fetch lq_render lq_probe lq_ready_reload lq_ready_await lq_seq lq_warn_hooks lq_deadlock lq_ready_order lq_no_deadlock; do
  FILES+=("$SCRIPT_DIR/$name.jqhtml")
done

exec node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" "${FILES[@]}" --delay=5
