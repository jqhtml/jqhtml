#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Value Printers"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/vp_rich_text.jqhtml" \
  "$SCRIPT_DIR/vp_primitives.jqhtml" \
  "$SCRIPT_DIR/vp_orphan.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. A printer string is escaped under <%= %>, raw under <%!= %>, escaped+nl2br under <%br= %>"
echo "2. A descriptor mounts the named component with its args and attrs, no wrapper element"
echo "3. A printer-produced component inside a list renders once per row"
echo "4. Attribute position keeps toString() coercion and never consults printers"
echo "5. Primitives and arrays never enter the chain"
echo "6. An object no printer handles throws, naming its constructor"
echo ""
