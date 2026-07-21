# Test: Lifecycle Bottom-Up Timing (DOM Children)

## Purpose

This test validates that JQHTML component lifecycle executes in the correct bottom-up order with proper parallelization. Specifically, it proves that **DOM children** (components in the DOM subtree) complete their `on_ready()` lifecycle before their **DOM parent** component's `on_ready()` executes.

## Component Hierarchy

```
Root (Level 0)
├── Sibling_A (Level 1)
│   ├── Child_A_child1 (Level 2)
│   └── Child_A_child2 (Level 2)
├── Sibling_B (Level 1)
│   ├── Child_B_child1 (Level 2)
│   └── Child_B_child2 (Level 2)
└── Sibling_C (Level 1)
    ├── Child_C_child1 (Level 2)
    └── Child_C_child2 (Level 2)
```

**Total components:** 10 (1 root + 3 siblings + 6 children)

## What Each Component Does

All components implement the same pattern in their `on_ready()` lifecycle method:

```javascript
async on_ready() {
  const start = Date.now();
  console.log(`[ComponentName] on_ready() START - Time: ${start}`);

  // 1 second delay (simulates async work)
  await new Promise(resolve => setTimeout(resolve, 1000));

  const end = Date.now();
  console.log(`[ComponentName] on_ready() END - Time: ${end} - Duration: ${end - start}ms`);
}
```

This allows us to see:
1. **When each component starts** its ready phase
2. **When each component finishes** its ready phase
3. **How long each component took** (should be ~1000ms)
4. **Ordering** (which components run before/after others)
5. **Parallelization** (which components run simultaneously)

## Expected Console Output

```
# Level 2 (6 grandchildren) - ALL START nearly simultaneously
[Child_A_child1] on_ready() START - Time: 1234567890000
[Child_A_child2] on_ready() START - Time: 1234567890001
[Child_B_child1] on_ready() START - Time: 1234567890001
[Child_B_child2] on_ready() START - Time: 1234567890002
[Child_C_child1] on_ready() START - Time: 1234567890002
[Child_C_child2] on_ready() START - Time: 1234567890003

# ~1 second passes (parallel execution)

# Level 2 - ALL END nearly simultaneously
[Child_A_child1] on_ready() END - Time: 1234567891000 - Duration: 1000ms
[Child_A_child2] on_ready() END - Time: 1234567891001 - Duration: 1000ms
[Child_B_child1] on_ready() END - Time: 1234567891001 - Duration: 1000ms
[Child_B_child2] on_ready() END - Time: 1234567891002 - Duration: 1000ms
[Child_C_child1] on_ready() END - Time: 1234567891002 - Duration: 1000ms
[Child_C_child2] on_ready() END - Time: 1234567891003 - Duration: 1000ms

# Level 1 (3 siblings) - ALL START nearly simultaneously AFTER all children END
[Sibling_A] on_ready() START - Time: 1234567891004
[Sibling_B] on_ready() START - Time: 1234567891005
[Sibling_C] on_ready() START - Time: 1234567891005

# ~1 second passes (parallel execution)

# Level 1 - ALL END nearly simultaneously
[Sibling_A] on_ready() END - Time: 1234567892004 - Duration: 1000ms
[Sibling_B] on_ready() END - Time: 1234567892005 - Duration: 1000ms
[Sibling_C] on_ready() END - Time: 1234567892005 - Duration: 1000ms

# Level 0 (root) - Starts AFTER all siblings END
[Root] on_ready() START - Time: 1234567892006

# ~1 second passes

[Root] on_ready() END - Time: 1234567893006 - Duration: 1000ms
```

## Validation Criteria

### Bottom-Up Ordering (DOM Children Before DOM Parents)

1. ✅ **All 6 grandchildren complete BEFORE any sibling starts**
   - Last child END timestamp < First sibling START timestamp
   - Proves Level 2 DOM children finish before Level 1 DOM parents begin

2. ✅ **All 3 siblings complete BEFORE root starts**
   - Last sibling END timestamp < Root START timestamp
   - Proves Level 1 DOM children finish before Level 0 DOM parent begins

### Parallel Execution Within Same Level

3. ✅ **All 6 grandchildren start within ~10ms of each other**
   - Start timestamps differ by milliseconds, not seconds
   - Proves children execute in parallel, not sequentially

4. ✅ **All 6 grandchildren end within ~10ms of each other**
   - End timestamps differ by milliseconds
   - Confirms they all took ~1000ms (parallel duration)

