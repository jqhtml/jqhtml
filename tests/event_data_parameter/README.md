# Event Data Parameter Test

## Purpose

Validates that `trigger(event, data)` correctly passes data to event callbacks, including late subscribers who register after the event has already fired.

## Feature Being Tested

The event system's ability to:
1. Pass custom data as the second parameter to `trigger()`
2. Deliver that data to callback functions as `(component, data) => void`
3. Store and replay data for late subscribers (fire-if-already-occurred behavior)

## Test Scenarios

### Test 1: Subscribe BEFORE trigger

Standard case - register `.on()` handler before `trigger()` is called.

```javascript
emitter.on('my-event', (component, data) => {
  // data should be { key: 'test-key', value: 42, nested: { foo: 'bar' } }
});

emitter.trigger('my-event', { key: 'test-key', value: 42, nested: { foo: 'bar' } });
```

**Expected:** Callback receives both `component` and `data` correctly.

### Test 2: Subscribe AFTER trigger (late subscriber)

Critical case - register `.on()` handler AFTER `trigger()` has already been called.

```javascript
emitter.trigger('my-event', { key: 'test-key', value: 42 });

// ... later ...

emitter.on('my-event', (component, data) => {
  // Should fire immediately (fire-if-already-occurred)
  // data should be { key: 'test-key', value: 42 } - NOT undefined
});
```

**Expected:** Callback fires immediately with stored data from previous trigger.

### Test 3: Multiple triggers update stored data

When an event is triggered multiple times, late subscribers should receive the **most recent** data.

```javascript
emitter.trigger('my-event', { key: 'first' });
emitter.trigger('my-event', { key: 'second' });

emitter.on('my-event', (component, data) => {
  // data should be { key: 'second' } - the LATEST trigger data
});
```

**Expected:** Late subscriber receives data from the most recent trigger.

## Implementation Details

### Current Behavior (Before Fix)

- `_lifecycle_states` stores a Set of event names that have occurred
- Late subscribers receive `undefined` for data because only the boolean "occurred" state is stored

### Required Fix

- Change `_lifecycle_states` from `Set<string>` to `Map<string, any>`
- Store the data passed to each trigger
- Replay stored data for late subscribers

## Related Files

- `packages/core/src/component.ts` - `on()` and `trigger()` methods
- `docs/official/14_lifecycle_complete_specification.md` - Event system documentation

## Running the Test

```bash
cd tests/event_data_parameter
./run-test.sh
```

## Success Criteria

All 3 tests should pass:
- ✓ before_trigger - data received correctly
- ✓ after_trigger_with_data - late subscriber receives stored data
- ✓ multiple_triggers - late subscriber receives latest data
