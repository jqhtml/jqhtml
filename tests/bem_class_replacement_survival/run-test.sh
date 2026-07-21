#!/bin/bash
# bem_class_replacement_survival
#
# Regression test for jquery-plugin.ts:173-185 - during
# $(el).component('New_Component') replacement of an existing component,
# capital-letter component-identity classes are stripped from the element,
# EXCEPT classes containing '__' (BEM-style classes), which survive
# reinitialization along with plain lowercase classes.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/bem_class_replacement_survival_test.jqhtml" \
  "$SCRIPT_DIR/bem_class_replacement_survival_test.js" \
  "$SCRIPT_DIR/first_comp.jqhtml" \
  "$SCRIPT_DIR/second_comp.jqhtml" \
  --delay=2 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
