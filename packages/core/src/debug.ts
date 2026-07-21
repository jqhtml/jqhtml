/**
 * JQHTML Debug Module
 * 
 * Provides comprehensive debugging capabilities for JQHTML components
 */

import type { Jqhtml_Component } from './component.js';
import type { DebugSettings } from './index.js';

// Global debug state
let debugSettings: DebugSettings = {};
let performanceMetrics: Map<string, any> = new Map();
let componentTree: Map<string, any> = new Map();

/**
 * Development warning helper
 * Warnings are suppressed in production builds or when JQHTML_SUPPRESS_WARNINGS is set
 */
export function devWarn(message: string): void {
  // Check if warnings are suppressed
  if (typeof window !== 'undefined' && (window as any).JQHTML_SUPPRESS_WARNINGS) {
    return;
  }
  
  // Check if in production mode
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    return;
  }
  
  console.warn(`[JQHTML Dev Warning] ${message}`);
}

// Get global jqhtml object
function getJqhtml(): any {
  if (typeof window !== 'undefined' && (window as any).jqhtml) {
    return (window as any).jqhtml;
  }
  // Fallback: try to get from global if available
  if (typeof globalThis !== 'undefined' && (globalThis as any).jqhtml) {
    return (globalThis as any).jqhtml;
  }
  throw new Error(
    'FATAL: window.jqhtml is not defined. The JQHTML runtime must be loaded before using debug features. ' +
    'Import and initialize @jqhtml/core before attempting to use debug functionality.'
  );
}

// Synchronous delay helper
function delay(ms: number): void {
  if (ms <= 0) return;
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy wait
  }
}

// Visual flash effect
function flashComponent(component: Jqhtml_Component, eventType: 'create' | 'render' | 'ready'): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug?.flashComponents) return;
  
  const duration = jqhtml.debug.flashDuration || 500;
  const colors = jqhtml.debug.flashColors || {};
  const color = colors[eventType] || (
    eventType === 'create' ? '#3498db' : 
    eventType === 'render' ? '#27ae60' : 
    '#9b59b6'
  );
  
  // Store original border
  const originalBorder = component.$.css('border');
  
  // Apply flash border
  component.$.css({
    'border': `2px solid ${color}`,
    'transition': `border ${duration}ms ease-out`
  });
  
  // Remove after duration
  setTimeout(() => {
    component.$.css('border', originalBorder || '');
  }, duration);
}

// Log lifecycle event
export function logLifecycle(component: Jqhtml_Component, phase: string, status: 'start' | 'complete'): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug) return;
  
  const shouldLog = jqhtml.debug.logFullLifecycle || 
    (jqhtml.debug.logCreationReady && (phase === 'create' || phase === 'ready'));
  
  if (!shouldLog) return;
  
  const componentName = component.constructor.name;
  const timestamp = new Date().toISOString();
  const prefix = `[JQHTML ${timestamp}]`;
  
  if (status === 'start') {
    console.log(`${prefix} ${componentName}#${component._cid} → ${phase} starting...`);
    
    // Start performance tracking
    if (jqhtml.debug.profilePerformance) {
      performanceMetrics.set(`${component._cid}_${phase}`, Date.now());
    }
  } else {
    let message = `${prefix} ${componentName}#${component._cid} ✓ ${phase} complete`;
    
    // Add performance data
    if (jqhtml.debug.profilePerformance) {
      const startTime = performanceMetrics.get(`${component._cid}_${phase}`);
      if (startTime) {
        const duration = Date.now() - startTime;
        message += ` (${duration}ms)`;
        
        // Highlight slow renders
        if (phase === 'render' && jqhtml.debug.highlightSlowRenders && 
            duration > jqhtml.debug.highlightSlowRenders) {
          console.warn(`${prefix} SLOW RENDER: ${componentName}#${component._cid} took ${duration}ms`);
          component.$.css('outline', '2px dashed red');
        }
      }
    }
    
    console.log(message);
    
    // Visual feedback
    if (jqhtml.debug.flashComponents && (phase === 'create' || phase === 'render' || phase === 'ready')) {
      flashComponent(component, phase as 'create' | 'render' | 'ready');
    }
  }
  
  // Update component tree if enabled
  if (jqhtml.debug.showComponentTree) {
    updateComponentTree();
  }
}

