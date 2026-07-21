# jqhtml.boot() - Server-Rendered Component Initialization

## Overview

`jqhtml.boot()` initializes jqhtml components from server-rendered HTML placeholders. This enables any server-side framework (Laravel, Rails, Django, plain PHP, Express, etc.) to output component markup that JavaScript later transforms into live, interactive components.

**This is NOT Server-Side Rendering (SSR).** The server outputs placeholder elements; the client renders the actual component templates. This approach provides:

- Framework-agnostic server integration
- Clean separation between server markup and client behavior
- Simple integration with any templating language

## The Problem

When a server renders a page, it can't execute JavaScript component templates. Instead, it outputs placeholder elements:

```html
<!-- Server output (Blade, ERB, Jinja, plain PHP, etc.) -->
<div class="_Component_Init"
     data-component-init-name="UserCard"
     data-component-args='{"name":"John","id":123}'>
</div>
```

These are just `div` tags with no behavior. JavaScript must find these placeholders and convert them into live components with event handlers, state, and lifecycle methods.

## The Solution

After the page loads, call `jqhtml.boot()`:

```javascript
import jqhtml from '@jqhtml/core';

// After DOM ready
$(function() {
  jqhtml.boot();
});

// Or await completion
$(async function() {
  await jqhtml.boot();
  console.log('All components ready');
});
```

This scans the DOM for `._Component_Init` elements and transforms each one into a live component.

## Placeholder Contract

Any server-side framework can render jqhtml components by following this contract:

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `class="_Component_Init"` | Yes | Marks element for initialization |
| `data-component-init-name` | Yes | Component class name (e.g., `UserCard`) |
| `data-component-args` | No | JSON-encoded arguments to pass to component |

**Note:** Keys inside the `data-component-args` JSON that are themselves prefixed with `data-` have that prefix stripped before being passed to the component as `args`. For example, `data-component-args='{"data-foo":1}'` results in `args.foo` (not `args['data-foo']`) inside the component.

### After Initialization

- `_Component_Init` class is removed
- `data-component-*` attributes are removed
- Component classes are added (e.g., `UserCard Component`)
- Element becomes a live component with events, state, and lifecycle

## API Reference

### `jqhtml.boot(scope?)`

Initializes all `._Component_Init` elements within the given scope.

**Parameters:**
- `scope` (optional): jQuery object, HTMLElement, or CSS selector. Defaults to `document.body`.

**Returns:** `Promise` that resolves when all components (including nested) are ready.

```javascript
// Initialize entire document
jqhtml.boot();

// Initialize within a specific container
jqhtml.boot(document.getElementById('app'));

// Initialize within a jQuery element
jqhtml.boot($('#modal-content'));

// Wait for all components to be ready
await jqhtml.boot();
doSomethingAfterAllComponentsReady();
```

### Events

| Event | Target | When |
|-------|--------|------|
| `jqhtml:ready` | `document` | All components have finished initializing |

```javascript
document.addEventListener('jqhtml:ready', () => {
  console.log('All components ready');
});
```

## Passing Content (Slots)

Content between component tags becomes available via `content()` in templates:

```html
<!-- Server output -->
<div class="_Component_Init" data-component-init-name="Card" data-component-args='{}'>
    <p>This content is passed to the component</p>
    <button>Click me</button>
</div>
```

```html
<!-- Card.jqhtml template -->
<Define:Card class="card">
    <div class="card-body">
        <%= content() %>
    </div>
</Define:Card>
```

**Result:**
```html
<div class="Card Component card">
    <div class="card-body">
        <p>This content is passed to the component</p>
        <button>Click me</button>
    </div>
</div>
```

The boot script captures `innerHTML` before initialization and passes it as `_inner_html` in args. Templates automatically check for `_inner_html` when `content()` is called.

## Nested Components

Components can contain other components in their server output:

```html
<div class="_Component_Init" data-component-init-name="UserCard" data-component-args='{"id":1}'>
    <div class="_Component_Init" data-component-init-name="Avatar" data-component-args='{"size":"lg"}'></div>
</div>
```

The boot process handles this automatically:

1. Parent `UserCard` initializes first
2. Parent renders its template (which may output different HTML)
3. After parent renders, nested `._Component_Init` elements are discovered
4. Nested components initialize
5. Process continues recursively until no more placeholders remain

**Important:** `await jqhtml.boot()` waits for the entire tree, including all nested components.

## Server-Side Implementation Examples

### PHP (Plain)

```php
<?php
function jqhtml($name, $args = [], $content = '') {
    $json = htmlspecialchars(json_encode($args), ENT_QUOTES, 'UTF-8');
    echo "<div class=\"_Component_Init\" data-component-init-name=\"{$name}\" data-component-args=\"{$json}\">";
    echo $content;
    echo "</div>";
}
?>

<!-- Usage -->
<?php jqhtml('UserCard', ['user_id' => 123]); ?>

<?php jqhtml('Alert', ['type' => 'warning'], '<strong>Warning!</strong> Check your input.'); ?>
```

### Laravel Blade

Create a Blade component for cleaner syntax:

```php
<!-- resources/views/components/jqhtml.blade.php -->
@props(['component', 'args' => []])

<div class="_Component_Init"
     data-component-init-name="{{ $component }}"
     data-component-args="{{ json_encode($args) }}">{{ $slot }}</div>
```

```blade
<!-- Usage in views -->
<x-jqhtml component="UserCard" :args="['user_id' => $user->id]" />

<x-jqhtml component="Modal" :args="['title' => 'Confirm']">
    <p>Are you sure?</p>
    <x-jqhtml component="Button" :args="['variant' => 'primary']">Yes</x-jqhtml>
</x-jqhtml>
```

