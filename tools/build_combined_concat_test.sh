#!/bin/bash

# Build Combined Concatenation Test Script
# This script builds all necessary JavaScript files with sourcemaps and tests concatenation
# preserving sourcemaps using both RSpade method and Mozilla source-map library

set -e  # Exit on error

echo "========================================="
echo "Building Combined Concatenation Test"
echo "========================================="

# Define paths
JQHTML_ROOT="/var/www/html/jqhtml"
TOOLS_DIR="$JQHTML_ROOT/tools"
TEMP_DIR="/tmp/concat-test"
WEBPACK_HELLO_DIR="$JQHTML_ROOT/webpack-hello-test"

# Create temp directory for outputs
mkdir -p $TEMP_DIR

# Step 1: Build webpack hello world bundle
echo ""
echo "Step 1: Building webpack hello world bundle..."
echo "-----------------------------------------"
cd $WEBPACK_HELLO_DIR
if [ ! -f "dist/bundle.js" ] || [ "$1" == "--rebuild" ]; then
    echo "Running webpack build..."
    node build.cjs
else
    echo "Using existing webpack bundle at dist/bundle.js"
fi
echo "✓ Webpack bundle ready: $WEBPACK_HELLO_DIR/dist/bundle.js"

# Step 2: Compile JQHTML Counter_Widget template
echo ""
echo "Step 2: Compiling JQHTML Counter_Widget template..."
echo "-----------------------------------------"
cd $JQHTML_ROOT
node packages/parser/bin/jqhtml-compile compile \
    sourcemap-test/Counter_Widget.jqhtml \
    --format iife \
    --sourcemap \
    > $TEMP_DIR/Counter_Widget_compiled.js 2>&1

echo "✓ JQHTML template compiled: $TEMP_DIR/Counter_Widget_compiled.js"

# Check if files have sourcemaps
echo ""
echo "Step 3: Verifying sourcemaps in compiled files..."
echo "-----------------------------------------"
if grep -q "sourceMappingURL" $TEMP_DIR/Counter_Widget_compiled.js; then
    echo "✓ Counter_Widget has inline sourcemap"
else
    echo "✗ Counter_Widget missing sourcemap!"
fi

if grep -q "sourceMappingURL" $WEBPACK_HELLO_DIR/dist/bundle.js; then
    echo "✓ Webpack bundle has inline sourcemap"
else
    echo "✗ Webpack bundle missing sourcemap!"
fi

# Step 4: Test RSpade concatenation method (using .cjs extension)
echo ""
echo "Step 4: Testing RSpade concatenation method..."
echo "-----------------------------------------"
if [ -f "$TOOLS_DIR/concat-js-rspade.cjs" ]; then
    node $TOOLS_DIR/concat-js-rspade.cjs \
        $TEMP_DIR/merged-bundle-rspade.js \
        $TEMP_DIR/Counter_Widget_compiled.js \
        $WEBPACK_HELLO_DIR/dist/bundle.js
    echo "✓ RSpade concatenation complete: $TEMP_DIR/merged-bundle-rspade.js"
else
    echo "⚠ RSpade concatenation script not found (needs .cjs extension)"
fi

# Step 5: Test Mozilla source-map method (if available)
echo ""
echo "Step 5: Testing Mozilla source-map method..."
echo "-----------------------------------------"
if [ -f "$TOOLS_DIR/concat-js-mozilla.mjs" ]; then
    node $TOOLS_DIR/concat-js-mozilla.mjs \
        $TEMP_DIR/merged-bundle-mozilla.js \
        $TEMP_DIR/Counter_Widget_compiled.js \
        $WEBPACK_HELLO_DIR/dist/bundle.js
    echo "✓ Mozilla concatenation complete: $TEMP_DIR/merged-bundle-mozilla.js"
else
    echo "⚠ Mozilla concatenation script not yet created"
fi

