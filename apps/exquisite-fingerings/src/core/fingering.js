/**
 * Fingering System Module
 * Handles fingering assignment, storage, and ergonomic analysis
 */

import { getGridDistance, getNeighbors, getRowLength, getPadIndex } from './grid.js';

/**
 * Fingering class representing a complete fingering pattern
 */
export class FingeringPattern {
  constructor(name = 'Untitled') {
    this.name = name;
    this.fingerings = new Map(); // key: 'row,col' -> {hand: 'left'|'right', finger: 1-5}
    this.metadata = {
      key: null,
      setType: null,
      baseMidi: 48,
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };
  }

  /**
   * Set fingering for a specific pad
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @param {string} hand - 'left' or 'right'
   * @param {number} finger - Finger number (1-5: thumb to pinky)
   */
  setFingering(row, col, hand, finger) {
    const key = `${row},${col}`;
    this.fingerings.set(key, { hand, finger });
    this.metadata.modifiedAt = Date.now();
  }

  /**
   * Get fingering for a specific pad
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {{hand: string, finger: number}|null} Fingering or null
   */
  getFingering(row, col) {
    const key = `${row},${col}`;
    return this.fingerings.get(key) || null;
  }

  /**
   * Remove fingering for a specific pad
   * @param {number} row - Row index
   * @param {number} col - Column index
   */
  removeFingering(row, col) {
    const key = `${row},${col}`;
    this.fingerings.delete(key);
    this.metadata.modifiedAt = Date.now();
  }

  /**
   * Clear all fingerings
   */
  clearAll() {
    this.fingerings.clear();
    this.metadata.modifiedAt = Date.now();
  }

  /**
   * Get all pads for a specific hand
   * @param {string} hand - 'left' or 'right'
   * @returns {Array<{row: number, col: number, finger: number}>} Array of pads
   */
  getPadsForHand(hand) {
    const pads = [];
    for (const [key, value] of this.fingerings) {
      if (value.hand === hand) {
        const [row, col] = key.split(',').map(Number);
        pads.push({ row, col, finger: value.finger });
      }
    }
    return pads;
  }

  /**
   * Get all pads for a specific finger
   * @param {number} finger - Finger number (1-5)
   * @param {string} hand - Optional: filter by hand
   * @returns {Array<{row: number, col: number, hand: string}>} Array of pads
   */
  getPadsForFinger(finger, hand = null) {
    const pads = [];
    for (const [key, value] of this.fingerings) {
      if (value.finger === finger && (!hand || value.hand === hand)) {
        const [row, col] = key.split(',').map(Number);
        pads.push({ row, col, hand: value.hand });
      }
    }
    return pads;
  }

  /**
   * Export to JSON
   * @returns {object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      fingerings: Array.from(this.fingerings.entries()),
      metadata: this.metadata
    };
  }

  /**
   * Import from JSON
   * @param {object} json - JSON object
   * @returns {FingeringPattern} New FingeringPattern instance
   */
  static fromJSON(json) {
    const pattern = new FingeringPattern(json.name);
    pattern.fingerings = new Map(json.fingerings);
    pattern.metadata = json.metadata;
    return pattern;
  }
}

/**
 * Ergonomic analyzer for fingerings
 * Provides heuristics for comfortable hand positions and finger assignments
 */
export class ErgoAnalyzer {
  constructor() {
    // Finger strength/comfort weights (1 = strongest/most comfortable)
    this.fingerWeights = {
      1: 0.8,  // Thumb - strong but limited range
      2: 1.0,  // Index - strongest and most flexible
      3: 0.9,  // Middle - strong
      4: 0.6,  // Ring - weaker, less independent
      5: 0.4   // Pinky - weakest, most limited
    };

    // Hand size profiles (in grid units)
    this.handSizes = {
      small: { maxStretch: 2.5, comfortableStretch: 1.5 },
      medium: { maxStretch: 3.0, comfortableStretch: 2.0 },
      large: { maxStretch: 3.5, comfortableStretch: 2.5 }
    };

    this.currentHandSize = 'medium';
  }

  /**
   * Set hand size profile
   * @param {string} size - 'small', 'medium', 'large', or 'custom'
   */
  setHandSize(size) {
    if (size === 'custom') {
      this.currentHandSize = 'custom';
    } else if (this.handSizes[size]) {
      this.currentHandSize = size;
    }
  }

  /**
   * Set custom handprint measurements
   * @param {object} measurements - Object with finger-pair distance measurements (e.g., {'1-2': 1.5, '2-3': 1.2, ...})
   */
  setCustomHandprint(measurements) {
    // Calculate comfortable and max stretch from measurements
    const distances = Object.values(measurements);
    const maxDistance = Math.max(...distances);
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    this.handSizes.custom = {
      maxStretch: maxDistance * 1.1, // 10% beyond measured max
      comfortableStretch: avgDistance,
      measurements // Store full measurements for future use
    };

    this.currentHandSize = 'custom';
  }

