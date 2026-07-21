#!/usr/bin/env node

/**
 * JQHTML Portable Build Script
 * 
 * This script can build JQHTML from source when dropped into another project.
 * It handles TypeScript compilation and bundling without requiring JQHTML's
 * own dependencies to be installed.
 * 
 * Usage:
 *   node build.js              # Build all packages
 *   node build.js --bundle     # Also create browser bundles
 *   node build.js --watch      # Watch mode
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const packages = ['parser', 'core', 'router'];
const args = process.argv.slice(2);
const shouldBundle = args.includes('--bundle');
const shouldWatch = args.includes('--watch');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function findExecutable(name) {
  try {
    // Try to find in node_modules first
    const localPath = join(__dirname, 'node_modules', '.bin', name);
    if (existsSync(localPath)) {
      return localPath;
    }
    
    // Try to find globally
    const result = execSync(`which ${name} 2>/dev/null || where ${name} 2>NUL`, { encoding: 'utf8' }).trim();
    if (result) {
      return result;
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

// Check for required tools
function checkDependencies() {
  log('🔍 Checking build dependencies...', 'cyan');
  
  const tsc = findExecutable('tsc');
  if (!tsc) {
    log('❌ TypeScript compiler not found!', 'red');
    log('   Please install TypeScript:', 'yellow');
    log('   npm install -g typescript', 'yellow');
    log('   or', 'yellow');
    log('   npm install typescript', 'yellow');
    process.exit(1);
  }
  
  log(`✅ Found TypeScript at: ${tsc}`, 'green');
  
  if (shouldBundle) {
    const esbuild = findExecutable('esbuild');
    if (!esbuild) {
      log('⚠️  esbuild not found (needed for bundling)', 'yellow');
      log('   Skipping bundle generation', 'yellow');
      return { tsc, esbuild: null };
    }
    log(`✅ Found esbuild at: ${esbuild}`, 'green');
    return { tsc, esbuild };
  }
  
  return { tsc, esbuild: null };
}

// Build a single package
function buildPackage(pkg, tsc) {
  const pkgPath = join(__dirname, 'packages', pkg);
  const tsconfigPath = join(pkgPath, 'tsconfig.json');
  
  if (!existsSync(tsconfigPath)) {
    log(`⚠️  No tsconfig.json found for ${pkg}, skipping...`, 'yellow');
    return;
  }
  
  log(`📦 Building @jqhtml/${pkg}...`, 'bright');
  
  try {
    execSync(`${tsc} -p ${tsconfigPath}`, { 
      stdio: 'inherit',
      cwd: pkgPath 
    });
    log(`✅ Built ${pkg}`, 'green');
  } catch (error) {
    log(`❌ Failed to build ${pkg}`, 'red');
    process.exit(1);
  }
}

// Create browser bundles
function createBundles(esbuild) {
  if (!esbuild) return;
  
  log('🎁 Creating browser bundles...', 'cyan');
  
  // Core bundle
  const coreBundlePath = join(__dirname, 'packages', 'core', 'dist', 'jqhtml-bundle.js');
  const coreEntryPath = join(__dirname, 'packages', 'core', 'src', 'index.ts');
  
  try {
    execSync(`${esbuild} ${coreEntryPath} --bundle --format=iife --global-name=jqhtml --external:jquery --outfile=${coreBundlePath}`, {
      stdio: 'inherit'
    });
    log('✅ Created core bundle', 'green');
  } catch (error) {
    log('❌ Failed to create core bundle', 'red');
  }
  
  // Router bundle (if exists)
  const routerPath = join(__dirname, 'packages', 'router');
  if (existsSync(routerPath)) {
    const routerBundlePath = join(routerPath, 'dist', 'jqhtml-router.js');
    const routerEntryPath = join(routerPath, 'src', 'index.ts');
    
    try {
      execSync(`${esbuild} ${routerEntryPath} --bundle --format=iife --global-name=jqhtml_router --external:jquery --external:@jqhtml/core --outfile=${routerBundlePath}`, {
        stdio: 'inherit'
      });
      log('✅ Created router bundle', 'green');
    } catch (error) {
      log('❌ Failed to create router bundle', 'red');
    }
  }
}

// Watch mode
function watchPackages(tsc) {
  log('👀 Starting watch mode...', 'cyan');
  
  const watchers = [];
  
  packages.forEach(pkg => {
    const pkgPath = join(__dirname, 'packages', pkg);
    const tsconfigPath = join(pkgPath, 'tsconfig.json');
    
    if (!existsSync(tsconfigPath)) return;
    
    log(`   Watching @jqhtml/${pkg}...`, 'yellow');
    
    const watcher = spawn(tsc, ['-p', tsconfigPath, '--watch'], {
      cwd: pkgPath,
      stdio: 'inherit'
    });
    
    watchers.push(watcher);
  });
  
  // Handle exit
  process.on('SIGINT', () => {
    log('\n🛑 Stopping watchers...', 'yellow');
    watchers.forEach(w => w.kill());
    process.exit(0);
  });
}

// Main build process
async function build() {
  log('🚀 JQHTML Portable Build Script', 'bright');
  log('================================\n', 'bright');
  
  // Check dependencies
  const { tsc, esbuild } = checkDependencies();
  
  if (shouldWatch) {
    // Watch mode
    watchPackages(tsc);
  } else {
    // Build all packages
    log('\n🔨 Building packages...', 'cyan');
    packages.forEach(pkg => buildPackage(pkg, tsc));
    
    // Create bundles if requested
    if (shouldBundle) {
      createBundles(esbuild);
    }
    
    log('\n✨ Build complete!', 'green');
    
    // Instructions
    log('\n📖 Usage:', 'bright');
    log('   For webpack projects:', 'cyan');
    log('     import { Component } from "./jqhtml/packages/core/dist/index.js";', 'yellow');
    log('   For browser scripts:', 'cyan');
    log('     <script src="./jqhtml/packages/core/dist/jqhtml-bundle.js"></script>', 'yellow');
    log('   With TypeScript:', 'cyan');
    log('     import { Component } from "./jqhtml/packages/core/src/index.ts";', 'yellow');
  }
}

// Run the build
build().catch(error => {
  log(`\n❌ Build failed: ${error.message}`, 'red');
  process.exit(1);
});