# Step 6: Create test HTML file for browser testing
echo ""
echo "Step 6: Creating test HTML file..."
echo "-----------------------------------------"
cat > $TEMP_DIR/test-concatenation.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Sourcemap Concatenation Test</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <style>
        body { font-family: monospace; padding: 20px; }
        .test-section { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .error { color: red; font-weight: bold; }
        .success { color: green; font-weight: bold; }
        button { margin: 5px; padding: 5px 10px; }
    </style>
</head>
<body>
    <h1>Sourcemap Concatenation Test</h1>

    <div class="test-section">
        <h2>Test Controls</h2>
        <button onclick="testRSpadeBundle()">Load RSpade Bundle</button>
        <button onclick="testMozillaBundle()">Load Mozilla Bundle</button>
        <button onclick="triggerError()">Trigger Error (test sourcemap)</button>
    </div>

    <div class="test-section">
        <h2>Console Output</h2>
        <pre id="console"></pre>
    </div>

    <div class="test-section">
        <h2>Component Mount Point</h2>
        <div id="counter-mount"></div>
    </div>

    <script>
        const consoleEl = document.getElementById('console');
        const originalLog = console.log;
        const originalError = console.error;

        // Override console to display in page
        console.log = function(...args) {
            originalLog.apply(console, args);
            consoleEl.textContent += args.join(' ') + '\n';
        };

        console.error = function(...args) {
            originalError.apply(console, args);
            consoleEl.innerHTML += '<span class="error">' + args.join(' ') + '</span>\n';
        };

        function loadScript(src) {
            return new Promise((resolve, reject) => {
                // Remove any existing test script
                const existing = document.getElementById('test-script');
                if (existing) existing.remove();

                const script = document.createElement('script');
                script.id = 'test-script';
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }

        async function testRSpadeBundle() {
            console.log('Loading RSpade concatenated bundle...');
            try {
                await loadScript('merged-bundle-rspade.js');
                console.log('✓ RSpade bundle loaded successfully');
            } catch (e) {
                console.error('Failed to load RSpade bundle:', e);
            }
        }

        async function testMozillaBundle() {
            console.log('Loading Mozilla concatenated bundle...');
            try {
                await loadScript('merged-bundle-mozilla.js');
                console.log('✓ Mozilla bundle loaded successfully');
            } catch (e) {
                console.error('Failed to load Mozilla bundle:', e);
            }
        }

        function triggerError() {
            console.log('Triggering test error...');
            try {
                // This should map back to original source
                if (typeof foobar3 === 'function') {
                    foobar3(); // From Counter_Widget.jqhtml
                } else {
                    throw new Error('Test error from concatenated bundle');
                }
            } catch (e) {
                console.error('Error caught:', e.message);
                console.error('Stack:', e.stack);
            }
        }

        // Auto-load RSpade bundle on page load
        window.addEventListener('load', () => {
            console.log('Page loaded. Ready for testing.');
            console.log('Check DevTools for sourcemap verification.');
        });
    </script>
</body>
</html>
EOF

echo "✓ Test HTML created: $TEMP_DIR/test-concatenation.html"

# Step 7: Report results
echo ""
echo "========================================="
echo "Build Complete!"
echo "========================================="
echo "Output files:"
echo "  - JQHTML compiled: $TEMP_DIR/Counter_Widget_compiled.js"
echo "  - Webpack bundle: $WEBPACK_HELLO_DIR/dist/bundle.js"
if [ -f "$TEMP_DIR/merged-bundle-rspade.js" ]; then
    echo "  - RSpade merged: $TEMP_DIR/merged-bundle-rspade.js"
    echo "    Size: $(wc -c < $TEMP_DIR/merged-bundle-rspade.js) bytes"
fi
if [ -f "$TEMP_DIR/merged-bundle-mozilla.js" ]; then
    echo "  - Mozilla merged: $TEMP_DIR/merged-bundle-mozilla.js"
    echo "    Size: $(wc -c < $TEMP_DIR/merged-bundle-mozilla.js) bytes"
fi
echo ""
echo "To test in browser:"
echo "  1. cd $TEMP_DIR"
echo "  2. python3 -m http.server 8080"
echo "  3. Open http://localhost:8080/test-concatenation.html"
echo ""
echo "To rebuild everything from scratch, run:"
echo "  $0 --rebuild"