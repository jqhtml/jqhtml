# JQHTML Development Tools

Essential development and debugging tools for JQHTML templates.

## 🔍 jqhtml-sourcemap-visualizer

**Purpose:** Visualizes the sourcemap transformation pipeline showing how JQHTML source lines map to JavaScript output.

**Usage:**
```bash
node tools/jqhtml-sourcemap-visualizer.js <template.jqhtml>
```

**Features:**
- Shows 3-column visualization: Source → Preprocessed → Output
- Displays comment preprocessing (spaces shown as dots `·`)
- Maps each source line to its corresponding output lines
- Calculates mapping statistics and offset verification
- Helpful for debugging sourcemap generation issues

**Example:**
```bash
node tools/jqhtml-sourcemap-visualizer.js test-components/test-counter.jqhtml
```

## 🧪 jqhtml-browser-test

**Purpose:** Tests JQHTML templates in a real browser environment using Playwright.

**Usage:**
```bash
node tools/jqhtml-browser-test.js <template.jqhtml>
```

**Features:**
- Compiles JQHTML to JavaScript with inline sourcemaps
- Creates HTML test harness with mock jqhtml runtime
- Starts test server on port 8989
- Executes template render functions in real browser
- Captures all console output and error stack traces
- Reports if sourcemaps are working correctly

**Example:**
```bash
node tools/jqhtml-browser-test.js sourcemap-test/test-source2.jqhtml
```

**Output includes:**
- All console.log messages from template execution
- Error messages with stack traces
- Sourcemap validation (shows if errors map to .jqhtml files)

## 🔎 jqhtml-sourcemap-analyzer

**Purpose:** Analyzes and validates sourcemaps in JavaScript files using Mozilla's source-map library.

**Usage:**
```bash
node tools/jqhtml-sourcemap-analyzer.js <file.js>
```

**Features:**
- Detects inline or external sourcemaps
- Validates sourcemap structure and VLQ mappings
- Shows mapping coverage statistics
- Tests specific line mappings (errors, console logs, etc.)
- Reports if sourcemap is valid according to Mozilla's parser
- Identifies common issues and mismatches

**Example:**
```bash
node tools/jqhtml-sourcemap-analyzer.js test-components/counter-widget-baseline.js
```

**Output includes:**
- Sourcemap type and validation status
- Coverage percentage of mapped lines
- Specific line mapping tests for debugging
- Warnings about potential issues

## 🔬 _decode-inline-sourcemap (Utility Tool)

**Purpose:** Extracts and decodes base64-encoded inline sourcemaps from JavaScript files for debugging.

**Usage:**
```bash
node tools/_decode-inline-sourcemap.js <file.js>
```

**Features:**
- Searches for sourceMappingURL comments (both `#` and `@` formats)
- Decodes base64-encoded inline sourcemaps
- Pretty-prints the decoded JSON structure
- Analyzes mappings to show coverage and line mapping details
- Validates sourcemap placement and format
- Shows embedded source content if present

**Example:**
```bash
node tools/_decode-inline-sourcemap.js test-components/counter-widget-baseline.js
```

**Output includes:**
- Line where sourcemap was found
- Full decoded sourcemap JSON
- Mapping analysis (empty vs mapped lines)
- First 10 line mappings for inspection
- Validation checks for proper format

**Note:** This is a utility tool (prefixed with `_`) for debugging sourcemap issues. It helps understand what's actually in the base64-encoded sourcemap without manual copying/decoding.

## ✅ validate-sourcemap-spec

**Purpose:** Validates JavaScript files with inline sourcemaps against the official Source Map v3 specification.

**Usage:**
```bash
node tools/validate-sourcemap-spec.js <file.js>
```

**Features:**
- Validates comment format (`//#` or `//@`)
- Checks placement at end of file
- Verifies data URI format for inline sourcemaps
- Validates base64 encoding
- Checks JSON structure requirements
- Confirms version 3 format
- Verifies required and optional fields
- Validates VLQ mappings format
- Tests against browser regex patterns (Webpack, Chrome, Svelte)

**Example:**
```bash
node tools/validate-sourcemap-spec.js test-components/counter-widget-baseline.js
```

**Output includes:**
- Step-by-step validation checks
- Critical issues that must be fixed
- Warnings for recommended improvements
- Overall pass/fail status
- References to official specifications

**Use this tool when:**
- Sourcemaps aren't being recognized by browsers
- You need to verify spec compliance
- Debugging sourcemap generation issues
- Ensuring cross-browser compatibility

## Installation Requirements

### For jqhtml-browser-test:
```bash
# Install Playwright
npm install --save-dev playwright

# Install Chromium browser
npx playwright install chromium
```

### For jqhtml-sourcemap-visualizer:
```bash
# Uses built-in parser, no additional requirements
```

## Quick Testing Workflow

1. **Create or edit a template:**
   ```bash
   vim my-component.jqhtml
   ```

2. **Visualize the sourcemap transformation:**
   ```bash
   node tools/jqhtml-sourcemap-visualizer.js my-component.jqhtml
   ```

3. **Test in real browser:**
   ```bash
   node tools/jqhtml-browser-test.js my-component.jqhtml
   ```

## Common Use Cases

### Debugging Sourcemap Issues
When sourcemaps aren't working correctly:
```bash
# See the exact line mappings
node tools/jqhtml-sourcemap-visualizer.js problematic-template.jqhtml

# Test in browser to see actual error locations
node tools/jqhtml-browser-test.js problematic-template.jqhtml
```

### Testing Error Handling
Create a template with intentional errors at specific lines:
```html
<Define:TestError as="div">
  <div>
    <% undefinedFunction(); %> <!-- Error on line 3 -->
  </div>
</Define:TestError>
```

Then test it:
```bash
node tools/jqhtml-browser-test.js test-error.jqhtml
# Should show error at test-error.jqhtml:3 if sourcemaps work
```

### Validating Template Compilation
Quickly check if a template compiles and runs without errors:
```bash
node tools/jqhtml-browser-test.js my-template.jqhtml
# Look for "✅ No errors detected" or specific error messages
```

## Tips

- The visualizer tool is especially useful for understanding why certain lines might not map correctly
- The browser test tool uses a real Chrome browser, so results match production behavior
- Both tools work with the latest JQHTML parser (v2.2.68+)
- Generated test files are created in the same directory as the input template