// Apply delays based on lifecycle phase
export function applyDebugDelay(phase: 'component' | 'render' | 'rerender'): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug) return;
  
  let delayMs = 0;
  switch (phase) {
    case 'component':
      delayMs = jqhtml.debug.delayAfterComponent || 0;
      break;
    case 'render':
      delayMs = jqhtml.debug.delayAfterRender || 0;
      break;
    case 'rerender':
      delayMs = jqhtml.debug.delayAfterRerender || 0;
      break;
  }
  
  if (delayMs > 0) {
    console.log(`[JQHTML Debug] Applying ${delayMs}ms delay after ${phase}`);
    delay(delayMs);
  }
}

// Log instruction processing
export function logInstruction(type: string, data: any): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug?.logInstructionProcessing) return;
  
  console.log(`[JQHTML Instruction] ${type}:`, data);
}

// Log data changes
export function logDataChange(component: Jqhtml_Component, property: string, oldValue: any, newValue: any): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug?.traceDataFlow) return;
  
  console.log(`[JQHTML Data] ${component.constructor.name}#${component._cid}.data.${property}:`, 
    { old: oldValue, new: newValue });
}

// Update component tree visualization
function updateComponentTree(): void {
  // This would update a debug panel if implemented
  // For now, just log the tree structure periodically
  console.log('[JQHTML Tree] Component hierarchy updated');
}

// Router dispatch logging
export function logDispatch(url: string, route: any, params: any, verbose: boolean = false): void {
  const jqhtml = getJqhtml();
  if (!jqhtml?.debug) return;
  
  const shouldLog = jqhtml.debug.logDispatch || jqhtml.debug.logDispatchVerbose;
  if (!shouldLog) return;
  
  const isVerbose = jqhtml.debug.logDispatchVerbose || verbose;
  
  if (isVerbose) {
    console.group(`[JQHTML Router] Dispatching: ${url}`);
    console.log('Matched route:', route);
    console.log('Extracted params:', params);
    console.log('Route component:', route.component);
    console.log('Route layout:', route.layout);
    console.log('Route meta:', route.meta);
    console.groupEnd();
  } else {
    console.log(`[JQHTML Router] ${url} → ${route.component} (params: ${JSON.stringify(params)})`);
  }
}

// Check if sequential processing is enabled
export function isSequentialProcessing(): boolean {
  const jqhtml = getJqhtml();
  return jqhtml?.debug?.sequentialProcessing || false;
}

// Error handling with break on error
export function handleComponentError(component: Jqhtml_Component, phase: string, error: Error): void {
  const jqhtml = getJqhtml();
  
  console.error(`[JQHTML Error] ${component.constructor.name}#${component._cid} failed in ${phase}:`, error);
  
  if (jqhtml?.debug?.breakOnError) {
    debugger; // This will pause execution in dev tools
  }
}

// Additional debug suggestions that could be implemented:
// 
// 1. Component Inspector - Click on any component to see its data/args/state
// 2. Time Travel Debugging - Record state changes and replay them
// 3. Network Request Tracking - Log all AJAX calls made during load()
// 4. Memory Leak Detection - Track component creation/destruction
// 5. Template Compilation Debugging - Show compiled template functions
// 6. Event Flow Visualization - Show event bubbling through components
// 7. Dependency Graph - Show which components depend on which data
// 8. Hot Reload Support - Reload components without losing state
// 9. Performance Budgets - Warn when components exceed size/time limits
// 10. Accessibility Auditing - Check for missing ARIA attributes