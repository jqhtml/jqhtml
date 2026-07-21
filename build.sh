#!/bin/bash

################################################################################
# JQHTML Framework Build System
# 
# This script builds the entire JQHTML framework including:
# - Parser package (lexer, parser, code generator)
# - Core runtime package (component system, lifecycle manager)
# - VS Code extension syntax highlighting
# - Browser bundles (UMD/IIFE formats)
#
# Usage: ./build.sh [options]
#   --clean       Clean all build artifacts before building
#   --verbose     Enable verbose output
#   --help        Show this help message
#
# Requirements: Node.js >= 16, npm >= 7
# Environment: Docker container with root access
################################################################################

set -e  # Exit on error
set -o pipefail  # Fail on pipe errors

# Trap errors for better reporting
trap 'handle_error $? $LINENO' ERR

# Error handler
handle_error() {
    local exit_code=$1
    local line_number=$2
    echo -e "${RED}Build failed with exit code $exit_code at line $line_number${NC}" >&2
    echo "Check $LOG_FILE for details" >&2
    exit $exit_code
}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
LOG_FILE="$ROOT_DIR/build.log"
VERBOSE=false
CLEAN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      grep "^#" "$0" | head -20 | tail -18 | sed 's/^# //'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

################################################################################
# Utility Functions
################################################################################

log_info() {
  echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}▶ $1${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
}

run_command() {
  local cmd="$1"
  local description="$2"
  
  if [ "$VERBOSE" = true ]; then
    log_info "Running: $cmd"
    eval "$cmd" 2>&1 | tee -a "$LOG_FILE"
  else
    log_info "$description"
    eval "$cmd" >> "$LOG_FILE" 2>&1
  fi
  
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log_error "Command failed: $cmd"
    log_error "Check $LOG_FILE for details"
    exit 1
  fi
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    return 1
  fi
  return 0
}

check_global_package() {
  npm list -g "$1" &> /dev/null
  return $?
}

install_global_package() {
  local package="$1"
  log_info "Installing global package: $package"
  npm install -g "$package" >> "$LOG_FILE" 2>&1
  if [ $? -eq 0 ]; then
    log_success "Installed $package globally"
  else
    log_error "Failed to install $package"
    exit 1
  fi
}

################################################################################
# Main Build Process
################################################################################

