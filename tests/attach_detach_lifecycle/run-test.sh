#!/bin/bash
# Attach / detach lifecycle events and stop() reliability under jQuery removal.
cd "$(dirname "$0")"
node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  watched_widget.jqhtml \
  plain_widget.jqhtml \
  host_widget.jqhtml \
  test.js
