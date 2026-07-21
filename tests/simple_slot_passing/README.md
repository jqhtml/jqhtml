# Simple Slot Passing Test

## What This Tests

Tests the most basic slot passing scenario: **Parent component invokes child component and passes named slots.**

This is NOT about inheritance (`extends`), just simple component invocation with slots.

## Pattern Being Tested

**Parent component:**
```jqhtml
<Child>
    <#header>Header content</#header>
    <#body>Body content</#body>
</Child>
```

**Child component:**
```jqhtml
<div>
    <%= content('header') %>
    <%= content('body') %>
</div>
```

## Test Case

1. Parent invokes Child component
2. Parent defines two named slots: `header` and `body`
3. Child renders both slots using `content('slotname')`
4. **Expected:** Both slots render with correct content

## Why This Test

The 3-level slot forwarding test failed with "content is not a function" error in Component_C. This suggests that basic slot passing via component invocation might not be working.

We need to verify if the issue is:
- Slot passing not working at all (this test)
- Slot forwarding specifically broken (3-level test)

## Running the Test

```bash
./run-test.sh
```

If this test passes: slot passing works, forwarding is broken.
If this test fails: basic slot passing is broken.