  /**
   * Calculate ergonomic score for a fingering pattern
   * Higher score = more ergonomic
   * @param {FingeringPattern} pattern - Fingering pattern to analyze
   * @returns {object} Score breakdown
   */
  analyzePattern(pattern) {
    let totalScore = 100;
    const issues = [];

    // Analyze each hand separately
    ['left', 'right'].forEach(hand => {
      const pads = pattern.getPadsForHand(hand);
      if (pads.length === 0) return;

      // Check finger span
      const spanPenalty = this._analyzeSpan(pads, hand, issues);
      totalScore -= spanPenalty;

      // Check finger strength usage
      const strengthBonus = this._analyzeFingerStrength(pads, issues);
      totalScore += strengthBonus;

      // Check for finger crossings (bad ergonomics)
      const crossingPenalty = this._analyzeFingerCrossings(pads, hand, issues);
      totalScore -= crossingPenalty;
    });

    return {
      score: Math.max(0, Math.min(100, totalScore)),
      issues,
      recommendation: this._getRecommendation(totalScore)
    };
  }

  /**
   * Suggest fingerings for a set of pads
   * Deduplicates by pitch class and uses anatomically-aware finger assignment
   * @param {Array<{row: number, col: number}>} pads - Pads to assign fingerings
   * @param {string} hand - 'left' or 'right'
   * @param {number} baseMidi - Base MIDI note (default 48)
   * @returns {Array<{row: number, col: number, finger: number, hand: string, score: number}>} Suggested fingerings
   */
  suggestFingerings(pads, hand, baseMidi = 48) {
    if (pads.length === 0) return [];

    // Deduplicate by pitch class - keep only the lowest, leftmost pad for each PC
    const pcMap = new Map();

    pads.forEach(pad => {
      // Calculate MIDI note for this pad
      const padIndex = getPadIndex(pad.row, pad.col); // Use correct grid calculation
      const midiNote = baseMidi + padIndex;
      const pc = midiNote % 12;

      // Keep the pad with lowest row, then lowest col for each pitch class
      if (!pcMap.has(pc)) {
        pcMap.set(pc, { ...pad, pc, midiNote });
      } else {
        const existing = pcMap.get(pc);
        if (pad.row < existing.row || (pad.row === existing.row && pad.col < existing.col)) {
          pcMap.set(pc, { ...pad, pc, midiNote });
        }
      }
    });

    const uniquePads = Array.from(pcMap.values());

    // Limit to 5 pads per hand (one per finger)
    let selectedPads = uniquePads;
    if (uniquePads.length > 5) {
      // Select 5 most accessible pads (lowest rows and leftmost columns)
      selectedPads = [...uniquePads]
        .sort((a, b) => {
          const scoreA = a.row * 2 + a.col; // Prefer lower rows and leftmost cols
          const scoreB = b.row * 2 + b.col;
          return scoreA - scoreB;
        })
        .slice(0, 5);
    }

    // Assign fingers based on hand geometry
    return this._assignFingersAnatomically(selectedPads, hand);
  }

