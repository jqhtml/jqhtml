#!/bin/bash

# Component Replacement Test
# Tests that $(selector).component("Component") properly replaces existing components

cd "$(dirname "$0")"

# Compile templates
echo "Compiling templates..."
/var/www/html/jqhtml/packages/parser/bin/jqhtml-compile compile \
  first_component.jqhtml \
  second_component.jqhtml \
  test_container.jqhtml \
  --format iife \
  --output-dir . \
  2>&1 | grep -v "Warning: No backing"

if [ $? -ne 0 ]; then
  echo "❌ Compilation failed"
  exit 1
fi

# Run test using jqhtml-tester
echo ""
echo "Running test..."
node /var/www/html/jqhtml/jqhtml-render-harness/test-runner.js \
  test_container.jqhtml \
  first_component.jqhtml \
  second_component.jqhtml \
  test.js

TEST_RESULT=$?

# Cleanup compiled templates (not test.js which is source)
rm -f first_component.js second_component.js test_container.js

exit $TEST_RESULT
