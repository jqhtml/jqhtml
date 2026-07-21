# HTML Cache Render Count Test

## Purpose

Tests that HTML cache mode correctly handles render execution counts:
- **First load** (no cache): Template renders twice (initial + after on_load data change)
- **Second load** (with cache): Template renders once (forced re-render after on_load)

Both loads should have `on_render()` called twice (once per render).

## How It Works

The test uses global counters to track execution:
- `window.template_render_count` - Incremented inside template `<% %>` code
- `window.on_render_count` - Incremented in `on_render()` method

### Test Flow

1. Create child component, wait for ready
2. Record first load counts: template_render_count, on_render_count
3. Remove component, wait 100ms
4. Create same component again (triggers cache hit)
5. Record second load counts

### Expected Results

**First Load (fresh render):**
- Template renders: 2 (initial empty render + re-render after on_load)
- on_render calls: 2 (one per render)

**Second Load (from cache):**
- Template renders: 1 (forced re-render after on_load - cached HTML was injected first)
- on_render calls: 2 (once for cached HTML inject, once for forced re-render)

## Why This Matters

HTML cache mode's main benefit is faster initial display. By caching the rendered HTML:
1. User sees content immediately (cached HTML injected)
2. `on_render()` runs to set up the cached DOM
3. `on_load()` fetches fresh data
4. If data differs, forced re-render happens with fresh data
5. `on_render()` runs again with fresh data

The key insight: template execution is skipped when cache hits, but `on_render()` always runs to ensure DOM manipulation code executes.

## Valid Cache Modes

This test only applies to `html` cache mode. In other modes, it instant-passes.
