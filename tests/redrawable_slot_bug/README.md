# Redrawable Slot Bug Test

## Problem

When a `$redrawable` attribute is applied to an element that contains a slot (`content('slotname')`), the slot content does not render.

## Test Case

**Parent_Grid**: Defines a table with `<thead $redrawable>` containing `<%= content('DG_Table_Header') %>`

**Child_Grid**: Extends Parent_Grid and provides slot content via `<#DG_Table_Header>`

## Expected Behavior

The thead should render with the slot content (header row with "ID" and "Name" columns).

## Actual Behavior

The thead renders empty - the slot content is not included.

## Issue

The `$redrawable` attribute transforms the element into a `<Redrawable>` component. This transformation may be breaking the slot content passing mechanism.

## Files

- `parent_grid.jqhtml` - Parent component with redrawable thead
- `parent_grid.js` - Parent component class with sample data
- `child_grid.jqhtml` - Child component providing slot content
- `test.jqhtml` - Test page
- `test.js` - Test verification logic
- `run-test.sh` - Test runner script
