#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/button_with_defaults.jqhtml" \
  "$SCRIPT_DIR/class_overlap_define.jqhtml" \
  "$SCRIPT_DIR/class_no_overlap_define.jqhtml" \
  "$SCRIPT_DIR/class_invocation_only_define.jqhtml" \
  "$SCRIPT_DIR/class_define_only_define.jqhtml" \
  "$SCRIPT_DIR/class_single_both_define.jqhtml" \
  "$SCRIPT_DIR/style_overlap_define.jqhtml" \
  "$SCRIPT_DIR/style_no_overlap_define.jqhtml" \
  "$SCRIPT_DIR/style_invocation_only_define.jqhtml" \
  "$SCRIPT_DIR/style_define_only_define.jqhtml" \
  "$SCRIPT_DIR/base_component.jqhtml" \
  "$SCRIPT_DIR/parent_component.jqhtml" \
  "$SCRIPT_DIR/child_component.jqhtml" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  --delay=1
