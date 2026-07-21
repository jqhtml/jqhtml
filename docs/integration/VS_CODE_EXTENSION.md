# JQHTML VS Code Extension

The JQHTML VS Code extension provides comprehensive language support for `.jqhtml` template files.

## Features

- **Syntax Highlighting**: Full highlighting for all JQHTML constructs
- **Smart Indentation**: Handles brace-style control flow blocks
- **Code Snippets**: 14 snippets for common patterns
- **Bracket Matching**: Auto-closing and highlighting
- **Code Folding**: Fold component definitions
- **Go to Definition**: Ctrl/Cmd+Click or F12 on a component name jumps to its `<Define:...>`
- **Hover Information**: Hovering a component name shows its definition
- **Formatting Support**: Auto-formatting for proper indentation

## Installation

### Option 1: Build from Source

```bash
cd packages/vscode-extension
npm install
npm run compile
./build.sh
```

Then install the generated `.vsix` file:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click ... → Install from VSIX
4. Select `jqhtml-vscode-extension-<version>.vsix`

### Option 2: Copy to Extensions Folder

```bash
cd packages/vscode-extension
npm install
npm run compile
cp -r . ~/.vscode/extensions/jqhtml-vscode-extension-<version>
```

Restart VS Code after copying.

## Syntax Examples

The extension highlights all JQHTML v2 syntax:

```jqhtml
<Define:MyComponent>
  <div $sid="container">
    <!-- Template expressions -->
    <h1><%= this.data.title %></h1>
    
    <!-- Data binding -->
    <input :value="this.data.name" :disabled="isLocked" />
    
    <!-- Event handlers -->
    <button @click="handleClick">Click Me</button>
    
    <!-- Control flow (brace style) -->
    <% if (this.data.other) { %>
      <p>Brace style</p>
    <% } %>
    
    <!-- Slots -->
    <Card>
      <Slot:header>Title</Slot:header>
      <Slot:body>Content</Slot:body>
    </Card>
  </div>
</Define:MyComponent>
```

## Snippets

Type these prefixes and press Tab:

| Prefix | Expands to |
|--------|------------|
| `define` | Component definition |
| `definecomp` | Component with basic structure |
| `if{` | If statement (brace) |
| `for{` | For loop (brace) |
| `exp` | Expression `<%= %>` |
| `$id` | Scoped ID |
| `:prop` | Property binding (data binding) |
| `@event` | Event handler |
| `slot` | Named slot definition |
| `slotprop` | Named slot with props |
| `slotself` | Self-closing slot |
| `comment` | Comment block |
| `comp` | Component usage |
| `compslot` | Component with slot content |

## Configuration

The extension sets sensible defaults for JQHTML files:

```json
{
  "[jqhtml]": {
    "editor.wordWrap": "on",
    "editor.quickSuggestions": {
      "other": true,
      "comments": false,
      "strings": true
    }
  }
}
```

## TextMate Scopes

For theme authors, the extension uses these scopes:

- `source.jqhtml` - Root scope
- `entity.name.class.component.jqhtml` - Component names in Define
- `keyword.control.define.jqhtml` - Define keyword
- `keyword.control.extends.jqhtml` - extends attribute keyword
- `keyword.control.tag.jqhtml` - Control-flow tags (if/for/etc.)
- `keyword.control.slot.jqhtml` - Slot keyword (`Slot:name`)
- `meta.tag.component.jqhtml` - Component usage (opening tag)
- `meta.tag.component.close.jqhtml` - Component usage (closing tag)
- `meta.tag.slot.jqhtml` - Slot tag (opening)
- `meta.tag.slot.close.jqhtml` - Slot tag (closing)
- `meta.attribute.special.jqhtml` - `$` attributes
- `punctuation.definition.attribute.binding.jqhtml` - `:` prefix
- `punctuation.definition.attribute.event.jqhtml` - `@` prefix
- `meta.embedded.block.javascript` - JS code blocks
- `meta.embedded.expression.javascript` - JS expressions

## Development

To work on the extension:

```bash
cd packages/vscode-extension
npm install
code .
```

Press F5 to launch a new VS Code window with the extension loaded.

## Publishing

To publish to the VS Code Marketplace:

```bash
npm install -g vsce
vsce package
vsce publish
```

## Troubleshooting

### Extension Not Working

1. Check that the file has `.jqhtml` extension
2. Reload VS Code window (Ctrl+Shift+P → "Reload Window")
3. Check Output panel for errors

### Syntax Not Highlighting

1. Ensure no conflicting extensions are installed
2. Check language mode is set to "JQHTML" (bottom right)
3. Try disabling other HTML/template extensions

## Future Enhancements

Planned features for future versions:

- IntelliSense for component names and props
- Validation and error squiggles
- Rename refactoring
- Find all references to components

## License

MIT - See LICENSE file