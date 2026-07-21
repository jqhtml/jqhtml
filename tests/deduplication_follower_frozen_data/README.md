# Deduplication Follower Frozen Data Bug (FIXED)

## Bug Description

When multiple identical components (same name + args) boot in parallel:
1. First component becomes "leader" and executes `on_load()`
2. Other components become "followers" and wait for leader
3. When leader completes, followers need to receive the leader's data

## Previous Bug

The coordinator tried to set `follower.data = leader_data` directly, but follower's
`this.data` was FROZEN because follower never entered `_execute_on_load_detached()`.

## Fix Applied

Two changes were made:

1. **Followers now use `_apply_load_result()`** instead of direct data assignment.
   This properly handles freeze/unfreeze and data normalization.

2. **Coordination uses a separate promise** that resolves AFTER `_apply_load_result()`
   completes. This ensures followers receive the correct final data.

Flow after fix:
1. Leader executes `on_load()` on detached proxy
2. Leader calls `_apply_load_result()` to set `this.data`
3. Leader calls `complete_coordination(this.data)` to publish data and resolve promise
4. Followers wake up and call `get_leader_data()` to retrieve data
5. Followers call `_apply_load_result()` to apply data (handles freeze/unfreeze)
6. Followers re-render with correct data

## Test Results

- 3 Contact_Display components with identical args
- Only 1 `on_load()` call (deduplication works)
- All 3 components render with correct data
