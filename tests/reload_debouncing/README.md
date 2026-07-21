# reload() Debouncing Test

Validates that `reload()` is automatically debounced - multiple rapid calls coalesce into single execution.

## Expected Output

```
on_load execution #1

Firing 5 rapid reload() calls...
on_load execution #2

Final on_load_count: 2
Expected: 2 (initial + 1 debounced reload)

✅ PASS: reload() is debounced correctly
   - 5 rapid calls coalesced into 1 execution
   - All promises resolved
```
