# Event Handling

JQHTML components have their own event system for component-to-component communication. This is separate from jQuery's DOM event system.

## Component Events

Components can broadcast events with `this.trigger()` and listen with `.on()`:

```javascript
class DataLoader extends Jqhtml_Component {
  async on_load() {
    this.data.items = await fetch('/api/items').then(r => r.json());
    this.trigger('data-loaded', { count: this.data.items.length });
  }
}

// Another component listening
const loader = this.sid('loader');
loader.on('data-loaded', (component, data) => {
  console.log(`Loaded ${data.count} items`);
});
```

## Fire If Already Occurred

The key feature of JQHTML's event system: **if you subscribe to an event that already happened, the callback fires immediately.**

```javascript
const component = this.sid('child');

// If 'ready' already fired, this callback runs immediately
// If not, it runs when 'ready' fires later
component.on('ready', (c) => {
  console.log('Component is ready');
});
```

This behavior is essential for lifecycle events. Without it, you'd have race conditions—subscribing to `'ready'` after the component finished loading would never fire.

**During reload:** When `reload()` is called on an already-ready component, the framework automatically resets the "already occurred" state for `'ready'`. This ensures that new `.on('ready')` handlers wait for the reload to complete, rather than firing immediately based on the previous lifecycle.

### invalidate() - Reset the "Already Occurred" State

`invalidate(event_name)` clears the stored state for an event, so the next `.on()` or
`.once()` handler waits for the event to happen again instead of firing immediately:

```javascript
component.invalidate('ready');
```

This is the mechanism `reload()` uses internally. Call it directly when your own custom
event has a "current" state that has gone stale:

```javascript
class ImportJob extends Jqhtml_Component {
  start_new_import() {
    // A previous run already triggered 'import-complete'. Without this, a handler
    // registered now would fire immediately for the OLD run.
    this.invalidate('import-complete');
    this.run();
  }
}
```

**It does not remove registered handlers** — already-registered `.on()` callbacks stay
subscribed and fire on the next `trigger()`. It only discards the remembered occurrence and
its stored data.

## Built-in Lifecycle Events

Every component automatically triggers these events:

| Event | When It Fires |
|-------|---------------|
| `'create'` | After `on_create()` completes |
| `'render'` | After each render completes |
| `'load'` | After `on_load()` completes |
| `'loaded'` | After `on_loaded()` completes (see below) |
| `'ready'` | After `on_ready()` completes (component fully initialized) |
| `'stop'` | When component is stopped |

```javascript
// Wait for a child component to be ready
const chart = this.sid('chart');
chart.on('ready', (c) => {
  c.set_data(this.data.metrics);
});

// Or use the promise-based .ready() method
await chart.ready();
chart.set_data(this.data.metrics);
```

**The `'loaded'` event:** Fires after `on_loaded()` completes — both during the initial boot and on every subsequent call to `this.load()` or `this.reload()` (unless the component was booted via an internal SSR-preload/truncation path). This makes it useful for reacting whenever a component has just finished applying freshly-loaded data, without caring whether a render happened:

```javascript
const grid = this.sid('grid');
grid.on('loaded', (c) => {
  console.log('Grid data loaded/reloaded');
});
```

## Event API

**Triggering events:**
```javascript
this.trigger('event-name');           // No data
this.trigger('event-name', { ... });  // With data object
```

**Listening to events:**
```javascript
component.on('event-name', (component, data) => {
  // component = the component that triggered the event
  // data = whatever was passed to trigger(), or undefined
});
```

The callback always receives the component as the first argument. The data argument is optional and will be `undefined` if `trigger()` was called without data.

**How a trigger dispatches:** `trigger()` first records the event as having occurred (storing
`data` for late subscribers), then calls each registered handler. Two consequences worth
knowing:

- **A throwing handler does not stop the others.** Each callback is called independently and
  an error is logged to the console, so one bad listener cannot suppress the rest.
- **A handler registered *during* a dispatch does not fire in that same dispatch.** It does
  not miss the event, though — because the event is already marked as occurred, `.on()`
  delivers it immediately at registration time.

**Note:** For already-occurred events, the callback fires immediately with the `data` from the most recent `trigger()` call for that event (not `undefined`) — the framework stores each event's latest data so late subscribers see it. If `trigger()` is called again later, that new data replaces the stored value for any future late subscribers.

### .once() - Fire Exactly Once

`.once(event_name, callback)` behaves like `.on()`, but the callback fires at most one time and is then automatically removed:

```javascript
component.once('loaded', (c, data) => {
  console.log('Fires only for the first loaded event');
});
```

**Behavior:**
- If the event already occurred (sticky): the callback fires immediately with the stored data and is **not** registered for future occurrences.
- If the event hasn't occurred yet: the callback registers, fires on the first occurrence, then auto-deregisters.
- Returns `this` for chaining, same as `.on()`.

**Use for:** One-shot listeners — e.g. reacting to the first `'loaded'` after creating a component programmatically, without needing to manually unregister the handler.

## Custom Component Events

