# Bugs Found During Testing

This document tracks bugs discovered through the test suite that are not critical enough to fix immediately.

---

## Bug #2: @ Attribute Event Binding Not Working

**Status**: ✅ **RESOLVED**
**Priority**: **CRITICAL**
**Discovered**: 2025-11-16
**Resolved**: 2025-11-16
**Test**: `tests/event_binding_at_attributes/`

### Description

The `@` attribute syntax for event binding (`@click`, `@change`, `@submit`, etc.) was not working due to duplicate scoped IDs and incorrect attribute naming.

### Root Cause

Two issues:
1. **Naming collision risk**: Used `data-on-` prefix which could collide with user `$on_foo` attributes
2. **Duplicate scoping**: Instruction processor was applying scoped ID suffix twice (`id="btn:ac:ac"` instead of `id="btn:ac"`)

### Resolution

**Changes made:**
1. Changed attribute prefix from `data-on-` to `data-__-on-` to avoid collisions
2. Fixed duplicate scoping in `instruction-processor.ts` line 216 - added check to prevent double-scoping already-scoped IDs

**Files modified:**
- `packages/parser/src/parser.ts` - Changed `@` attribute transformation to `data-__-on-`
- `packages/parser/src/codegen.ts` - Updated to recognize `data-__-on-` prefix
- `packages/core/src/instruction-processor.ts` - Fixed duplicate scoping bug, updated attribute filtering

### Test Results (After Fix)

All 6 event types now **PASSING**:
- ✅ Click events
- ✅ Change events
- ✅ Multiple events on same element
- ✅ Focus/Blur events
- ✅ Keyup events
- ✅ Submit events

### Verified Behavior

- Event handlers receive proper event object
- `this` context is component instance
- `event.preventDefault()` works correctly
- Multiple `@` attributes on same element work independently

---

## Bug #3: this.data Freeze/Unfreeze Cycle Not Implemented

**Status**: ✅ **RESOLVED**
**Priority**: **CRITICAL**
**Discovered**: 2025-11-16
**Resolved**: 2025-11-16
**Test**: `tests/this_data_freeze_unfreeze_cycle/`

### Description

Documentation states that `this.data` should be frozen/unfrozen across lifecycle phases (v2.2.200+), but the freeze/unfreeze cycle was **not enforced**. `this.data` could be modified in any lifecycle method, not just `on_create()` and `on_load()`.

### Root Cause

The original implementation only protected `this.data` reassignment (setter), not property modifications. When code did `this.data.rendered = 'value'`, it bypassed the freeze check because it was modifying properties on the object, not reassigning the whole object.

### Resolution

**Changes made:**

Implemented Proxy-based freeze enforcement for `this.data` in `component.ts` constructor (lines 113-193):

1. **Created `createDataProxy()` helper** - Wraps data objects in Proxy that intercepts property modifications
2. **Proxy `set` trap** - Checks `this.__data_frozen` flag and throws error if attempting to modify properties when frozen
3. **Proxy `deleteProperty` trap** - Prevents property deletion when frozen
4. **Updated setter** - Wraps new data values in Proxy when `this.data` is reassigned

**Files modified:**
- `packages/core/src/component.ts` - Added Proxy-based property modification protection

### Freeze/Unfreeze Cycle

The lifecycle transition points were already implemented correctly:
1. Line 560: Freeze after `on_create()` completes
2. Line 590: Unfreeze before `on_load()` starts
3. Line 756: Freeze after `on_load()` completes

The fix added enforcement at the property level, not just object reassignment.

### Test Results (After Fix)

**All 5 tests passing:**
- ✅ TEST 1: `on_create()` can modify `this.data`
- ✅ TEST 2: `this.data` frozen after `on_create()` (throws error in `on_render()`)
- ✅ TEST 3: `on_load()` can modify `this.data`
- ✅ TEST 4: `this.data` frozen after `on_load()` (throws error in `on_ready()`)
- ✅ TEST 5: Data persists correctly

### Verified Behavior

**Property modifications now properly throw errors:**

```javascript
on_render() {
  this.data.rendered = 'should_fail';  // ✅ Throws error with helpful message
}

on_ready() {
  this.data.ready = 'should_fail';  // ✅ Throws error with helpful message
}
```

**Error messages include:**
- Clear explanation of restriction
- Why the restriction exists
- Exact fix with code examples
- Specific property name that was attempted

### Error Message Example

```
[JQHTML] ERROR: Component "Data_Freeze_Test" attempted to modify this.data.rendered outside of on_create() or on_load().

RESTRICTION: this.data can ONLY be modified in:
  - on_create() (set initial defaults, synchronous only)
  - on_load() (fetch data from APIs, can be async)

WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.

FIX: Modify this.data in on_create() (for defaults) or on_load() (for fetched data):
  ❌ In on_ready(): this.data.rendered = "should_fail";
  ✅ In on_create(): this.data.rendered = "should_fail"; // Set default
  ✅ In on_load(): this.data.rendered = "should_fail"; // Fetch from API
  ✅ For component state: this.args.rendered = "should_fail"; (accessible in on_load)
```