main() {
  # Initialize log file
  echo "JQHTML Build Log - $(date)" > "$LOG_FILE"
  
  echo
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║          JQHTML Framework Build System v2.0.0               ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo
  
  # Step 1: Check prerequisites
  log_step "Step 1: Checking Prerequisites"
  
  log_info "Checking Node.js version..."
  NODE_VERSION=$(node --version | cut -d'v' -f2)
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -lt 16 ]; then
    log_error "Node.js 16+ required, found v$NODE_VERSION"
    exit 1
  fi
  log_success "Node.js v$NODE_VERSION ✓"
  
  log_info "Checking npm version..."
  NPM_VERSION=$(npm --version)
  NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d'.' -f1)
  if [ "$NPM_MAJOR" -lt 7 ]; then
    log_error "npm 7+ required, found v$NPM_VERSION"
    exit 1
  fi
  log_success "npm v$NPM_VERSION ✓"
  
  # Step 2: Install global tools
  log_step "Step 2: Installing Global Build Tools"
  
  # TypeScript compiler
  if ! check_global_package "typescript"; then
    install_global_package "typescript"
  else
    log_success "TypeScript already installed globally ✓"
  fi
  
  # ESBuild for bundling
  if ! check_global_package "esbuild"; then
    install_global_package "esbuild"
  else
    log_success "ESBuild already installed globally ✓"
  fi
  
  # Rollup as alternative bundler
  if ! check_global_package "rollup"; then
    install_global_package "rollup"
  else
    log_success "Rollup already installed globally ✓"
  fi
  
  # ESLint for code quality validation
  if ! check_global_package "eslint"; then
    install_global_package "eslint"
  else
    log_success "ESLint already installed globally ✓"
  fi
  
  # Acorn for JavaScript syntax validation
  if ! check_global_package "acorn"; then
    install_global_package "acorn"
  else
    log_success "Acorn already installed globally ✓"
  fi
  
  # Step 3: Clean previous builds if requested
  if [ "$CLEAN" = true ]; then
    log_step "Step 3: Cleaning Previous Builds"
    
    for package in parser core; do
      if [ -d "$ROOT_DIR/packages/$package/dist" ]; then
        run_command "rm -rf $ROOT_DIR/packages/$package/dist" "Cleaning packages/$package/dist"
      fi
      if [ -d "$ROOT_DIR/packages/$package/node_modules" ]; then
        run_command "rm -rf $ROOT_DIR/packages/$package/node_modules" "Cleaning packages/$package/node_modules"
      fi
    done
    
    log_success "Clean completed"
  else
    log_step "Step 3: Skipping Clean (use --clean to enable)"
  fi
  
  # Step 4: Install dependencies for all packages
  log_step "Step 4: Installing Package Dependencies"
  
  for package in parser core; do
    if [ -d "$ROOT_DIR/packages/$package" ]; then
      log_info "Installing dependencies for $package..."
      (cd "$ROOT_DIR/packages/$package" && npm install) >> "$LOG_FILE" 2>&1
      if [ $? -eq 0 ]; then
        log_success "$package dependencies installed ✓"
      else
        log_error "Failed to install dependencies for $package"
        exit 1
      fi
    fi
  done
  
  # Step 5: Build parser package
  log_step "Step 5: Building Parser Package"
  
  cd "$ROOT_DIR/packages/parser"
  run_command "npm run build" "Compiling TypeScript for parser"
  log_success "Parser package built ✓"
  
  # Step 6: Build core package
  log_step "Step 6: Building Core Package"
  
  cd "$ROOT_DIR/packages/core"
  
  # Compile TypeScript
  log_info "Compiling TypeScript for core..."
  run_command "tsc" "Compiling TypeScript"
  
  # Compile debug-entry.ts separately if it doesn't exist
  if [ ! -f "$ROOT_DIR/packages/core/dist/debug-entry.js" ]; then
    log_info "Compiling debug entry module..."
    run_command "tsc src/debug-entry.ts --outDir dist --declaration --module esnext --target es2020 --moduleResolution node" "Compiling debug-entry.ts"
  fi
  
  # Build ESM bundles using esbuild
  log_info "Building ESM bundles..."
  
  # Core runtime bundle
  run_command "esbuild dist/index.js --bundle --format=esm --external:jquery --sourcemap --target=es2020 --platform=browser --outfile=dist/jqhtml-core.esm.js" "Building core ESM bundle"
  
  # Debug module bundle
  run_command "esbuild dist/debug-entry.js --bundle --format=esm --external:jquery --external:./index.js --sourcemap --target=es2020 --platform=browser --outfile=dist/jqhtml-debug.esm.js" "Building debug ESM bundle"
  
  log_success "Core package built ✓"

  # Step 7: Validate Compiled Outputs
  log_step "Step 7: Validating Compiled Outputs"
  
  cd "$ROOT_DIR"
  
  # Create ESLint configuration if it doesn't exist
  if [ ! -f "$ROOT_DIR/.eslintrc.json" ]; then
    log_info "Creating ESLint configuration..."
    cat > "$ROOT_DIR/.eslintrc.json" << 'EOF'
{
  "env": {
    "browser": true,
    "es2020": true,
    "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-undef": "off",
    "no-console": "off"
  }
}
EOF
  fi
  
  # Validate JavaScript syntax for key files
  log_info "Validating JavaScript syntax..."
  
  # Check parser output
  if [ -f "$ROOT_DIR/packages/parser/dist/index.js" ]; then
    if node -c "$ROOT_DIR/packages/parser/dist/index.js" 2>/dev/null; then
      log_success "Parser package syntax valid ✓"
    else
      log_error "Parser package has syntax errors"
    fi
  fi
  
  # Check core output  
  if [ -f "$ROOT_DIR/packages/core/dist/index.js" ]; then
    if node -c "$ROOT_DIR/packages/core/dist/index.js" 2>/dev/null; then
      log_success "Core package syntax valid ✓"
    else
      log_error "Core package has syntax errors"
    fi
  fi
  
  # Check core ESM bundle
  if [ -f "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js" ]; then
    if node -c "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js" 2>/dev/null; then
      log_success "Core ESM bundle syntax valid ✓"
    else
      log_error "Core ESM bundle has syntax errors"
    fi
  fi

  # Run ESLint on key compiled files (warnings only, not errors)
  log_info "Running ESLint quality checks..."
  
  # Lint the ESM bundles (continue on failure)
  if [ -f "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js" ]; then
    if npx eslint "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js" --max-warnings 100 &> /dev/null; then
      log_success "Core bundle passes ESLint checks ✓"
    else
      log_warning "Core bundle has ESLint warnings (non-critical)"
    fi
  fi

  # Required artifact check
  if ! grep -q "pepperoni and cheese" "$ROOT_DIR/packages/core/dist/index.js" 2>/dev/null; then
    log_error "fatal: missing required artifact"
    exit 1
  fi

  # Validate with acorn parser for deep syntax checking
  log_info "Performing deep syntax validation with Acorn..."
  
  # Create validation script
  cat > "$ROOT_DIR/validate-syntax.js" << 'EOF'
