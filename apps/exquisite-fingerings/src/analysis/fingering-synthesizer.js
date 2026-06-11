/**
 * Fingering Synthesizer Module
 * Generates new fingering suggestions based on learned patterns from handprints
 */

import { getPadIndex, getGridDistance } from '../core/grid.js';
import { midiToPitchClass } from '../core/music.js';
import { extractPatterns, suggestFingerForPosition, calculatePatternSimilarity } from './pattern-extractor.js';

/**
 * Generate all possible pad combinations for target pitch classes
 * @param {Array<number>} targetPitchClasses - Target pitch classes (e.g., [0, 4, 7])
 * @param {number} baseMidi - Base MIDI note
 * @param {number} maxRow - Maximum row to search (default 5 for comfortable reach)
 * @returns {Array<Array<Object>>} Array of pad combinations
 */
function findPadCombinations(targetPitchClasses, baseMidi = 48, maxRow = 5) {
  // Find all pads matching each pitch class
  const padsByPC = new Map();

  for (const pc of targetPitchClasses) {
    padsByPC.set(pc, []);
  }

  // Search grid for matching pads (limited to comfortable reach)
  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col < (row % 2 === 0 ? 6 : 5); col++) {
      const padIndex = getPadIndex(row, col);
      const midiNote = baseMidi + padIndex;
      const pc = midiToPitchClass(midiNote);

      if (padsByPC.has(pc)) {
        padsByPC.get(pc).push({ row, col, padIndex, midiNote, pc });
      }
    }
  }

  // Generate all combinations (one pad per pitch class)
  const combinations = [];
  const pcKeys = Array.from(padsByPC.keys());

  function generateCombos(index, current) {
    if (index === pcKeys.length) {
      combinations.push([...current]);
      return;
    }

    const pc = pcKeys[index];
    const pads = padsByPC.get(pc);

    // Limit pads per pitch class to avoid combinatorial explosion
    const limitedPads = pads.slice(0, 3); // Max 3 pads per pitch class

    for (const pad of limitedPads) {
      current.push(pad);
      generateCombos(index + 1, current);
      current.pop();
    }
  }

  generateCombos(0, []);

  return combinations;
}

/**
 * Assign fingers to a pad combination based on anatomical layout
 * @param {Array<Object>} pads - Array of pads with {row, col}
 * @param {string} hand - 'left' or 'right'
 * @param {Object} patterns - Pattern statistics (optional)
 * @returns {Array<Object>} Pads with finger assignments
 */
function assignFingers(pads, hand, patterns = null) {
  if (pads.length === 0) return [];

  // Can't assign more than 5 fingers
  if (pads.length > 5) {
    pads = pads.slice(0, 5);
  }

  // Sort pads by position for consistent finger assignment
  // Right hand: thumb (1) at lower-left, extending up-right
  // Left hand: thumb (1) at lower-right, extending up-left
  const sortedPads = [...pads].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row; // Lower rows first
    return hand === 'right' ? a.col - b.col : b.col - a.col;
  });

  // Track which fingers have been assigned
  const usedFingers = new Set();
  const assignments = [];

  // Assign fingers sequentially, ensuring no duplicates
  for (let index = 0; index < sortedPads.length; index++) {
    const pad = sortedPads[index];
    let finger = null;

    // Try to use pattern-based suggestion if available
    if (patterns) {
      const suggestedFinger = suggestFingerForPosition(pad.row, pad.col, patterns);
      // Only use suggestion if finger hasn't been used yet
      if (suggestedFinger && !usedFingers.has(suggestedFinger)) {
        finger = suggestedFinger;
      }
    }

    // Fall back to sequential assignment, skipping already-used fingers
    if (!finger) {
      for (let f = 1; f <= 5; f++) {
        if (!usedFingers.has(f)) {
          finger = f;
          break;
        }
      }
    }

    // Mark finger as used
    if (finger) {
      usedFingers.add(finger);
      assignments.push({
        ...pad,
        finger,
        hand
      });
    }
  }

  return assignments;
}

/**
 * Score a fingering based on ergonomics and pattern similarity
 * @param {Object} fingering - Fingering object with positions
 * @param {Object} patterns - Pattern statistics
 * @returns {number} Score (0-100)
 */
function scoreFingering(fingering, patterns) {
  let score = 50; // Base score

  // Pattern similarity (if patterns available)
  if (patterns) {
    const patternScore = calculatePatternSimilarity(fingering, patterns);
    score = (score + patternScore) / 2;
  }

  // Ergonomic factors
  const span = calculateSpan(fingering.positions);

  // Prefer compact spans (1.5 - 3.0 grid units)
  if (span < 1.5) {
    score += 10; // Very compact
  } else if (span <= 3.0) {
    score += 5;  // Comfortable
  } else if (span > 4.0) {
    score -= 20; // Too stretched
  }

  // Prefer lower rows (easier to reach)
  const avgRow = fingering.positions.reduce((sum, p) => sum + p.row, 0) / fingering.positions.length;
  score += Math.max(0, 10 - avgRow * 2);

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate span of a fingering
 * @param {Array<Object>} positions - Array of {row, col}
 * @returns {number} Max distance
 */
function calculateSpan(positions) {
  let maxSpan = 0;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const distance = getGridDistance(
        positions[i].row, positions[i].col,
        positions[j].row, positions[j].col
      );
      maxSpan = Math.max(maxSpan, distance);
    }
  }
  return maxSpan;
}

/**
 * Synthesize fingering suggestions for target chord
 * @param {Array<number>} targetPitchClasses - Target pitch classes
 * @param {Array<Object>} handprints - Captured handprints for pattern learning
 * @param {number} baseMidi - Base MIDI note
 * @param {string} hand - 'left' or 'right'
 * @param {number} maxSuggestions - Maximum suggestions to return (default 5)
 * @returns {Array<Object>} Array of fingering suggestions
 */
export function synthesizeFingerings(targetPitchClasses, handprints, baseMidi = 48, hand = 'right', maxSuggestions = 5) {
  // Extract patterns from handprints
  const patterns = extractPatterns(handprints, hand);

  // Find all possible pad combinations
  const combinations = findPadCombinations(targetPitchClasses, baseMidi);

  if (combinations.length === 0) {
    return [];
  }

  // Generate fingering for each combination
  const fingerings = combinations.map(combo => {
    const positions = assignFingers(combo, hand, patterns);

    const fingering = {
      hand,
      baseMidi,
      positions,
      targetPitchClasses,
      score: 0
    };

    // Score this fingering
    fingering.score = scoreFingering(fingering, patterns);

    return fingering;
  });

  // Sort by score descending
  fingerings.sort((a, b) => b.score - a.score);

  // Return top N suggestions
  return fingerings.slice(0, maxSuggestions);
}
