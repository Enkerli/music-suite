/**
 * Exquis Grid Geometry Module
 * Handles the hex grid layout, pad positions, and MIDI mapping
 *
 * Layout (Portrait mode):
 * - 11 rows total (rows 0-10, bottom to top)
 * - Even rows (0,2,4,6,8,10) have 6 pads
 * - Odd rows (1,3,5,7,9) have 5 pads
 * - Rows are staggered: odd rows offset by half a pad width
 * - Intervals: Northwest diagonal = minor 3rd up, Northeast diagonal = major 3rd up
 */

export const ROW_COUNT = 11;

/**
 * Get the number of pads in a row
 * @param {number} row - Row index (0-10)
 * @returns {number} Number of pads (5 or 6)
 */
export function getRowLength(row) {
  return (row % 2 === 0) ? 6 : 5;
}

/**
 * Row start pad indexes for INTERVALS mode (musical thirds layout)
 * Pattern: 0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35
 * Increments alternate: +4, +3, +4, +3, ... (major third, minor third)
 *
 * This reflects the musical layout where rows are separated by thirds:
 * - From row N (even) to row N+1 (odd): +4 semitones (major third)
 * - From row N (odd) to row N+1 (even): +3 semitones (minor third)
 *
 * Note: Pads repeat across rows because the grid is based on musical intervals,
 * not sequential pad numbering. Row lengths (6/5) describe physical layout only.
 */
export const ROW_START_INTERVALS = (() => {
  const starts = [0];
  for (let r = 1; r < ROW_COUNT; r++) {
    const prev = starts[r - 1];
    // Odd row indices: +4 (major third), Even row indices: +3 (minor third)
    starts.push(prev + (r % 2 === 1 ? 4 : 3));
  }
  return starts; // [0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35]
})();

/**
 * Row start pad indexes for CHROMATIC mode (sequential layout)
 * Pattern: 0, 6, 11, 17, 22, 28, 33, 39, 44, 50, 55
 * Increments: +6, +5, +6, +5, ... (alternating by row length)
 *
 * This is the sequential pad numbering where each pad has unique MIDI note:
 * - Row 0 (6 pads): 0-5
 * - Row 1 (5 pads): 6-10
 * - Row 2 (6 pads): 11-16
 * - etc.
 *
 * Used for handprint capture to match physical Exquis in chromatic mode.
 */
export const ROW_START_CHROMATIC = (() => {
  const starts = [0];
  for (let r = 1; r < ROW_COUNT; r++) {
    const prevRowLength = getRowLength(r - 1);
    starts.push(starts[r - 1] + prevRowLength);
  }
  return starts; // [0, 6, 11, 17, 22, 28, 33, 39, 44, 50, 55]
})();

/**
 * Current grid mode: 'intervals' or 'chromatic'
 */
let currentGridMode = 'intervals';

/**
 * Get current ROW_START based on grid mode
 */
function getRowStart() {
  return currentGridMode === 'chromatic' ? ROW_START_CHROMATIC : ROW_START_INTERVALS;
}

/**
 * Set grid mode
 * @param {string} mode - 'intervals' or 'chromatic'
 */
export function setGridMode(mode) {
  if (mode !== 'intervals' && mode !== 'chromatic') {
    throw new Error(`Invalid grid mode: ${mode}. Must be 'intervals' or 'chromatic'.`);
  }
  currentGridMode = mode;
}

/**
 * Get current grid mode
 * @returns {string} Current mode ('intervals' or 'chromatic')
 */
export function getGridMode() {
  return currentGridMode;
}

// Export ROW_START for backward compatibility (uses current mode)
export const ROW_START = new Proxy({}, {
  get(target, prop) {
    const rowStart = getRowStart();
    if (typeof prop === 'symbol') return rowStart[prop];
    if (prop === 'length') return rowStart.length;
    const index = parseInt(prop);
    if (!isNaN(index)) return rowStart[index];
    return rowStart[prop];
  }
});

/**
 * Get the global pad index for a given row and column
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-5)
 * @returns {number} Global pad index
 */
export function getPadIndex(row, col) {
  return ROW_START[row] + col;
}

/**
 * Get row and column from global pad index
 * @param {number} padIndex - Global pad index
 * @returns {{row: number, col: number}} Row and column
 *
 * Note: With the musical interval layout, pad indices can overlap between rows.
 * We search from bottom to top to find the first valid row.
 */
export function getRowCol(padIndex) {
  // Search from bottom row (0) upward to handle overlapping indices
  for (let row = 0; row < ROW_COUNT; row++) {
    if (padIndex >= ROW_START[row]) {
      const col = padIndex - ROW_START[row];
      if (col >= 0 && col < getRowLength(row)) {
        return { row, col };
      }
    }
  }
  throw new Error(`Invalid pad index: ${padIndex}`);
}

/**
 * Get MIDI note for a given row, column, and base MIDI
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-5)
 * @param {number} baseMidi - Base MIDI note (default 48 = C3)
 * @returns {number} MIDI note number
 */
