// Type definitions for JQHTML v2

// Extend global Window interface for JQHTML
declare global {
  interface Window {
    JQHTML_DEBUG?: {
      log: (componentName: string, phase: string, message: string, data?: any) => void;
      updateTree: () => void;
    };
  }
}