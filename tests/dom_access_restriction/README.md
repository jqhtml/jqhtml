# DOM Access Restriction Test

## Purpose

Validates that the Proxy-based DOM access restriction works correctly during `on_load()` execution.

## What This Tests

### Blocked Operations (Should Throw Errors)

1. **`this.$` access** - jQuery element reference
2. **`this.$sid()` access** - Scoped ID lookup
3. **`this.id()` access** - Component instance lookup
4. **`this.custom_prop = value`** - Setting properties other than `this.data`

### Allowed Operations (Should Work)

1. **`this.data = {...}`** - Setting data property
2. **`this.args.user_id`** - Reading component arguments
3. **`this.component_name()`** - Calling component methods

## Why This Matters

With request deduplication, follower components skip `on_load()` entirely. If a leader's `on_load()` modified DOM:

- Follower components would have different DOM state than leader
- Deduplication would produce inconsistent results
- Developer expectations would be violated

By enforcing "data-only" modification in `on_load()`, we ensure all components (leader and followers) end up in identical states.

## Implementation

Uses a JavaScript Proxy that wraps `this` during `on_load()` execution:

```typescript
const restricted_this = new Proxy(this, {
  get(target, prop) {
    if (prop === '$' || prop === 'id' || prop === '$sid') {
      throw new Error(`Cannot access this.${prop} during on_load()`);
    }
    return target[prop];
  },
  set(target, prop, value) {
    if (prop === 'data') {
      target[prop] = value;
      return true;
    }
    throw new Error(`Cannot modify this.${prop} during on_load()`);
  }
});

await this.on_load.call(restricted_this);
```

## Expected Results

All 7 tests should **PASS**:

- ✅ Test 1: Valid component sets this.data successfully
- ✅ Test 2: Error thrown when accessing this.$
- ✅ Test 3: Error thrown when accessing this.$sid()
- ✅ Test 4: Error thrown when accessing this.id()
- ✅ Test 5: Error thrown when setting this.custom_prop
- ✅ Test 6: Can access this.args.user_id
- ✅ Test 7: Can call this.component_name()

## Running the Test

```bash
cd /var/www/html/jqhtml/tests/dom_access_restriction
./run-test.sh
```

## Related Files

- **Implementation**: `/var/www/html/jqhtml/packages/core/src/component.ts` (load() method)
- **Documentation**: `/var/www/html/jqhtml/docs/official/15_deduplication_and_caching.md`
- **Feature**: Request deduplication + DOM access restriction

## Performance

Proxy overhead: < 1ms per 5000 components (negligible)

See benchmark: `/var/www/html/jqhtml/packages/core/benchmark-proxy.js`
