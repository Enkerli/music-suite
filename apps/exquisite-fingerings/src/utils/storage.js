/**
 * LocalStorage Utility
 * Handles persistence of fingering patterns and app settings
 */

const STORAGE_KEYS = {
  PATTERNS: 'exquisPatterns',
  SETTINGS: 'exquisSettings',
  RECENT_PATTERNS: 'exquisRecentPatterns'
};

/**
 * Save fingering pattern to localStorage
 * @param {string} name - Pattern name
 * @param {object} patternData - Pattern data
 */
export function savePattern(name, patternData) {
  const patterns = getAllPatterns();
  patterns[name] = {
    ...patternData,
    savedAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));

  // Update recent patterns
  addToRecent(name);
}

/**
 * Load fingering pattern from localStorage
 * @param {string} name - Pattern name
 * @returns {object|null} Pattern data or null if not found
 */
export function loadPattern(name) {
  const patterns = getAllPatterns();
  return patterns[name] || null;
}

/**
 * Delete fingering pattern
 * @param {string} name - Pattern name
 * @returns {boolean} Success status
 */
export function deletePattern(name) {
  const patterns = getAllPatterns();
  if (patterns[name]) {
    delete patterns[name];
    localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));

    // Remove from recent
    removeFromRecent(name);
    return true;
  }
  return false;
}

/**
 * Get all saved patterns
 * @returns {object} Object with pattern names as keys
 */
export function getAllPatterns() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PATTERNS);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('Error loading patterns:', err);
    return {};
  }
}

/**
 * Get pattern names sorted alphabetically
 * @returns {Array<string>} Array of pattern names
 */
export function getPatternNames() {
  return Object.keys(getAllPatterns()).sort();
}

/**
 * Export pattern as JSON file
 * @param {string} name - Pattern name
 * @returns {string} JSON string
 */
export function exportPattern(name) {
  const pattern = loadPattern(name);
  if (!pattern) throw new Error(`Pattern not found: ${name}`);

  return JSON.stringify({
    version: '1.0',
    name,
    pattern
  }, null, 2);
}

/**
 * Import pattern from JSON
 * @param {string} jsonString - JSON string
 * @returns {string} Imported pattern name
 */
export function importPattern(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.name || !data.pattern) {
      throw new Error('Invalid pattern format');
    }

    // Ensure unique name
    let name = data.name;
    let counter = 1;
    while (loadPattern(name)) {
      name = `${data.name} (${counter++})`;
    }

    savePattern(name, data.pattern);
    return name;
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`);
  }
}

/**
 * Save app settings
 * @param {object} settings - Settings object
 */
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

/**
 * Load app settings
 * @returns {object} Settings object
 */
export function loadSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : getDefaultSettings();
  } catch (err) {
    console.error('Error loading settings:', err);
    return getDefaultSettings();
  }
}

/**
 * Get default settings
 * @returns {object} Default settings
 */
function getDefaultSettings() {
  return {
    orientation: 'portrait',
    labelMode: 'pc',
    baseMidi: 48,
    midiHoldDuration: 1000,
    midiOctaveRange: 0,
    handSize: 'medium',
    theme: 'light'
  };
}

/**
 * Add pattern to recent list
 * @param {string} name - Pattern name
 */
function addToRecent(name) {
  let recent = getRecentPatterns();
  // Remove if already in list
  recent = recent.filter(n => n !== name);
  // Add to front
  recent.unshift(name);
  // Keep only last 10
  recent = recent.slice(0, 10);
  localStorage.setItem(STORAGE_KEYS.RECENT_PATTERNS, JSON.stringify(recent));
}

/**
 * Remove pattern from recent list
 * @param {string} name - Pattern name
 */
function removeFromRecent(name) {
  let recent = getRecentPatterns();
  recent = recent.filter(n => n !== name);
  localStorage.setItem(STORAGE_KEYS.RECENT_PATTERNS, JSON.stringify(recent));
}

/**
 * Get recent patterns
 * @returns {Array<string>} Array of recent pattern names
 */
export function getRecentPatterns() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT_PATTERNS);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Clear all stored data
 */
export function clearAll() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
