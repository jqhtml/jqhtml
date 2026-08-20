# Styling with SCSS

JQHTML components automatically get their component name as a CSS class. This enables a simple, conflict-free approach to styling: one SCSS file per component, with all styles wrapped in the component name.

## The Wrapper Pattern

Every component SCSS file follows this structure:

```scss
// UserCard.scss
.UserCard {
    border-radius: 8px;
    padding: 1rem;

    .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
    }

    .name {
        font-weight: 600;
        margin-top: 0.5rem;
    }

    .bio {
        color: #666;
        font-size: 0.875rem;
    }
}
```

This works because JQHTML renders:

```html
<div class="UserCard Component">
    <img class="avatar" ... />
    <h3 class="name">...</h3>
    <p class="bio">...</p>
</div>
```

The `.UserCard` wrapper scopes all nested styles to that component.

## Why This Works

### No Conflicts

`.avatar` in `UserCard` won't affect `.avatar` in `ProfileHeader`. Each component is isolated:

```scss
// UserCard.scss
.UserCard {
    .avatar { width: 64px; }
}

// ProfileHeader.scss
.ProfileHeader {
    .avatar { width: 120px; }  // Different component, no conflict
}
```

### Simple Class Names

Use natural names like `.toolbar`, `.header`, `.item`. The wrapper provides the namespace:

```scss
// Without wrapper pattern (fragile)
.dashboard-stats-panel-header { ... }
.dashboard-stats-panel-toolbar { ... }

// With wrapper pattern (clean)
.StatsPanel {
    .header { ... }
    .toolbar { ... }
}
```

### Easy Refactoring

Rename a component? Rename its SCSS file and wrapper class. Delete a component? Delete its SCSS file. No hunting through global stylesheets.

## File Organization

Match SCSS files to component files:

```
components/
├── UserCard.jqhtml
├── UserCard.scss
├── StatsPanel.jqhtml
├── StatsPanel.scss
├── DataGrid.jqhtml
└── DataGrid.scss
```

Or organize by feature:

```
features/
├── dashboard/
│   ├── StatsPanel.jqhtml
│   ├── StatsPanel.scss
│   └── ActivityFeed.jqhtml
└── users/
    ├── UserCard.jqhtml
    └── UserCard.scss
```

## What Goes in Component SCSS

**Include:**
- Layout specific to that component
- Spacing between elements
- Component-specific colors and borders
- Responsive breakpoints
- State variations (`.is-loading`, `.is-expanded`)

```scss
.DataGrid {
    .toolbar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .table-container {
        overflow-x: auto;
    }

    &.is-loading {
        opacity: 0.5;
        pointer-events: none;
    }

    @media (max-width: 768px) {
        .toolbar {
            flex-direction: column;
        }
    }
}
```

**Keep in global styles:**
- Utility classes (`.mb-3`, `.text-center`)
- Button styles (`.btn`, `.btn-primary`)
- Typography (`.text-muted`, `.h1`)
- CSS framework overrides

## SCSS Variables

Variables can live outside the wrapper for sharing:

```scss
// Layout.scss
$sidebar-width: 250px;
$header-height: 60px;

.AppLayout {
    .sidebar {
        width: $sidebar-width;
    }

    .main {
        margin-left: $sidebar-width;
    }
}
```

For project-wide variables, use partial files:

```scss
// _variables.scss (no wrapper needed)
$primary: #0d6efd;
$border-radius: 0.375rem;
$spacing-unit: 1rem;
```

## State Modifiers

Use modifier classes for variants:

```scss
.StatusBadge {
    display: inline-flex;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;

    &.status-active {
        background: #d1fae5;
        color: #065f46;
    }

    &.status-pending {
        background: #fef3c7;
        color: #92400e;
    }

    &.status-inactive {
        background: #fee2e2;
        color: #991b1b;
    }
}
```

Apply in templates:

```jqhtml
<Define:StatusBadge tag="span" class="StatusBadge">
    <% if (this.args.status) this.$.addClass('status-' + this.args.status); %>
    <%= content() %>
</Define:StatusBadge>
```

## Splitting Large Files

When styles grow, split into multiple files with the same wrapper:

```scss
// DataGrid.scss (primary)
.DataGrid {
    .toolbar { ... }
    .table { ... }
}

// DataGrid_mobile.scss (supplemental)
.DataGrid {
    @media (max-width: 768px) {
        .toolbar { flex-direction: column; }
        .actions { display: none; }
    }
}
```

## Common Mistakes

### Rules Outside Wrapper

```scss
// WRONG
.Dashboard {
    .stats { ... }
}

.sidebar {  // Leaks to global scope!
    width: 200px;
}

// CORRECT
.Dashboard {
    .stats { ... }
    .sidebar { width: 200px; }
}
```

### Styling Child Components

```scss
// WRONG - don't reach into other components
.Dashboard {
    .UserCard {
        background: red;
    }
}

// CORRECT - UserCard styles itself
// Pass a prop if you need variants
```

### Outer Margins on a Component

```scss
// WRONG - UserCard pushes on whatever sits above it
.UserCard {
    margin-bottom: 1.5rem;
}

// CORRECT - the container owns the gaps between its children
.Dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
```

A component that carries no outer margin can be dropped into any container without
bringing spacing assumptions with it. See [Semantic Design](../17-semantic-design/) for
the full spacing-ownership rules.

### Over-Nesting

```scss
// WRONG - brittle selectors
.Dashboard {
    .content {
        .main {
            .section {
                .card { ... }
            }
        }
    }
}

// CORRECT - flat structure
.Dashboard {
    .section-card { ... }
}
```

## Quick Reference

| Rule | Example |
|------|---------|
| One file per component | `UserCard.scss` for `UserCard` |
| Wrapper matches component | `.UserCard { }` |
| All rules inside wrapper | No top-level `.sidebar` |
| Variables can be outside | `$spacing: 1rem;` before wrapper |
| Modifiers use `&` | `&.is-active { }` |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/19_scss_styling_conventions.md` - Full specification

### Last Updated
2026-08-18

### Editorial Notes
- Focused on practical usage over comprehensive rules
- Emphasized the "why" early to motivate the pattern
- Kept anti-patterns brief with clear before/after
- Used PascalCase component names per online docs convention
- Omitted migration guidance (advanced topic)
- Omitted build validation (implementation detail)
- 2026-08-18: Added an "Outer Margins on a Component" anti-pattern under Common Mistakes,
  with a cross-reference to the new [Semantic Design](../17-semantic-design/) chapter. The
  chapter's existing wrapper-pattern and child-component examples were already correct and
  were left untouched; spacing ownership was the one rule genuinely missing here, and it is
  a styling rule, so it belongs in this chapter as well as in 17.
