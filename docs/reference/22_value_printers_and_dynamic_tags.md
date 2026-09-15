# Value Printers and Dynamic Component Tags

Two advanced capabilities for templates whose values, or whose components, are decided by
data rather than written by hand. The default remains what it always was: interpolate
primitives with `<%= %>` and write component tags literally. Reach for what follows only
when a value genuinely knows how it renders, or when which component to mount is genuinely
a property of the data.

---

## Value Printers

### What they are for

A value printer lets `<%= %>` render an **object**. A framework can then hand templates a
typed value - a `RichText`, a `Money`, a `Markdown` - instead of a pre-stringified one, and
the object decides how it renders. The decision is made once, where the type is declared,
rather than in every template that touches the value.

Printers are not a general text-transform hook and not a place for formatting logic. They
exist so that a value can carry its own type into a template.

### Registering a printer

```javascript
jqhtml.add_object_printer(fn);   // fn(value) -> undefined | string | descriptor
```

Printers form a chain in registration order. Each is called with the object; it returns
`undefined` to decline, and the first printer to return anything else handles the value.
The remaining printers are not called.

`undefined` is the decline signal rather than `false`: a printer that falls off its end
without returning reads correctly as "not mine", whereas `false` would turn a forgotten
`return` into an accidental handle.

Independent consumers can coexist: a framework registers printers for its own value types,
an application registers its own for its own types, and neither reaches into the other's
dispatch.

### The gate

Interpolation runs for every value of every render, so primitives must cost exactly what
they cost today. The compiled wrapper decides before anything else runs:

| Value | Path |
|---|---|
| `null`, `undefined` | prints nothing (unchanged) |
| string, number, boolean, bigint | the existing escape path - the chain is never walked |
| an array | the existing behaviour (an instruction splice) - the chain is never walked |
| any other object | the printer chain |

The chain is walked only in the branch nothing previously used, so its cost is paid only
where something is actually being rendered.

### Return values

**`undefined`** - decline; the next printer is tried.

**A string** - treated exactly as a string literal at that site would be:

| Construct | Effect on a printer string |
|---|---|
| `<%= %>` | HTML-escaped |
| `<%!= %>` | not escaped |
| `<%br= %>` | HTML-escaped, then newlines become `<br />` |

A printer cannot opt out of escaping. A type that needs to emit markup returns a
descriptor instead, so the escaping rule of each construct stays intact.

**A component descriptor** - an object jqhtml mounts as though the template had written
the tag:

```javascript
{
    component: {
        name:  'RichTextDisplay',
        args:  { value: '<p>hello</p>' },   // component arguments ($foo= in template syntax)
        attrs: { class: 'rich-text' }       // plain HTML attributes on the element
    }
}
```

`args` and `attrs` are separate buckets. In template syntax they are told apart by the `$`
sigil; that sigil belongs to the syntax and does not appear in the descriptor. A key
beginning with `$` in either bucket is rejected.

`name` is validated by the same rule as any component name, and a valid name that names
nothing renders the ordinary placeholder component, exactly as an undefined literal tag
does.

A descriptor carries no content. A component mounted this way cannot receive child markup;
everything it needs arrives through `args`. It is rendering a value, not wrapping markup.

Do not emit mounting markup yourself. The descriptor exists so that consumers never touch
jqhtml's private placeholders; jqhtml decides what a descriptor means in its own
environment - mounted live in the browser, server-rendered under SSR. The same printer is
therefore correct in both, with no environment awareness on the consumer's side.

### Errors

Both throw; neither can silently produce `[object Object]`.

- An object reaches an interpolation and every printer declines, or no printer is
  registered: the error names the value's constructor and the size of the chain.
- A printer returns something that is neither `undefined`, a string, nor a valid
  descriptor (including a descriptor with an invalid `name`): the error names the
  printer's position in the chain.

### Attribute position does not use printers

```jqhtml fragment
<div title="<%= value %>">
```

compiles through the attribute path, not the content path, and is unchanged by this
feature: whatever an attribute did with a value before, it still does. A descriptor has no
meaning inside an attribute, and mount markup there would be garbage. Where an attribute
does coerce a value to a string, a consuming type can refuse by throwing from `toString()`.

