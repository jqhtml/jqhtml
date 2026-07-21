# Reload Test

## What This Tests

Validates the `reload()` method behavior with:
1. Args change detection
2. Cache integration
3. Deduplication during reload

## Test Cases

### Test 1: Basic reload() - Same Args
- Create component with `data_id: 100`
- Click "Reload Test 1" button
- Should call `on_load()` again
- Should re-render with fresh data
- Timestamp should update

**Expected behavior:**
- No cache check (args didn't change)
- Calls `on_load()` with deduplication
- Always re-renders after `on_load()`

### Test 2: reload() with Args Change (Cache Hit)
- Create component with `data_id: 100`
- Pre-load cache with `data_id: 200` (done automatically after 500ms)
- Click "Change Args & Reload"
- Changes args to `data_id: 200`

**Expected behavior:**
1. Detects args changed (`100` → `200`)
2. Checks cache for `data_id: 200` → **Cache hit!**
3. Hydrates `this.data` from cache
4. Renders immediately with cached data
5. Calls `on_load()` for revalidation
6. If data unchanged after `on_load()`, skips second render

### Test 3: reload() with Args Change (Cache Miss)
- Create component with `data_id: 300`
- Click "Change Args & Reload (uncached)"
- Changes args to `data_id: 999` (not in cache)

**Expected behavior:**
1. Detects args changed (`300` → `999`)
2. Checks cache for `data_id: 999` → **Cache miss**
3. No initial render (cache was empty)
4. Calls `on_load()` to fetch data
5. Renders once with fresh data

## Key Features Tested

- **Args snapshot tracking**: `_args_on_last_render` stored in `_render()`
- **Cache read on args change**: Only when args differ from last render
- **Conditional rendering**:
  - Render from cache if args changed + cache hit
  - Always render after `on_load()` if didn't render yet OR data changed
- **Cache write filter**: Only cache non-empty data (`!== '{}'`)
- **Deduplication reuse**: `reload()` calls `load()` which has all deduplication logic

## Running the Test

```bash
./run-test.sh
```

Watch console for:
- `[Cache] reload() - Component X hydrated from cache (args changed)`
- `[Data_Component] on_load() called with data_id: X`
- Render counts and timing

## Implementation Details

### reload() Flow

```
1. Check if args changed since last render
   ├─ Yes → Try cache for new args
   │   ├─ Cache hit (non-empty) → Hydrate + Render
   │   └─ Cache miss → Continue
   └─ No → Continue

2. Capture data before load
3. Call load() (with deduplication)
4. Check if render needed:
   ├─ Didn't render from cache → Render
   ├─ Data changed after load → Render
   └─ Already rendered + data same → Skip
```

### Related Files

- `/packages/core/src/component.ts` - `reload()`, `_render()`, `load()`
- `/packages/core/src/load-coordinator.ts` - Deduplication logic
- `/packages/core/src/local-storage.ts` - Cache storage
