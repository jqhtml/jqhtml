#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Template Comments"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/comment_component.jqhtml" \
  "$SCRIPT_DIR/comment_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. COMMENT REMOVAL:"
echo "   - All <%-- --%> comment text should be stripped"
echo "   - No comment text appears in DOM or compiled code"
echo "   - Multi-line comments fully removed"
echo ""
echo "2. VISIBLE CONTENT:"
echo "   - All non-comment content should render normally"
echo "   - Element spacing preserved"
echo ""
echo "3. INLINE COMMENTS:"
echo "   - Before<%-- comment --%>After renders as 'Before After'"
echo "   - NOTE: Known bug - comment leaves space (documented in BUGS_FOUND.md)"
echo ""