### Example

```javascript
class Money {
  constructor(cents) { this.cents = cents; }
}
class RichText {
  constructor(html) { this.html = html; }   // already sanitized
}

jqhtml.add_object_printer((value) => {
  if (value instanceof Money) return (value.cents / 100).toFixed(2);   // a string: escaped by <%= %>
  if (value instanceof RichText) {
    return { component: { name: 'RichTextDisplay', args: { value: value.html } } };
  }
  // anything else: fall through (implicit undefined)
});
```

```jqhtml
<Define:RichTextDisplay tag="div" class="rich-text">
  <%!= this.args.value %>
</Define:RichTextDisplay>
```

```jqhtml
<Define:InvoiceRow tag="tr">
  <td><%= this.args.total %></td>       <!-- Money -> "12.34" -->
  <td><%= this.args.notes %></td>       <!-- RichText -> <RichTextDisplay> mounted here -->
</Define:InvoiceRow>
```

---

## Dynamic Component Tags

### What they are for

A dynamic tag names a component from an expression. The archetype: a form field's editor
is whatever the field's declared type says it is. A template that hardcodes
`<WysiwygInput>` defeats that declaration, because changing it would mean finding every
form that touches the field.

Dynamic tags are not a substitute for a conditional. When there are two possible
components, `<% if %>` around two literal tags is the better answer: it reads plainly,
and rename tools can see both names.

### Syntax

```jqhtml fragment
<{expression} $arg=value attr="literal" />

<{expression} $arg=value>
    content
</{expression}>
```

The expression is evaluated at render time, in the same scope and with the same semantics
as an unquoted argument value (`$foo=this.data.bar`). It must evaluate to a component name
string. The expression runs to the brace that closes it, so a `>` inside it is fine:
`<{this.n > 1 ? 'TextInput' : 'WysiwygInput'} />`.

### Name validation: the literal-tag rule, no more and no less

At render time the value must be a non-empty string that a literal tag would accept: a
capital letter first, optionally preceded by a single underscore, then letters, digits and
underscores. Anything else - an empty string, `undefined`, a lowercase initial, a hyphen -
throws. A name that passes is accepted whether or not a component of that name is defined;
an undefined name renders the ordinary placeholder component, exactly as an undefined
literal tag does. Dynamic tags are not a second kind of component.

### The closing tag is required and matched textually

`</{expression}>` must be present for the paired form, and its expression text must match
the opening one, compared at compile time as normalized text - trimmed, internal whitespace
collapsed. It is never evaluated. A mismatch is a compile error reporting both expressions
and both line numbers. The closing tag exists so that a reader knows what block they are
leaving, as `</div>` tells them and `</>` would not.

### Content behaves normally

```jqhtml fragment
<{this.args.layout}>
  <p>reaches content() exactly as it would for a literal tag</p>
</{this.args.layout}>
```

Named slots work too. A dynamic component is an ordinary component in every respect; only
the way its name was written differs.

### The failure worth knowing about

Validation catches `this.data.editor` being `undefined`. It cannot catch it being
`'WysiwigInput'` - a valid name that names nothing - which renders an empty placeholder
without a word. Rename-refactoring tools cannot see inside the expression either, so a
renamed component is not updated at a dynamic call site.

Neither is a reason to avoid the feature. Both are reasons to prefer a literal tag whenever
the name is actually known, and for a consumer whose set of reachable names is declarable
to verify it on its own side.

### Example

```jqhtml
<Define:FormField tag="div" class="form-field">
  <label><%= this.args.label %></label>
  <{this.args.editor} $name=this.args.name $value=this.args.value />
</Define:FormField>
```

```jqhtml fragment
<FormField $label="Title" $name="title" $editor=column.editor_component $value=record.title />
```

Here `column.editor_component` is a string such as `'TextInput'` or `'WysiwygInput'`,
declared once alongside the column's type.

---

## Related

- `01_template_syntax.md` - interpolation constructs and literal component tags
- `03_dollar_attribute_system.md` - unquoted argument values, the scope dynamic expressions share
- `12_incremental_scaffolding.md` - the placeholder an undefined name renders