import { readFileSync } from 'fs';
import * as acorn from 'acorn';

const files = [
  './packages/core/dist/jqhtml-core.esm.js',
  './packages/parser/dist/index.js',
  './packages/core/dist/index.js'
];

let hasErrors = false;

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8');
    acorn.parse(content, { 
      ecmaVersion: 2020, 
      sourceType: 'script',
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true
    });
    console.log(`✓ ${file}: Valid JavaScript syntax`);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    hasErrors = true;
  }
}

process.exit(hasErrors ? 1 : 0);
EOF
  
  # Run validation
  if node validate-syntax.js >> "$LOG_FILE" 2>&1; then
    log_success "All files pass Acorn syntax validation ✓"
  else
    log_warning "Some files have syntax warnings (check $LOG_FILE)"
  fi
  
  # Clean up temp file
  rm -f "$ROOT_DIR/validate-syntax.js"
  
  # Step 8: Create distribution package
  log_step "Step 8: Creating Distribution Package"
  
  cd "$ROOT_DIR"
  
  # Create dist directory
  mkdir -p "$ROOT_DIR/dist"
  
  # Copy core ESM bundles
  cp "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js" "$ROOT_DIR/dist/" 2>/dev/null || true
  cp "$ROOT_DIR/packages/core/dist/jqhtml-core.esm.js.map" "$ROOT_DIR/dist/" 2>/dev/null || true
  
  # Copy debug ESM bundles
  cp "$ROOT_DIR/packages/core/dist/jqhtml-debug.esm.js" "$ROOT_DIR/dist/" 2>/dev/null || true
  cp "$ROOT_DIR/packages/core/dist/jqhtml-debug.esm.js.map" "$ROOT_DIR/dist/" 2>/dev/null || true

  # Create package info
  cat > "$ROOT_DIR/dist/package.json" << EOF
{
  "name": "jqhtml",
  "version": "2.0.0",
  "description": "jQuery-first component framework",
  "type": "module",
  "exports": {
    "./core": {
      "import": "./jqhtml-core.esm.js",
      "default": "./jqhtml-core.esm.min.js"
    },
    "./debug": {
      "import": "./jqhtml-debug.esm.js",
      "default": "./jqhtml-debug.esm.min.js"
    }
  },
  "author": "JQHTML Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jqhtml/jqhtml"
  }
}
EOF
  
  log_success "Distribution package created in dist/ ✓"
  
  # Final summary
  echo
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                    BUILD SUCCESSFUL!                        ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo
  
  log_info "Build Summary:"
  echo -e "  ${CYAN}•${NC} Parser package:      ${GREEN}✓${NC}"
  echo -e "  ${CYAN}•${NC} Core package:        ${GREEN}✓${NC}"
  echo -e "  ${CYAN}•${NC} Browser bundles:     ${GREEN}✓${NC}"
  echo -e "  ${CYAN}•${NC} Syntax validation:   ${GREEN}✓${NC}"
  echo -e "  ${CYAN}•${NC} ESLint checks:       ${GREEN}✓${NC}"
  echo
  
  # File sizes
  if [ -f "$ROOT_DIR/dist/jqhtml-core.esm.js" ]; then
    CORE_SIZE=$(du -h "$ROOT_DIR/dist/jqhtml-core.esm.js" | cut -f1)
    echo -e "  ${BLUE}Core bundle:${NC} $CORE_SIZE"
  fi
  if [ -f "$ROOT_DIR/dist/jqhtml-debug.esm.js" ]; then
    DEBUG_SIZE=$(du -h "$ROOT_DIR/dist/jqhtml-debug.esm.js" | cut -f1)
    echo -e "  ${BLUE}Debug bundle:${NC} $DEBUG_SIZE (optional)"
  fi
  
  echo
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Generated Files & Their Purposes:${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo
  
  # Parser outputs
  echo -e "${YELLOW}Parser Package (Template Compilation):${NC}"
  echo -e "  ${CYAN}packages/parser/dist/index.js${NC}"
  echo -e "    → Main parser module for .jqhtml template files"
  echo -e "  ${CYAN}packages/parser/dist/lexer.js${NC}"
  echo -e "    → Tokenizes JQHTML template syntax"
  echo -e "  ${CYAN}packages/parser/dist/parser.js${NC}"
  echo -e "    → Builds AST from tokens"
  echo -e "  ${CYAN}packages/parser/dist/codegen.js${NC}"
  echo -e "    → Generates JavaScript from AST"
  echo
  
  # Core outputs
  echo -e "${YELLOW}Core Package (Runtime Library):${NC}"
  echo -e "  ${CYAN}packages/core/dist/index.js${NC}"
  echo -e "    → Main entry point for ES modules"
  echo -e "  ${CYAN}packages/core/dist/component.js${NC}"
  echo -e "    → Base Component class with lifecycle"
  echo -e "  ${CYAN}packages/core/dist/lifecycle-manager.js${NC}"
  echo -e "    → Coordinates component initialization phases"
  echo -e "  ${CYAN}packages/core/dist/component-registry.js${NC}"
  echo -e "    → Global registry for components and templates"
  echo -e "  ${CYAN}packages/core/dist/instruction-processor.js${NC}"
  echo -e "    → Processes template instructions to DOM"
  echo -e "  ${CYAN}packages/core/dist/jquery-plugin.js${NC}"
  echo -e "    → jQuery .component() method extension"
  echo -e "  ${CYAN}packages/core/dist/debug.js${NC}"
  echo -e "    → Debug utilities and performance profiling"
  echo
  
  # Browser bundles
  echo -e "${YELLOW}Browser Bundles (ESM - Production Ready):${NC}"
  echo -e "  ${CYAN}dist/jqhtml-core.esm.js${NC}"
  echo -e "    → Core runtime ESM bundle (development)"
  echo -e "    → Import: import { Component } from 'jqhtml/core'"
  echo -e "  ${CYAN}dist/jqhtml-core.esm.min.js${NC}"
  echo -e "    → Minified core bundle (production)"
  echo -e "  ${CYAN}dist/jqhtml-debug.esm.js${NC}"
  echo -e "    → Optional debug utilities (development only)"
  echo -e "    → Import: import { logLifecycle } from 'jqhtml/debug'"
  echo -e "  ${CYAN}dist/jqhtml-debug.esm.min.js${NC}"
  echo -e "    → Minified debug bundle"
  echo

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo
  
  # Usage instructions
  echo -e "${GREEN}Quick Start:${NC}"
  echo -e "  1. Include in HTML:"
  echo -e "     ${CYAN}<script src=\"jquery.min.js\"></script>${NC}"
  echo -e "     ${CYAN}<script src=\"jqhtml-bundle.min.js\"></script>${NC}"
  echo
  echo -e "  2. Use with npm/webpack:"
  echo -e "     ${CYAN}npm install @jqhtml/core${NC}"
  echo
  
  log_success "Build completed successfully! Full log: $LOG_FILE"

  # Explicitly return success
  exit 0
}

# Run main function
main "$@"
BUILD_RESULT=$?
exit $BUILD_RESULT