### Ruby on Rails (ERB)

```ruby
# app/helpers/jqhtml_helper.rb
module JqhtmlHelper
  def jqhtml(component_name, args = {}, &block)
    content = block_given? ? capture(&block) : ''
    content_tag(:div,
      content.html_safe,
      class: '_Component_Init',
      data: {
        'component-init-name': component_name,
        'component-args': args.to_json
      }
    )
  end
end
```

```erb
<!-- Usage -->
<%= jqhtml('UserCard', { user_id: @user.id }) %>

<%= jqhtml('Card', { title: 'Welcome' }) do %>
  <p>Card content here</p>
<% end %>
```

### Python (Django)

```python
# templatetags/jqhtml_tags.py
from django import template
from django.utils.safestring import mark_safe
import json

register = template.Library()

@register.simple_tag
def jqhtml(component_name, **kwargs):
    args_json = json.dumps(kwargs)
    return mark_safe(
        f'<div class="_Component_Init" '
        f'data-component-init-name="{component_name}" '
        f'data-component-args="{args_json}"></div>'
    )
```

```html
<!-- Usage -->
{% load jqhtml_tags %}
{% jqhtml 'UserCard' user_id=user.id %}
```

### Node.js (Express + EJS)

```javascript
// helpers/jqhtml.js
function jqhtml(name, args = {}, content = '') {
  const argsJson = JSON.stringify(args).replace(/"/g, '&quot;');
  return `<div class="_Component_Init" data-component-init-name="${name}" data-component-args="${argsJson}">${content}</div>`;
}

module.exports = { jqhtml };
```

```ejs
<!-- Usage -->
<%- jqhtml('UserCard', { user_id: user.id }) %>

<%- jqhtml('Alert', { type: 'info' }, '<strong>Note:</strong> Read carefully.') %>
```

## Full Server-Side Rendering (@jqhtml/ssr)

`boot()` hydrates placeholders that a server emitted by hand. For rendering actual
component HTML on the server, the `@jqhtml/ssr` package runs a persistent Node render
server (jsdom-based) that a backend talks to over a newline-delimited JSON protocol
(TCP or Unix socket). Two render modes:

- **`render`** — render a single named component with args to an HTML string
  (SEO fallbacks, emails, previews)
- **`render_spa`** — boot a full SPA bundle set in jsdom, dispatch a URL through the
  app's router, and render the resulting page to HTML (full-page SSR for SPA
  frameworks built on JQHTML; added in v2.3.36 for RSpade-style integrations)

The SSR flow pairs with the client-side preload API (`jqhtml.start_data_capture()`,
`get_captured_data()`, `set_preload_data()` — see `packages/core/src/preload-data.ts`):
data captured during the server render is replayed on the client so hydration skips
`on_load()` entirely on preload hits.

**Full documentation:** `packages/ssr/README.md` (protocol, payload shapes, options)
and `packages/ssr/INTEGRATION_GUIDE.md`.

## Client-Side Setup

### With Build Tools (Webpack, Vite, etc.)

```javascript
// app.js
import $ from 'jquery';
import jqhtml from '@jqhtml/core';

// Import and register your compiled templates
import UserCardTemplate from './components/user-card.jqhtml';
import AvatarTemplate from './components/avatar.jqhtml';
import ModalTemplate from './components/modal.jqhtml';

jqhtml.register_template(UserCardTemplate);
jqhtml.register_template(AvatarTemplate);
jqhtml.register_template(ModalTemplate);

// Boot on DOM ready
$(function() {
  jqhtml.boot();
});
```

### Without Build Tools (Script Tags)

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="/js/jqhtml-core.js"></script>
<script src="/js/components.js"></script> <!-- Your compiled templates -->
<script>
  $(function() {
    jqhtml.boot();
  });
</script>
```

## Dynamic Content

When loading HTML dynamically (AJAX, modals, etc.), call `boot()` on the new content:

```javascript
// After loading HTML via AJAX
$('#container').load('/api/users', function() {
  // Initialize any components in the loaded content
  jqhtml.boot($('#container'));
});

// After showing a modal with component content
$('#myModal').on('shown.bs.modal', function() {
  jqhtml.boot($(this));
});
```

## Debugging

`boot()` does not have a dedicated verbose/activity log, but it does report failures to the console so misconfigured placeholders are easy to spot:

```javascript
jqhtml.boot();
// Console (only on failure):
// [jqhtml.boot] Failed to parse args for UserCard: SyntaxError: ...
// [jqhtml.boot] Failed to create UserCard: Error: ...
```

To confirm boot() completed, `await` it or listen for `jqhtml:ready`:

```javascript
await jqhtml.boot();
console.log('All components booted');
```

## Best Practices

1. **Call boot() once on page load** - Don't call it multiple times on the same elements

2. **Scope dynamic content** - When loading content dynamically, pass the container to `boot()` to avoid re-processing existing components

3. **Await when needed** - If you need to interact with components immediately after boot, use `await jqhtml.boot()`

4. **JSON-encode args properly** - Ensure special characters are escaped in the `data-component-args` attribute

5. **Use helper functions** - Create server-side helpers (as shown above) to avoid manual HTML construction

## Common Issues

### Components Not Initializing

- Verify `_Component_Init` class is present (with underscore prefix)
- Check that `data-component-init-name` matches a registered component
- Ensure jqhtml templates are loaded before calling `boot()`
- Check browser console for JSON parsing errors in `data-component-args`

### Nested Components Not Working

- Ensure parent component's template includes `<%= content() %>` where children should appear
- Verify nested elements also have `_Component_Init` class

### Content Not Appearing

- Verify template uses `<%= content() %>` to render passed content
- Check that innerHTML was present in the placeholder element
