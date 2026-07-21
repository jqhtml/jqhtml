#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/datagrid_base.jqhtml" \
  "$SCRIPT_DIR/users_grid.jqhtml" \
  "$SCRIPT_DIR/users_grid.js" \
  --delay=1
