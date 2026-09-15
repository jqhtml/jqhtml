#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Dynamic Component Tags"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/dt_text_input.jqhtml" \
  "$SCRIPT_DIR/dt_wysiwyg_input.jqhtml" \
  "$SCRIPT_DIR/dt_panel.jqhtml" \
  "$SCRIPT_DIR/dt_dynamic_probe.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. <{expr} /> mounts the component the expression names, with its args; a > inside the expression is fine"
echo "2. A valid-but-undefined name renders the same placeholder div a literal undefined tag does"
echo "3. <{expr}>content</{expr}> delivers content(); a dynamic component nested in a dynamic component hydrates"
echo "4. Inside a form the component lands in the real DOM position with no wrapper element"
echo "5. When the expression's value changes between renders, a different component mounts"
echo "6. Empty, lowercase-initial, disallowed-character and undefined names throw at render"
echo ""
