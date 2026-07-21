# shallowFind() Test

Tests the `shallowFind()` jQuery method - the opposite of `closest()`.

## What is shallowFind()?

`shallowFind()` searches **downward** through descendants (like `find()`), but **stops traversal when a match is found** (like `closest()`).

### Comparison

```javascript
// find() - gets ALL descendants (recurses into everything)
$('#root').find('.Widget')  // Returns: Widget1, Widget1a, Widget2

// shallowFind() - gets NEAREST descendants (stops at matches)
$('#root').shallowFind('.Widget')  // Returns: Widget1, Widget2 (excludes Widget1a)
```

### Use Case

When you have nested components of the same type and only want the top-level instances:

```html
<div id="container">
  <div class="Widget" data-sid="1">        <!-- MATCHED -->
    <div class="Widget" data-sid="1a">     <!-- EXCLUDED -->
    </div>
  </div>
  <div class="Widget" data-sid="2">        <!-- MATCHED -->
  </div>
</div>
```

## Test Cases

1. **Basic Nested Widgets** - Two top-level widgets, one nested inside another
2. **Deep Nesting** - Widget buried several levels deep
3. **No Matches** - Container with no widgets
4. **Adjacent Siblings** - Multiple widgets at same level
5. **Mixed Hierarchy** - Complex nesting with intermediate non-matching elements

## Performance

Includes performance comparison between `find()` and `shallowFind()`:
- `find()` uses native `querySelectorAll()` (very fast)
- `shallowFind()` uses manual traversal (slightly slower, but different semantics)

## Run Test

```bash
./run-test.sh
```

## Expected Output

Each test should show:
- Test description
- Expected number of matches
- Actual matches found with data-sid
- PASS/FAIL result

Performance section shows timing comparison over 1000 iterations.
