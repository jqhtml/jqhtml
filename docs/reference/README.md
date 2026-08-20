# Official JQHTML Documentation

Comprehensive, authoritative documentation for JQHTML v2.

**Start here:** [00_INDEX.md](./00_INDEX.md)

## About This Documentation

This documentation set represents the complete, verified specification of JQHTML v2 based on extensive research and testing. All content has been validated against the actual implementation and corrects numerous inconsistencies found in earlier documentation.

## Complete Documentation Set

1. [Template Syntax](./01_template_syntax.md) - Component definition, interpolation, control flow
2. [Component Definition](./02_component_definition.md) - Registration, class structure, lifecycle basics
3. [Dollar Attribute System](./03_dollar_attribute_system.md) - $ prefix for parameters, scoped IDs
4. [Component Nesting and Content](./05_component_nesting_and_content.md) - content() function, nesting patterns
5. [Slot System](./06_slot_system.md) - Named slots for complex layouts
6. [jQuery Integration](./08_jquery_integration.md) - Components as jQuery objects
7. [Debugging Tools](./09_debugging_tools.md) - Debug overlay, verbose logging, inspection
8. [Clarifications: Attribute Precedence](./10_clarifications_attribute_precedence.md) - Q&A on nuanced behaviors
9. [Attribute Handling Comprehensive](./11_attribute_handling_comprehensive.md) - Complete attribute reference
10. [Incremental Scaffolding](./12_incremental_scaffolding.md) - Progressive development patterns
11. [Scoped IDs and Element Access](./13_scoped_ids_and_element_access.md) - this.$sid() patterns
12. [**Lifecycle Complete Specification**](./14_lifecycle_complete_specification.md) ⭐ **AUTHORITATIVE**
13. [Deduplication and Caching](./15_deduplication_and_caching.md) - Automatic request dedup and stale-while-revalidate caching
14. [Semantic-First Design Philosophy](./15_semantic_first_design_philosophy.md) - Why JQHTML exists
15. [Semantic Iterative Design Methodology](./17_semantic_iterative_design_methodology.md) - How to build with JQHTML
16. [Boot - Server-Rendered Component Initialization](./18_boot.md) - Hydrating server-rendered placeholders
17. [SCSS Styling Conventions](./19_scss_styling_conventions.md) - Recommended per-component SCSS organization
18. [LLM Reference](./LLM_REFERENCE_OFFICIAL_07_26.md) - Condensed drop-in context for AI-assisted development

**Internal / not in public release** (excluded from the public docs set):
- `07_rspade_integration.md` - RSpade (internal Laravel framework) integration
- `16_bootstrap_component_library.md` - Internal component library reference

## Key Concepts

### The 5-Stage Lifecycle

**create → render → on_render → load → ready**

- **create** - Synchronous setup, set initial `this.args` and `this.data` defaults
- **render** - Template executes, DOM created
- **on_render** - Immediate post-render, before children ready
- **load** (parallel) - Async data loading, **NO DOM manipulation allowed**
- **ready** (bottom-up) - All children ready, safe for DOM

See [14_lifecycle_complete_specification.md](./14_lifecycle_complete_specification.md) for complete details.

### Semantic-First Design

JQHTML is designed for **mechanical thinkers** - developers who think in terms of structure, logic, and data flow rather than visual design.

Write `<UserCard>` not `<div class="card">`. Compose **concepts**, not elements.

See [15_semantic_first_design_philosophy.md](./15_semantic_first_design_philosophy.md)

### Incremental Scaffolding

**Undefined components work immediately** - they render as divs with class names. This enables:
1. Scaffold page structure with semantic names
2. Add CSS targeting those classes
3. Define component templates incrementally
4. Add JavaScript behavior as needed

See [12_incremental_scaffolding.md](./12_incremental_scaffolding.md)

## Quick References

### For Framework Developers
- [CLAUDE.md](../../CLAUDE.md) - Complete JQHTML Bible (philosophy, specification, development)
- [Integration Guides](../integration/) - Laravel, VS Code extension
- [Internal Documentation](../internal/) - Sourcemaps, testing

## Man Page

For quick reference in RSpade framework:
```bash
php artisan rsx:man jqhtml
```

## Important Notes

### Corrected Information

This documentation corrects several widespread errors found in earlier docs:

- ✅ **Lifecycle is 5 stages, not 4** - Added `on_render()` stage
- ✅ **Unescaped interpolation is `<%!= %>` not `<%! %>` or `<%== %>`**
- ✅ **Double-render pattern** - Components render twice when `on_load()` modifies `this.data`
- ✅ **this.data starts as `{}`** - Empty object on first render
- ✅ **@event bindings exist** - Template syntax for event handlers
- ✅ **$ attributes create data- attributes** - Implementation detail from v1

### Development Philosophy

- **No backwards compatibility (pre-1.0)** - Breaking changes expected until 1.0 release
- **Components ARE jQuery** - `this.$` is genuine jQuery, not a wrapper
- **DOM IS the state** - No separate state management needed
- **Deterministic lifecycle** - Predictable initialization order
- **Fail loud** - No silent fallbacks

---

**Last Updated:** October 7, 2025 - Based on comprehensive 10-year development research
