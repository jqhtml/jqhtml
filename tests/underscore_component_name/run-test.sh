#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Single Leading Underscore in Component Names"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/_framework_box.jqhtml" \
  "$SCRIPT_DIR/_framework_box.js" \
  "$SCRIPT_DIR/_framework_marker.jqhtml" \
  "$SCRIPT_DIR/plain_box.jqhtml" \
  "$SCRIPT_DIR/plain_marker.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. <Define:_Foo> registers _Foo and <_Foo> in a template resolves to it"
echo "2. The rendered root carries the class name _Foo exactly as Plain_Foo carries Plain_Foo"
echo "3. <_Foo> nests inside ordinary components and vice versa; <_Foo /> self-closes"
echo "4. register_component('_Foo', cls), \$(el).component('_Foo') and closest('_Foo') all accept the name"
echo "5. Replacing a component strips the _Foo class like any component class"
echo "6. __Foo and _foo are rejected by register_component with the naming rule"
echo ""
