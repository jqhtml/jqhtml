# Loaded Event Trigger Test

## Purpose

Validates that the `'loaded'` lifecycle event fires correctly:

1. For components WITH a custom `on_load()` function - fires after `on_load()` completes
2. For components WITHOUT a custom `on_load()` function - fires at the same lifecycle point

## The 'loaded' Event

The `'loaded'` event is triggered in the component lifecycle after `on_load()` completes (or would have completed for static components), but **before** the render/on_render second step.

### Lifecycle Position

```
create()
  ↓
trigger('create')
  ↓
_render() / on_render()
  ↓
on_load() [if overridden]
  ↓
★ trigger('loaded') ★   <-- NEW EVENT
  ↓
[re-render if this.data changed]
  ↓
trigger('rendered')
  ↓
on_ready()
  ↓
trigger('ready')
```

### Use Cases

Listen for `'loaded'` when you need to know that data loading is complete but before final rendering:

```javascript
class My_Component extends Jqhtml_Component {
  on_create() {
    this.on('loaded', () => {
      console.log('Data loading phase complete');
      // Can access this.data here (it's populated from on_load)
    });
  }
}
```

## Test Structure

- `test.jqhtml` - Main test harness
- `test.js` - Test logic and assertions
- `with_on_load.jqhtml/js` - Component with custom on_load()
- `without_on_load.jqhtml/js` - Component without custom on_load()

## Running

```bash
./run-test.sh
```

## Expected Output

```
[With_On_Load] on_load starting...
[With_On_Load] on_load complete
[With_On_Load] loaded event received!
[Without_On_Load] loaded event received!
[PASS] loaded event fired for component WITH on_load
[PASS] loaded event fired for component WITHOUT on_load
[PASS] loaded event fired after on_load completed
[TEST PASSED] All loaded event tests passed
```