export function getMidiNote(row, col, baseMidi = 48) {
  return baseMidi + getPadIndex(row, col);
}

/**
 * Hex geometry for rendering
 */
export const HEX_GEOMETRY = {
  portrait: {
    size: 22,      // Hex radius
    w: 38,         // Horizontal spacing
    h: 33          // Vertical spacing
  }
};

/**
 * Calculate center position for a hex pad in portrait orientation
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-5)
 * @param {number} padding - Padding around the grid (default 48)
 * @returns {{x: number, y: number}} Center coordinates
 */
export function getCellCenter(row, col, padding = 48) {
  const g = HEX_GEOMETRY.portrait;
  const x = col * g.w + (row % 2 ? g.w / 2 : 0) + padding;
  // Row 0 is at bottom, row 10 is at top
  const y = (ROW_COUNT - 1 - row) * g.h + padding;
  return { x, y };
}

/**
 * Generate SVG points for a pointy-top hexagon
 * @param {number} cx - Center x coordinate
 * @param {number} cy - Center y coordinate
 * @param {number} size - Hexagon radius
 * @returns {string} SVG points string
 */
export function getHexPoints(cx, cy, size) {
  const angles = [
    [0, -size],                    // Top
    [+0.866 * size, -0.5 * size],  // Top-right
    [+0.866 * size, +0.5 * size],  // Bottom-right
    [0, +size],                    // Bottom
    [-0.866 * size, +0.5 * size],  // Bottom-left
    [-0.866 * size, -0.5 * size]   // Top-left
  ];
  return angles.map(([dx, dy]) => `${cx + dx},${cy + dy}`).join(' ');
}

/**
 * Calculate viewBox dimensions for the grid
 * @param {string} orientation - 'portrait' or 'landscape'
 * @returns {{width: number, height: number, viewBox: string}} ViewBox dimensions
 */
export function getViewBox(orientation = 'portrait') {
  const g = HEX_GEOMETRY.portrait;
  const vbW_p = (6 * g.w + 120);
  const vbH_p = (ROW_COUNT * g.h + 120);

  if (orientation === 'portrait') {
    return {
      width: vbW_p,
      height: vbH_p,
      viewBox: `0 0 ${vbW_p} ${vbH_p}`
    };
  } else {
    // Landscape: swap width and height
    return {
      width: vbH_p,
      height: vbW_p,
      viewBox: `0 0 ${vbH_p} ${vbW_p}`
    };
  }
}

/**
 * Get interval direction vectors on the Exquis grid
 * Returns the row/col offsets for common musical intervals
 */
export const INTERVAL_VECTORS = {
  minorThirdUp: { row: 1, col: 0 },      // Northwest diagonal
  majorThirdUp: { row: 1, col: 1 },      // Northeast diagonal
  perfectFifth: { row: 2, col: 0 },      // Two rows up (even rows align)
  perfectFourth: { row: 2, col: 1 },     // Two rows up, one right
  octave: { row: 4, col: 0 }             // Four rows up (alternates columns)
};

/**
 * Get neighboring pads for a given position
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {Array<{row: number, col: number}>} Array of valid neighbors
 */
export function getNeighbors(row, col) {
  const neighbors = [];
  const isEvenRow = row % 2 === 0;

  // Six potential neighbors for a hex grid
  const offsets = isEvenRow
    ? [
      { dr: 0, dc: -1 },  // Left
      { dr: 0, dc: 1 },   // Right
      { dr: 1, dc: -1 },  // Top-left (odd row has offset)
      { dr: 1, dc: 0 },   // Top-right
      { dr: -1, dc: -1 }, // Bottom-left
      { dr: -1, dc: 0 }   // Bottom-right
    ]
    : [
      { dr: 0, dc: -1 },  // Left
      { dr: 0, dc: 1 },   // Right
      { dr: 1, dc: 0 },   // Top-left
      { dr: 1, dc: 1 },   // Top-right (odd row has offset)
      { dr: -1, dc: 0 },  // Bottom-left
      { dr: -1, dc: 1 }   // Bottom-right
    ];

  for (const { dr, dc } of offsets) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < ROW_COUNT && newCol >= 0 && newCol < getRowLength(newRow)) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }

  return neighbors;
}

/**
 * Calculate grid distance between two pads (Manhattan distance on hex grid)
 * @param {number} row1 - First pad row
 * @param {number} col1 - First pad column
 * @param {number} row2 - Second pad row
 * @param {number} col2 - Second pad column
 * @returns {number} Grid distance
 */
export function getGridDistance(row1, col1, row2, col2) {
  // Convert to cube coordinates for hex grid distance
  // This is a simplified approximation
  const { x: x1, y: y1 } = getCellCenter(row1, col1);
  const { x: x2, y: y2 } = getCellCenter(row2, col2);

  // Euclidean distance divided by hex width as approximation
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / HEX_GEOMETRY.portrait.w;
}