  /**
   * Assign fingers based on anatomical hand geometry
   * Right hand: thumb (1) at lower-left, fingers extend up and right
   * Left hand: thumb (1) at lower-right, fingers extend up and left
   * @private
   */
  _assignFingersAnatomically(pads, hand) {
    if (pads.length === 0) return [];

    // Find anchor pad (thumb position) - lowest row, then leftmost (right hand) or rightmost (left hand)
    const sortedForAnchor = [...pads].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row; // Prefer lower rows
      // For right hand prefer left, for left hand prefer right
      return hand === 'right' ? a.col - b.col : b.col - a.col;
    });

    const anchor = sortedForAnchor[0];

    // Create assignments
    const assignments = [];

    // Assign thumb to anchor
    assignments.push({
      row: anchor.row,
      col: anchor.col,
      hand,
      finger: 1,
      score: 1.0
    });

    // Remove anchor from remaining pads
    const remainingPads = pads.filter(p => !(p.row === anchor.row && p.col === anchor.col));

    if (remainingPads.length === 0) return assignments;

    // Sort remaining pads by distance and direction from anchor
    // For right hand: prefer pads that are up and to the right
    // For left hand: prefer pads that are up and to the left
    const sortedRemaining = remainingPads.map(pad => {
      const rowDiff = pad.row - anchor.row;
      const colDiff = pad.col - anchor.col;
      const distance = Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);

      // Calculate a "naturalness" score based on hand geometry
      // Prefer upward and outward movement (right for right hand, left for left hand)
      const directionScore = hand === 'right'
        ? rowDiff + colDiff  // Prefer up and right
        : rowDiff - colDiff; // Prefer up and left

      return {
        pad,
        distance,
        directionScore,
        // Combined score: prefer moderate distance with good direction
        score: directionScore * 2 - distance * 0.5
      };
    })
    .sort((a, b) => b.score - a.score); // Higher score is better

    // Assign fingers 2-5 to remaining pads
    const fingers = [2, 3, 4, 5];
    sortedRemaining.slice(0, 4).forEach((item, index) => {
      assignments.push({
        row: item.pad.row,
        col: item.pad.col,
        hand,
        finger: fingers[index],
        score: 0.8
      });
    });

    return assignments;
  }

  /**
   * Analyze finger span
   * Only checks adjacent fingers in sequence (1→2, 2→3, 3→4, 4→5)
   * @private
   */
  _analyzeSpan(pads, hand, issues) {
    const handSize = this.handSizes[this.currentHandSize];
    let penalty = 0;

    // Sort pads by finger number to check adjacent fingers only
    const sortedPads = [...pads].sort((a, b) => a.finger - b.finger);

    // Check only adjacent fingers in sequence
    for (let i = 0; i < sortedPads.length - 1; i++) {
      const pad1 = sortedPads[i];
      const pad2 = sortedPads[i + 1];

      // Skip if same finger number (shouldn't happen but be safe)
      if (pad1.finger === pad2.finger) continue;

      const dist = getGridDistance(
        pad1.row, pad1.col,
        pad2.row, pad2.col
      );

      if (dist > handSize.maxStretch) {
        penalty += 20;
        issues.push({
          type: 'excessive_stretch',
          hand,
          fingers: [pad1.finger, pad2.finger],
          distance: dist
        });
      } else if (dist > handSize.comfortableStretch) {
        penalty += 5;
        issues.push({
          type: 'uncomfortable_stretch',
          hand,
          fingers: [pad1.finger, pad2.finger],
          distance: dist
        });
      }
    }

    return penalty;
  }

  /**
   * Analyze finger strength usage
   * @private
   */
  _analyzeFingerStrength(pads, issues) {
    let bonus = 0;

    // Reward using strong fingers (2, 3) for important notes
    pads.forEach(pad => {
      const weight = this.fingerWeights[pad.finger];
      if (weight >= 0.9) {
        bonus += 2;
      } else if (weight <= 0.5) {
        // Slight penalty for weak fingers
        bonus -= 1;
      }
    });

    return bonus;
  }

  /**
   * Analyze finger crossings
   * Checks if fingers are in logical order relative to pad positions
   * @private
   */
  _analyzeFingerCrossings(pads, hand, issues) {
    let penalty = 0;
    const seenCrossings = new Set();

    // Sort by finger number to check sequence
    const sortedByFinger = [...pads].sort((a, b) => a.finger - b.finger);

    // Check only adjacent fingers to avoid duplicates
    for (let i = 0; i < sortedByFinger.length - 1; i++) {
      const pad1 = sortedByFinger[i];
      const pad2 = sortedByFinger[i + 1];

      // For simplicity, check if lower finger number is on higher row
      // (This is a basic heuristic - real crossings are more complex)
      const crossingKey = `${pad1.finger}-${pad2.finger}`;
      if (seenCrossings.has(crossingKey)) continue;

      if (pad1.row > pad2.row) {
        penalty += 5;  // Reduced penalty
        seenCrossings.add(crossingKey);
        issues.push({
          type: 'finger_crossing',
          hand,
          fingers: [pad1.finger, pad2.finger]
        });
      }
    }

    return penalty;
  }

  /**
   * Get recommendation text based on score
   * @private
   */
  _getRecommendation(score) {
    if (score >= 90) return 'Excellent ergonomics!';
    if (score >= 75) return 'Good fingering, comfortable to play';
    if (score >= 60) return 'Acceptable, but could be improved';
    if (score >= 40) return 'Uncomfortable, consider revising';
    return 'Poor ergonomics, recommend different fingering';
  }

  /**
   * Suggest fingering when more than 5 notes (two hands needed)
   * @private
   */
  _suggestMultiHandFingering(pads) {
    // Simple strategy: split roughly in half
    const mid = Math.floor(pads.length / 2);
    const leftPads = pads.slice(0, mid);
    const rightPads = pads.slice(mid);

    return [
      ...this.suggestFingerings(leftPads, 'left'),
      ...this.suggestFingerings(rightPads, 'right')
    ];
  }
}

// Export singleton instance
export const ergoAnalyzer = new ErgoAnalyzer();