Define your own events for component communication:

```javascript
class UserCard extends Jqhtml_Component {
  async save() {
    await fetch(`/api/users/${this.args.user_id}`, {
      method: 'PUT',
      body: JSON.stringify(this.get_form_data())
    });

    this.trigger('saved', { user_id: this.args.user_id });
  }

  delete() {
    if (confirm('Delete this user?')) {
      this.trigger('deleted', { user_id: this.args.user_id });
    }
  }
}
```

```javascript
// Parent component listening to child events
class UserList extends Jqhtml_Component {
  on_ready() {
    this.$.find('.UserCard').each((_, el) => {
      const card = $(el).component();

      card.on('saved', (c, data) => {
        console.log(`User ${data.user_id} saved`);
      });

      card.on('deleted', (c, data) => {
        this.remove_user(data.user_id);
      });
    });
  }
}
```

## Template Event Binding (@)

For binding DOM events in templates, use `@` attributes:

```jqhtml
<Define:Button>
  <button @click=this.handle_click>
    <%= this.args.label %>
  </button>
</Define:Button>
```

```javascript
class Button extends Jqhtml_Component {
  handle_click(event) {
    event.preventDefault();
    this.trigger('clicked');
  }
}
```

Common DOM events:

| Attribute | DOM Event |
|-----------|-----------|
| `@click` | click |
| `@submit` | form submit |
| `@change` | input change |
| `@keyup` | key released |
| `@focus` | element focused |
| `@blur` | element blurred |

The `@` syntax is shorthand for DOM event binding. The handler receives the native DOM event object.

## jQuery Events vs Component Events

JQHTML's component events and jQuery's DOM events are **separate systems**:

| | Component Events | jQuery DOM Events |
|-|------------------|-------------------|
| **Syntax** | `component.on()` / `this.trigger()` | `this.$.on()` / `this.$.trigger()` |
| **Purpose** | Component-to-component communication | DOM interaction, plugin hooks |
| **Fire if occurred** | Yes | No |
| **Use for** | Data events, state changes, lifecycle | Click handlers, form events, scroll |

**Use component events** for communication between JQHTML components about data and state.

**Use jQuery events** when you need actual DOM events, or when integrating with jQuery plugins that expect them:

```javascript
class SortableList extends Jqhtml_Component {
  on_ready() {
    // jQuery plugin expects jQuery events
    this.$sid('list').sortable({
      update: () => this.save_order()
    });

    // Window scroll is a DOM event
    $(window).on('scroll', () => this.update_sticky_header());
  }
}
```

**Window resize is the exception.** Do not bind `$(window).on('resize')` — override `on_viewport_resize(viewport_width)` instead. The framework runs one debounced listener for the whole page and calls the hook on every component, so there is no listener to clean up. See [Lifecycle](../06-lifecycle/).

## Passing Callbacks

An alternative to events is passing callbacks from parent to child:

```jqhtml
<Define:UserList>
  <% for (let user of this.data.users) { %>
    <UserCard $user=user $on_delete=this.handle_delete />
  <% } %>
</Define:UserList>
```

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    this.$sid('delete').on('click', () => {
      this.args.on_delete(this.args.user.id);
    });
  }
}

class UserList extends Jqhtml_Component {
  handle_delete(user_id) {
    // Handle deletion
  }
}
```

This approach is often cleaner than event broadcasting when the parent-child relationship is explicit.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/01_template_syntax.md` - @ event binding syntax
- `docs/reference/08_jquery_integration.md` - jQuery event handling
- `docs/reference/14_lifecycle_complete_specification.md` - Viewport Resize section

### Last Updated
2026-08-19

### Editorial Notes
- Rewrote to focus on JQHTML's component event system
- Emphasized "fire if already occurred" behavior as key feature
- Clarified distinction between component events and jQuery DOM events
- @ binding kept for template DOM events
- Added callback passing as alternative pattern
- 2025-12-12: Added Event API section documenting callback signature (component, data)
- 2025-12-26: Added note about how reload() resets the "already occurred" state for ready events
- 2026-07-21: Accuracy pass - corrected the late-subscriber note (already-occurred events replay the most recent trigger()'s data, not undefined); added a `.once()` subsection; added `'create'`, `'load'`, `'loaded'` to the Built-in Lifecycle Events table with a note on when `'loaded'` fires; corrected `JqhtmlComponent` references to `Jqhtml_Component`.
- 2026-08-07: Window resize is no longer shown as a plain jQuery DOM event. The example now uses scroll, and a callout directs readers to `on_viewport_resize()` — the framework owns the resize listener, so binding one per component is now wrong rather than merely unnecessary.
- 2026-08-19: Added `invalidate(event_name)` — the public method behind the reload behavior already described here, previously unnamed in the chapter — with the point that it discards the remembered occurrence WITHOUT unsubscribing existing handlers. Added trigger dispatch semantics: a throwing handler does not suppress the others, and a handler registered mid-dispatch does not fire in that dispatch (it has already been delivered by the sticky immediate-fire, so it is not a missed event).
