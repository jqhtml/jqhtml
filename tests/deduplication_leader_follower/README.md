# Load Deduplication Leader/Follower Test

Validates that multiple identical component invocations deduplicate `on_load()` execution.

## What This Tests

1. **Leader election** - First component with matching args becomes leader
2. **Single on_load()** - Only leader executes `on_load()`, not followers
3. **Data sharing** - Followers receive leader's `this.data`
4. **Separate groups** - Different args create separate deduplication groups
5. **Efficiency** - 4 components → 2 `on_load()` calls

## Expected Output

```
========================================
LOAD DEDUPLICATION LEADER/FOLLOWER TEST:
========================================

TEST 1: Deduplication (user_id=42)
  on_load calls for user_id=42: 1
  Expected: 1 (leader only)
✅ PASS: Only one on_load() executed for user_id=42

TEST 2: Separate deduplication group (user_id=99)
  on_load calls for user_id=99: 1
  Expected: 1
✅ PASS: Separate deduplication for user_id=99

TEST 3: Followers receive leader data
  Card 1 name: "User 42"
  Card 2 name: "User 42"
  Card 3 name: "User 42"
  Expected: all "User 42"
✅ PASS: All followers received leader data

TEST 4: All components rendered
  Rendered text (card1): "User 42"
  Rendered text (card2): "User 42"
  Rendered text (card3): "User 42"
  Rendered text (card4): "User 99"
✅ PASS: All components rendered correctly

TEST 5: Total deduplication efficiency
  Total on_load calls: 2
  Expected: 2 (1 for user_id=42, 1 for user_id=99)
  Components created: 4
  Efficiency: 2 calls for 4 components
✅ PASS: Deduplication reduced 4 components to 2 on_load calls

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Deduplication key**: Component name + sorted args (e.g., `User_Card::{"user_id":42}`)
- **Leader**: First component with matching key
- **Followers**: Subsequent components with matching key wait for leader
- **Data broadcast**: Leader's `this.data` copied to all followers
- **Performance**: Prevents redundant API calls for identical data
- **Coordination**: Cleared after dispatch (no memory leaks)
