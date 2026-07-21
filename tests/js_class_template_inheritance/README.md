# JavaScript Class Template Inheritance Test

Tests that components can inherit templates from their parent class without defining their own JQHTML template.

## What This Tests

1. **Base Template**: `Text_Input` has both `.jqhtml` template and `.js` class
2. **JS-Only Extension**: `Phone_Text_Input` has ONLY `.js` class (no `.jqhtml` template)
3. **Template Resolution**: Framework walks JS prototype chain to find parent template
4. **Method Extension**: Child class adds functionality (phone formatting) to parent methods
5. **Component Rendering**: `Phone_Text_Input` renders using parent's template

## Test Structure

- **Text_Input**: Base component with textbox template and get_value/set_value methods
- **Phone_Text_Input**: Extends Text_Input (JS only), adds get_formatted_phone() method
- **Tester**: Uses Phone_Text_Input instance, validates template inheritance works

## Expected Behavior

1. Tester component renders with Phone_Text_Input instance
2. Phone_Text_Input has no explicit template defined
3. Framework finds Text_Input template via prototype chain
4. Phone_Text_Input renders using parent's template (textbox)
5. Phone_Text_Input methods (get_value, set_value, get_formatted_phone) all work
6. Phone formatting logic adds to parent functionality

## Success Criteria

- Phone_Text_Input renders textbox (from Text_Input template)
- get_value() and set_value() work (inherited from parent)
- get_formatted_phone() returns formatted phone number (child-specific logic)
- No errors about missing template for Phone_Text_Input
- Template resolution happens automatically via prototype chain
