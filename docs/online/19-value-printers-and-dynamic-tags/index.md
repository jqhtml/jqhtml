# Value Printers and Dynamic Tags

Two advanced features for the case where data, not the template, decides what renders.
Most templates never need either: interpolate primitives with `<%= %>` and write component
tags by name. Read this chapter when a value knows how it should render, or when which
component to mount is genuinely a property of your data.

## Why values would print themselves

A database text column can hold plain text, sanitized HTML from an editor, or a notation
your application defines. Which one is a fact about the column - declared once on the model.
Yet every template that shows the value has to remember it: escape or not, convert newlines
or not. When two templates disagree, one renders markup as literal angle brackets and the
other renders user input unescaped, and nothing errors.

The fix is to let the value carry its type. The model hands the template an object instead
of a string, and the object says how it renders. `<%= %>` cannot print an object on its own
(it would show `[object Object]`), so you register a **printer** that can.

Printers exist for exactly this: giving templates typed values. They are not a place to put
formatting logic or a general text hook.

## Registering a printer

```javascript
class RichText {
  constructor(html) { this.html = html; }   // already sanitized upstream
}

class Money {
  constructor(cents) { this.cents = cents; }
}

jqhtml.add_object_printer((value) => {
  if (value instanceof Money) {
    return (value.cents / 100).toFixed(2);        // a string
  }
  if (value instanceof RichText) {
    return { component: { name: 'RichTextDisplay', args: { value: value.html } } };
  }
  // anything else: return nothing, the next printer is asked
});
```

```jqhtml
<Define:RichTextDisplay tag="div" class="rich-text">
  <%!= this.args.value %>
</Define:RichTextDisplay>
```

Now a template can interpolate either type without knowing which it has:

```jqhtml
<Define:InvoiceRow tag="tr">
  <td><%= this.args.total %></td>
  <td><%= this.args.notes %></td>
</Define:InvoiceRow>
```

`total` (a `Money`) prints `12.34`. `notes` (a `RichText`) mounts a `RichTextDisplay`
component in place, live in the browser or server-rendered, with no change to the template.

## How the chain works

- Printers run in the order they were registered. Return `undefined` to decline; the first
  printer to return anything else handles the value, and the rest are not asked.
- Only objects reach the chain. Strings, numbers, booleans, `null`, `undefined` and arrays
  take the same path they always did, so a page of primitives costs nothing extra.
- A returned **string** is treated like a string literal at that spot: `<%= %>` escapes it,
  `<%!= %>` does not, `<%br= %>` escapes it and turns newlines into `<br />`. A printer
  cannot skip escaping; to emit markup, return a component descriptor.
- A returned **descriptor** `{ component: { name, args, attrs } }` mounts the named
  component. `args` are the component's arguments (written without the `$`), `attrs` are
  plain HTML attributes on its element. A descriptor carries no child content.
- If no printer handles an object, or a printer returns something malformed, rendering
  throws. `[object Object]` is never silently produced.
- Attribute values (`title="<%= value %>"`) do not use printers. They behave exactly as
  they did before.

## Why a component's name would come from data

Take the editor for a form field. A column declared as rich text wants a WYSIWYG editor; a
plain column wants a text input. If the form hardcodes `<WysiwygInput>`, the column's
declaration is decoration - changing it means finding every form that touches the field.

A **dynamic tag** names the component from an expression:

```jqhtml
<Define:FormField tag="div" class="form-field">
  <label><%= this.args.label %></label>
  <{this.args.editor} $name=this.args.name $value=this.args.value />
</Define:FormField>
```

```jqhtml fragment
<FormField $label="Title" $name="title" $editor=column.editor_component $value=record.title />
```

`column.editor_component` is a string such as `'TextInput'` or `'WysiwygInput'`, declared
once alongside the column's type. The expression is evaluated when the template renders, in
the same scope as any unquoted argument value.

The paired form takes content like any component, and its closing tag repeats the
expression so a reader knows which block is ending:

```jqhtml fragment
<{this.args.layout}>
  <p>This reaches content() as usual.</p>
</{this.args.layout}>
```

The closing expression must match the opening one textually (spacing aside). A mismatch is
a compile error that names both.

## This is not a conditional

When there are two possible components, write the condition:

```jqhtml fragment
<% if (column.rich) { %>
  <WysiwygInput $name=column.name />
<% } else { %>
  <TextInput $name=column.name />
<% } %>
```

Both names are visible to a reader and to rename tools. Use a dynamic tag when the set of
names is open, or lives in data you do not control from the template.

## The failure to watch for

The name is validated at render time by the same rule as a literal tag: it must be a
non-empty string starting with a capital letter (optionally preceded by one underscore),
with only letters, digits and underscores. `undefined`, `''` or `'text_input'` throw.

What validation cannot catch is a valid name that names nothing:

```jqhtml fragment
<{'WysiwigInput'} $name="body" />   <!-- typo: renders an empty placeholder, silently -->
```

That renders the same unstyled placeholder `<div>` an undefined literal tag renders - which
is intentional for scaffolding, and means a typo here fails quietly. A renamed component is
not updated inside the expression by refactoring tools either.

So: prefer a literal tag whenever the name is actually known. If your application can
enumerate the names that may appear in a dynamic tag, check the value against that list
before it reaches the template.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/22_value_printers_and_dynamic_tags.md` - the reference treatment of both features
- `docs/reference/01_template_syntax.md` - interpolation constructs
- `docs/reference/12_incremental_scaffolding.md` - the placeholder an undefined name renders

### Last Updated
2026-09-14

### Editorial Notes
- 2026-09-14: New chapter. Both features are introduced from their motivation (the
  typed-column problem) before their mechanics, because both are easy to reach for wrongly.
  The "not a conditional" section and the valid-but-wrong-name failure are given their own
  headings deliberately. Error message texts, the `$`-sigil rejection in descriptors and
  the runtime's internal instruction form are omitted as implementation detail.
