# HTML Cache Static Skip Test

## Purpose

Tests that static components (those that don't modify `this.data` in `on_load()`) are NOT cached in HTML mode.

This is an optimization - static components render identically every time, so caching them wastes localStorage space without providing any benefit.

## How It Works

Creates two components:
1. **Static_Component** - Has `on_load()` but doesn't modify `this.data`
2. **Dynamic_Component** - Has `on_load()` that modifies `this.data`

After rendering both and waiting for ready, checks:
- Dynamic component: Cache entry EXISTS
- Static component: Cache entry does NOT exist

## Why This Matters

Without this optimization:
- Every component with a cache key would be cached
- Static components would fill localStorage unnecessarily
- Cache eviction would be needed sooner
- No performance benefit since static components render instantly anyway

With this optimization:
- Only dynamic components (those that fetch data) are cached
- Cache space is used efficiently
- Cache hits provide actual value (avoid re-fetching data)

## Implementation Detail

The `_is_dynamic` flag is set in `_load()` after `on_load()` completes:
- If `this.data` changed during `on_load()` AND is not empty `{}`, component is dynamic
- Only dynamic components write to HTML cache

## Valid Cache Modes

This test only applies to `html` cache mode. In other modes, it instant-passes.
