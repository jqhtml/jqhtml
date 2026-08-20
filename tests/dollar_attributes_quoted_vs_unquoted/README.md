# Dollar Attributes: Quoted vs Unquoted Test

## Purpose

Validates the **critical distinction** between quoted (string literal) and unquoted (JavaScript expression) `$` attribute syntax.

This is a **fundamental feature** of JQHTML's component parameter system - the difference between `$sid="123"` and `$sid=123` determines data types passed to child components.

## What This Tests

1. **Quoted attributes are strings**: `$user_id="123"` → `this.args.user_id = "123"` (string)
2. **Unquoted attributes are expressions**: `$user_id=123` → `this.args.user_id = 123` (number)
3. **Boolean literals**: `$enabled=true` → boolean, `$enabled="true"` → string
4. **Object references**: `$user=this.data.user` → object reference
5. **Function references**: `$handler=this.on_click` → function reference
6. **Type preservation**: Numbers stay numbers, booleans stay booleans

## Expected Behavior

### Quoted (String Literals)
```jqhtml
<Component $sid="123" $name="John" $flag="true" />
```

**Result:**
```javascript
this.args.id === "123"     // typeof: "string"
this.args.name === "John"  // typeof: "string"
this.args.flag === "true"  // typeof: "string", NOT boolean
```

### Unquoted (JavaScript Expressions)
```jqhtml
<Component $sid=123 $enabled=true $user=this.data.user $handler=this.callback />
```

**Result:**
```javascript
this.args.id === 123                    // typeof: "number"
this.args.enabled === true              // typeof: "boolean"
this.args.user === this.data.user       // typeof: "object" (reference)
this.args.handler === this.callback     // typeof: "function"
```

## Pass Criteria

✅ **Test passes if:**
1. Quoted values are strings with correct content
2. Unquoted numbers are type `number`
3. Unquoted booleans (`true`, `false`) are type `boolean`
4. Unquoted object references pass actual object (not serialized)
5. Unquoted function references are callable functions
6. `typeof` checks confirm correct types

❌ **Test fails if:**
- Quoted `"123"` becomes number 123
- Unquoted `123` becomes string "123"
- `true` becomes string "true"
- Object references become serialized strings
- Functions are not callable

## Related Documentation

- CLAUDE.md: $ Attributes (Component Parameters)
- docs/reference/03_dollar_attribute_system.md: Quoted vs Unquoted
