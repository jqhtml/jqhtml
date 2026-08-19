# SCSS Styling Conventions

This document specifies the recommended SCSS organization patterns for JQHTML projects. These are conventions, not enforced by the framework, but following them eliminates CSS conflicts and creates maintainable stylesheets.

---

## Core Principle

```
One SCSS file per component.
One wrapper class per file.
The wrapper class matches the component name.
```

This works because JQHTML components automatically render with their component name as a CSS class on the root element.

---

## The Wrapper Pattern

Every SCSS file for a component wraps ALL rules in a single class selector matching the component name:

```scss
// sidebar_nav.scss
.Sidebar_Nav {
    display: flex;
    flex-direction: column;

    .nav-item {
        padding: 0.5rem 1rem;
    }

    .nav-link {
        color: inherit;
        text-decoration: none;

        &:hover {
            background: rgba(0,0,0,0.05);
        }
    }

    .nav-icon {
        width: 20px;
        margin-right: 0.5rem;
    }
}
```

This provides automatic scoping. The class `.nav-item` in `Sidebar_Nav` cannot conflict with `.nav-item` in any other component.

### Why This Works

JQHTML renders components with their name as a class:

```jqhtml
<Define:Sidebar_Nav>
    <nav>...</nav>
</Define:Sidebar_Nav>
```

Renders as:

```html
<nav class="Sidebar_Nav Component">...</nav>
```

The wrapper class provides namespace isolation without BEM naming, CSS modules, or build tool configuration.

### Inherited Components Carry the Whole Chain

A component's element receives a class for **every class in its prototype chain**, not just its
own name. `class Contacts_DataGrid extends DataGrid_Abstract` renders as:

```html
<div class="Contacts_DataGrid DataGrid_Abstract Component">...</div>
```

This is the single most useful fact for organizing SCSS around an abstract base: style
`.DataGrid_Abstract` once and every subclass picks it up, then override per-subclass in
`.Contacts_DataGrid`. Specificity works in your favor — both are single class selectors, so
whichever is defined later wins, which means the subclass file should load after the base.

Two details:

- Classes beginning with `_` are filtered out, so internal base classes can be hidden from
  styling by naming them with a leading underscore.
- When a component's registered name differs from its JS class name, the registered name is
  added first as the most specific entry.

Implementation: `_apply_css_classes()` in `packages/core/src/component.ts`.

### Which Classes Survive Component Replacement

Calling `.component()` on an element that already has one replaces it, and the replacement
strips the old component's classes before applying the new ones. The filter keeps:

| Class | Kept? | Why |
|---|---|---|
| `Contacts_DataGrid` | removed | starts uppercase — treated as a component class |
| `Contacts_DataGrid__header` | **kept** | contains `__` — BEM classes persist by design |
| `status-active` | **kept** | starts lowercase — a styling class |

This is why the modifier convention below uses lowercase names, and why BEM element classes
are safe to attach in templates: neither is destroyed when a component is swapped out.
Uppercase non-component classes on a component's root element are NOT safe — they will be
stripped on replacement.

Implementation: the setter branch of `component()` in `packages/core/src/jquery-plugin.ts`.

---

## File Naming Conventions

SCSS files match their associated component files:

| Component Definition | SCSS File |
|---------------------|-----------|
| `User_Card.jqhtml` | `user_card.scss` |
| `Dashboard_Index.jqhtml` | `dashboard_index.scss` |
| `Settings_Layout.jqhtml` | `settings_layout.scss` |

Convention:
- Component names: `Pascal_Snake_Case` (`User_Card`)
- SCSS filenames: `snake_case` (`user_card.scss`)
- Wrapper class: Matches component name exactly (`.User_Card`)

---

## Wrapper Pattern Benefits

### No CSS Conflicts

`.notice-item` in `Dashboard_Index` won't affect `.notice-item` in `Calendar_Index` because they're in different scope wrappers. Each component is an isolated styling context.

### Self-Documenting

The filename tells you exactly which component it styles. Delete the component → delete its SCSS → no orphaned styles. No hunting through global stylesheets.

### Simple Class Names

Use `.team-grid` instead of `.dashboard-index__team-grid` or `.Dashboard_Index-team-grid`. The wrapper provides the namespace automatically.

### Predictable Specificity

All component styles get the same specificity boost from being nested under their wrapper class. No specificity wars.

### Safe Refactoring

Rename a component? Rename its SCSS file and wrapper class. Move a component? Move its SCSS file with it. No grep through global stylesheets.

---

## Content Guidelines

### Include in Component SCSS

- Layout specific to that component
- Spacing between child elements
- Component-specific colors/borders/shadows
- Responsive breakpoints for that component
- States specific to that component (`.is-loading`, `.is-expanded`)

### Keep in Global/Shared Styles

- Utility classes (`.mb-3`, `.text-center`, `.d-flex`)
- Button styles (`.btn`, `.btn-primary`)
- Typography primitives (`.text-muted`, `.fw-bold`)
- Framework overrides (Bootstrap customizations)
- CSS custom properties / design tokens

### Rule of Thumb

If it describes what something LOOKS like generically → shared styles.
If it describes how THIS component is structured → component SCSS.

---

## SCSS Variables

SCSS variable declarations may appear OUTSIDE the wrapper class. This enables sharing when files are imported:

```scss
// layout.scss
$sidebar-width: 215px;
$header-height: 57px;
$mobile-breakpoint: 991.98px;

.App_Layout {
    .sidebar {
        width: $sidebar-width;
        position: fixed;
    }

    .main-content {
        margin-left: $sidebar-width;
    }

    @media (max-width: $mobile-breakpoint) {
        .sidebar { width: 100%; }
        .main-content { margin-left: 0; }
    }
}
```

Other files can `@use` this file to access the variables while the rules remain scoped to the component.

---

## Variables-Only Files

Files containing ONLY variable declarations (no selectors or rules) don't need a wrapper class:

```scss
// _colors.scss
$primary: #0d6efd;
$secondary: #6c757d;
$success: #198754;
$danger: #dc3545;

// _spacing.scss
$spacer: 1rem;
$spacers: (
    0: 0,
    1: $spacer * 0.25,
    2: $spacer * 0.5,
    3: $spacer,
    4: $spacer * 1.5,
    5: $spacer * 3
);
```

Convention: Prefix with underscore (`_colors.scss`) to indicate these are partials meant for importing, not standalone stylesheets.

---

## Supplemental SCSS Files

When component styles grow large, split into multiple files. All files for the same component use the SAME wrapper class:

```
app_layout.scss              (primary - required)
app_layout_mobile.scss       (supplemental - mobile breakpoints)
app_layout_print.scss        (supplemental - print styles)
```

```scss
// app_layout.scss (primary)
.App_Layout {
    .sidebar { width: 250px; }
    .header { height: 60px; }
}

// app_layout_mobile.scss (supplemental)
.App_Layout {
    @media (max-width: 768px) {
        .sidebar { display: none; }
        .header { height: 50px; }
    }
}

// app_layout_print.scss (supplemental)
.App_Layout {
    @media print {
        .sidebar { display: none; }
        .no-print { display: none; }
    }
}
```

The primary file (matching the component name exactly) must exist. Supplemental files extend it with the same wrapper.

---

## Directory Organization

Recommended structure:

```
styles/
    _variables.scss        # Design tokens, no wrapper needed
    _mixins.scss           # Shared mixins, no wrapper needed
    base/
        _reset.scss        # CSS reset/normalize
        _typography.scss   # Base type styles
        _utilities.scss    # Utility classes
    components/
        user_card.scss     # .User_Card { }
        sidebar_nav.scss   # .Sidebar_Nav { }
        data_grid.scss     # .Data_Grid { }
    pages/
        dashboard.scss     # .Dashboard_Index { }
        settings.scss      # .Settings_Page { }
```

The `components/` and `pages/` directories contain scoped SCSS files. The `base/` directory contains global styles that don't need wrappers.

---

## Anti-Patterns

### Multiple Top-Level Selectors

```scss
// WRONG - rules outside wrapper
.Dashboard_Index {
    .stats { ... }
}

.sidebar {           // This leaks into global scope!
    width: 200px;
}

// CORRECT - everything inside wrapper
.Dashboard_Index {
    .stats { ... }

    .sidebar {
        width: 200px;
    }
}
```

### No Wrapper At All

```scss
// WRONG - no scoping
.card { padding: 1rem; }
.stats-grid { display: grid; }
.header { height: 60px; }

// CORRECT - scoped to component
.Dashboard_Index {
    .card { padding: 1rem; }
    .stats-grid { display: grid; }
    .header { height: 60px; }
}
```

### Generic Component Names

```scss
// WRONG - too generic, will conflict
.Card { ... }
.Header { ... }
.List { ... }

// CORRECT - specific, contextual names
.User_Profile_Card { ... }
.App_Header { ... }
.Product_List { ... }
```

### Styling Other Components

```scss
// WRONG - reaching into child component styles
.Dashboard_Index {
    .User_Card {           // Don't style other components!
        background: red;
    }
}

// CORRECT - User_Card styles itself
// If you need a variant, pass props or use modifier classes
```

### Deep Nesting

```scss
// WRONG - over-nested, brittle
.Dashboard_Index {
    .content {
        .main {
            .section {
                .card {
                    .header {
                        .title { ... }
                    }
                }
            }
        }
    }
}

// CORRECT - flat structure, direct children
.Dashboard_Index {
    .section-card { ... }
    .section-title { ... }
}
```

---

## State Modifiers

Use BEM-style modifiers for component states:

```scss
.Status_Badge {
    display: inline-flex;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;

    .icon {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 0.5rem;
    }

    // Variants via modifier classes
    &.status-active {
        background: #d1fae5;
        color: #065f46;
        .icon { background: #10b981; }
    }

    &.status-inactive {
        background: #fee2e2;
        color: #991b1b;
        .icon { background: #ef4444; }
    }

    &.status-pending {
        background: #fef3c7;
        color: #92400e;
        .icon { background: #f59e0b; }
    }
}
```

---

## Migration from Global CSS

To migrate existing global CSS to component-scoped SCSS:

1. Identify which component uses each rule
2. Create component SCSS file with wrapper
3. Move rules inside wrapper, adjusting selectors
4. Delete from global stylesheet
5. Test component in isolation

Start with leaf components (no children) and work up to containers. Each migration is independent.

---

## Build-Time Validation

**Not implemented.** This is a suggestion for downstream build tooling, not a jqhtml feature —
nothing in the framework or the compiler checks SCSS structure today.

Consider adding validation to enforce the wrapper pattern:

1. File contains exactly one top-level class selector
2. The class name matches an existing component
3. All rules are nested inside that selector

This catches mistakes before they cause CSS conflicts in production.
