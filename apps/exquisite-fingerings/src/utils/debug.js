/**
 * Debug Configuration
 * Controls verbose logging throughout the application
 */

// Set to true to enable verbose diagnostic logging
// Useful for troubleshooting MIDI, grid rendering, and Developer Mode issues
export const DEBUG = {
  // Master switch - set to false to disable all debug logging
  enabled: false,

  // Individual module flags (only apply when enabled = true)
  app: true,           // App lifecycle and initialization
  midi: true,          // MIDI messages, SysEx, Developer Mode
  grid: true,          // Grid rendering
  handprint: true,     // Handprint capture workflow

  // Helper to check if a module should log
  shouldLog(module) {
    return this.enabled && this[module];
  }
};

/**
 * Conditional console.log wrapper
 * Only logs if debug mode is enabled for the specified module
 */
export function debugLog(module, ...args) {
  if (DEBUG.shouldLog(module)) {
    console.log(...args);
  }
}

/**
 * Always log errors and warnings
 */
export function errorLog(...args) {
  console.error(...args);
}

export function warnLog(...args) {
  console.warn(...args);
}
