# Data Cache Unregistered Class Test

## Purpose

Tests that ES6 class instances returned from `on_load()` are normalized to plain objects when the class is NOT registered with `jqhtml.register_cache_class()`.

This is the "hot/cold cache parity" feature in data mode - it ensures that fresh data behaves identically to cached data by normalizing through serialize/deserialize immediately after `on_load()`.

## What This Tests

1. Create a component that returns an ES6 class instance in `on_load()`
2. The class is deliberately NOT registered for cache serialization
3. After `on_load()` completes, the instance should be a plain object (not the ES6 class)
4. The instance should NOT have prototype methods (they're stripped during normalization)
5. The instance SHOULD still have data properties

## Expected Behavior

- `this.data.contact instanceof Contact_Model` should be `false`
- `typeof this.data.contact.get_display_name` should be `'undefined'`
- `this.data.contact.name` should equal `'John Doe'` (property preserved)

## Why This Matters

Without hot/cold parity, code that uses ES6 class methods would work during initial development but break after a page reload (when data comes from cache). By normalizing immediately, developers catch missing class registrations during development rather than in production.

## Valid Cache Modes

This test only applies to `data` cache mode. In other modes, it instant-passes.
