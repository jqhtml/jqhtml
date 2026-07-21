# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.2.22] - 2025-09-21 - RELEASE CANDIDATE 1 🎯

### Major Milestone
This version represents Release Candidate 1 - all developer expectations have been met and the framework is feature-complete.

### Added
- **Unified Component Initialization** - All components now follow single initialization path
- **Define Tag Attributes** - Full support for default attributes on component definitions
- **Attribute Inheritance System** - Define attributes serve as defaults, invocation attributes customize
- **Intelligent Attribute Merging**:
  - `class` attributes combine (both Define and invocation preserved)
  - `style` attributes merge rule-by-rule (invocation wins conflicts)
  - Data attributes (`$*` and `data-*`) pass to component args
  - Regular HTML attributes override completely on conflict
- **Enhanced VS Code Extension** - Improved syntax highlighting for event handlers
- **`as` Attribute** - Define custom element type (default: div)

### Changed
- Component constructor now applies defaultAttributes from templates
- `$foo="bar"` and `data-foo="bar"` are now completely equivalent
- Event handlers with @ prefix highlight as function references
- instruction-processor simplified - component handles own defaults

### Fixed
- Define tag attributes not being applied to components
- Components created via jQuery plugin missing defaultAttributes
- Class merging not working correctly for Define attributes
- VS Code extension VSIX versioning in publish script

### Documentation
- Comprehensive attribute system documentation
- RSPADE team update guide for documentation changes
- Updated API reference with merging rules
- Examples showing Define tag attribute usage

## 2.1.10 (2025-09-18)

**Note:** Version bump only for package @jqhtml/monorepo





## 2.1.9 (2025-09-18)

**Note:** Version bump only for package @jqhtml/monorepo





# JQHTML Changelog

## [2.0.0-rc1] - 2025-08-28

### Added
- Professional ES module distribution with separate entry points
- Tree-shakable debug utilities as optional import
- Source maps for all distributed modules
- Comprehensive build system using esbuild
- Module documentation explaining architecture

### Changed
- **BREAKING**: Migrated from monolithic bundle to ES modules
  - Core runtime: `import { Component } from '@jqhtml/core'`
  - Debug utilities: `import { showDebugOverlay } from '@jqhtml/core/debug'`
  - Router: `import { Jqhtml_Router } from '@jqhtml/router'`
- **BREAKING**: Parser is now server-side only (`@jqhtml/parser`)
- Replaced shell script bundler with professional JavaScript tooling (esbuild)
- jQuery is now a peer dependency instead of bundled dependency
- Debug utilities separated into optional module to reduce production bundle size

### Fixed
- Invalid "var class" syntax in compiled bundles
- Build reproducibility issues with shell script approach
- Bundle size optimization through proper module separation

### Technical Details
- Core module: ~28KB minified (down from 45KB in monolithic bundle)
- Router module: ~12KB minified (optional, only loaded when needed)
- Debug module: ~12KB minified (excluded from production builds)
- Total savings: 30-50% reduction in bundle size for typical applications

## [2.0.0-beta] - Previous Release

### Added
- Component lifecycle system
- Template compilation
- Router with persistent layouts
- Debug overlay system
- jQuery method overrides (.val())