5. ✅ **All 3 siblings start within ~10ms of each other**
   - Start timestamps nearly identical
   - Proves siblings execute in parallel

6. ✅ **All 3 siblings end within ~10ms of each other**
   - End timestamps nearly identical
   - Confirms parallel execution

### Total Duration

7. ✅ **Total time ≈ 3 seconds (NOT 10 seconds)**
   - 3 levels × 1 second per level = 3 seconds
   - If components ran sequentially: 10 components × 1 second = 10 seconds
   - Proves parallelization works correctly

8. ✅ **Each component duration ≈ 1000ms**
   - Confirms async operations complete correctly
   - No race conditions or premature completion

## Running the Test

```bash
cd tests/lifecycle_bottom_up_timing
./run-test.sh
```

The test uses `--delay=5` flag to wait 5 additional seconds after all components are ready, ensuring all async operations complete before capturing output.

## Implementation Details

### Files

- **`child.jqhtml` + `child.js`** - Leaf components (Level 2)
- **`sibling.jqhtml` + `sibling.js`** - Middle components (Level 1)
- **`root.jqhtml` + `root.js`** - Top component (Level 0)
- **`test.jqhtml`** - Entry point that renders Root_Component
- **`run-test.sh`** - Test runner script

### Test Runner Features Used

1. **Paired `.js` file support** - Each template has matching JS class
2. **Multi-file compilation** - Test runner compiles all dependencies
3. **`--delay=5` flag** - Waits 5 seconds before capturing output

### Lifecycle Implementation

**Key architectural change:** Removed all queue-based lifecycle coordination. Components now boot immediately when created.

**Key files modified:**

- `/packages/core/src/lifecycle-manager.ts`
  - Deleted all queue/batch processing logic
  - Replaced with simple `boot_component()` that runs full lifecycle
  - No phase tracking, no coordination, just sequential execution

- `/packages/core/src/component.ts`
  - Added `boot()` method that calls `boot_component()`
  - Added `_wait_for_children_ready()` method (waits for DOM children)
  - Modified `ready()` to wait for DOM children before calling `on_ready()`
  - DOM hierarchy tracked via `_dom_parent` and `_dom_children` (private)

- `/packages/core/src/instruction-processor.ts`
  - Collects all child component boot promises
  - Uses `Promise.all()` to boot siblings in parallel
  - Each child boots recursively (boot → render → boot children → ready)

- `/packages/core/src/jquery-plugin.ts`
  - Updated `.component()` to call `boot()` after instantiation

**How bottom-up works (DOM hierarchy):**
1. DOM parent's `render()` creates child component instances
2. DOM children boot immediately in parallel via `Promise.all()`
3. Each DOM child runs: render → create → load → ready
4. DOM parent's `ready()` calls `_wait_for_children_ready()`
5. `_wait_for_children_ready()` waits for all DOM children's 'ready' events
6. Only then does DOM parent execute its own `on_ready()`

**How parallelization works:**
- Instruction processor boots all siblings with `Promise.all()`
- Each sibling's `boot()` runs independently
- Siblings don't coordinate - they just run and complete
- DOM parent waits for all DOM children, but children don't wait for siblings

**Why it works:**
- **Simple**: No queues, no batch coordination, just boot when created
- **Deterministic**: Same execution order every time (bottom-up via awaits)
- **Parallel**: `Promise.all()` naturally parallelizes siblings
- **Based on v1**: Matches the proven JQHTML v1 architecture

## What This Proves

This test validates the lifecycle architecture and DOM hierarchy tracking:

1. ✅ **Components boot when created** - No queues, no delays
2. ✅ **Bottom-up ordering** - DOM children always complete before DOM parents
3. ✅ **Parallel siblings** - Same-level components run simultaneously
4. ✅ **Correct timing** - 3 seconds total (not 10), proves parallelization
5. ✅ **No race conditions** - DOM parents wait for DOM children via `_wait_for_children_ready()`
6. ✅ **Clean architecture** - Simple boot model, no complex coordination

**Note:** This test validates the DOM hierarchy (`_dom_parent`, `_dom_children`), which is used internally for lifecycle coordination. This is distinct from the instantiation hierarchy (`instantiator()`), which tracks which component rendered another component in their template.

## Related Tests

- **`js_class_support/`** - Proves paired `.js` files work
- **`redrawable_and_scoped_ids/`** - Validates $sid scoping behavior

## Notes

- Console timestamps are in milliseconds since epoch
- Small variations (~1-10ms) in start/end times are normal
- Test requires real browser (uses Playwright)
- Uses webpack bundling (matches RSpade production)