### Related Files

- `packages/core/src/component.ts` - Proxy-based freeze implementation
- `tests/this_data_freeze_unfreeze_cycle/` - Comprehensive test suite

---

## Bug #4: reload() Debouncing Not Working as Documented

**Status**: ✅ **NOT A BUG - WORKING AS INTENDED**
**Priority**: N/A
**Discovered**: 2025-11-16
**Resolved**: 2025-11-16
**Test**: `tests/reload_debouncing/`

### Description

Initially thought `reload()` debouncing was broken because 5 rapid calls resulted in 3 `on_load()` executions instead of 1.

### Why This Is Correct Behavior

The debouncing implementation guarantees that if a call is queued while an execution is running, it will run **at least one more time** after the current execution completes. This ensures data consistency.

**Scenario:**
1. Call `reload()` → starts execution #1
2. While execution #1 is running, call `reload()` 4 more times
3. Execution #1 completes
4. Debouncer runs execution #2 (to handle queued calls)
5. If another call came in during execution #2, runs execution #3

**Why this is necessary:**

```javascript
// Consider this sequence:
component.reload();              // Execution #1 starts: fetch old data
component.data.filter = 'new';   // User changes filter
component.reload();              // Queue execution #2
// Execution #1 completes with old data
// Execution #2 MUST run to fetch new data with updated filter
```

Without this guarantee, the component could display stale data even though a reload was requested after the filter changed.

### Actual Test Results

- **Initial load**: 1 `on_load()` execution
- **5 rapid reloads**: 2-3 additional executions (depending on timing)
- **Total**: 3-4 `on_load()` executions

This is **correct debouncing** - it coalesces calls while guaranteeing freshness.

### Related Files

- `packages/core/src/component.ts` - reload() implementation with correct debouncing
- `tests/reload_debouncing/` - Test validates correct behavior

---

## Bug #5: Attribute Precedence - Style and Class Merging Not Working

**Status**: ✅ **RESOLVED**
**Priority**: **HIGH**
**Discovered**: 2025-11-16
**Resolved**: 2025-11-16
**Test**: `tests/attribute_precedence_invocation_wins/`

### Description

Documentation states that `class` and `style` attributes should MERGE (not overwrite) with invocation winning conflicts. Testing revealed multiple issues with attribute merging across different invocation methods.

### Root Cause

Two issues in `component.ts` `_apply_default_attributes()`:

1. **Style merging bug**: Define styles were unconditionally overwriting invocation styles instead of only adding non-conflicting properties
2. **Template inheritance bug**: `extends=""` chain wasn't being walked, so parent template attributes weren't being merged

### Resolution

**Changes made:**

1. **Style merging fix** (line 1521):
   - Added check `!existingRules.has(prop)` to only add Define style properties that don't exist
   - Ensures invocation wins style property conflicts

2. **Template inheritance chain walking** (lines 1478-1498):
   - Implemented template chain traversal via `extends` property
   - Collects all parent templates and applies attributes in order (parent → child)
   - Ensures all parent classes/styles merge correctly

**Files modified:**
- `packages/core/src/component.ts` - Fixed style merging and template chain walking

### Test Coverage

Created comprehensive 15-test suite covering:

**Class merging:**
- ✅ Overlapping classes (both have "foo")
- ✅ No overlap classes
- ✅ Invocation-only classes
- ✅ Define-only classes
- ✅ Deduplication (same class in both)
- ✅ Programmatic creation (merge with existing element)
- ✅ Template invocation (merge Define + invocation)
- ✅ Template inheritance (merge base → parent → child → invocation)

**Style merging:**
- ✅ Overlapping styles (invocation wins conflicts)
- ✅ No overlap styles (both merge)
- ✅ Invocation-only styles
- ✅ Define-only styles

**All 15 tests passing.**

### Verified Behavior

**Attribute merging rules:**
- **class**: MERGE with deduplication (invocation + Define + parents)
- **style**: MERGE with invocation winning property conflicts
- **Other attributes**: Invocation overwrites Define
- **Template inheritance**: All parents in `extends=""` chain merge (parent → child order)

**Three invocation methods tested:**
1. Programmatic: `$(selector).component('Component_Name')` - merges with existing element
2. Template invocation: `<Component class="..." />` - merges with Define
3. Template inheritance: `extends=""` chain - all parents merge

### Related Files

- `packages/core/src/component.ts` - Attribute merging implementation
- `tests/attribute_precedence_invocation_wins/` - Comprehensive test suite

---

## Template for Future Bugs

```markdown
## Bug #N: [Title]

**Status**: 🐛 Confirmed / 📝 Investigating / ❓ Unclear
**Priority**: Critical / High / Medium / Low
**Discovered**: YYYY-MM-DD
**Test**: `tests/test_name/`

### Description
[What is the bug]

### Example
[Code showing the issue]

### Impact
[How severe, workarounds, affected use cases]

### Notes
[Additional context]

### Related Files
[Relevant source files]
```
