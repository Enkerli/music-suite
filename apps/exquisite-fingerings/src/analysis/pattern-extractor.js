/**
 * Pattern Extractor Module
 * Analyzes handprints to extract geometric patterns for fingering synthesis
 */

import { getPadIndex } from '../core/grid.js';
import { midiToPitchClass } from '../core/music.js';

/**
 * Extract geometric patterns from a collection of handprints
 * @param {Array<Object>} handprints - Array of captured handprints
 * @param {string} hand - 'left' or 'right' - filter by hand
 * @returns {Object} Pattern statistics
 */
export function extractPatterns(handprints, hand = null) {
  // Filter by hand if specified
  const filteredHandprints = hand
    ? handprints.filter(hp => hp.hand === hand)
    : handprints;

  if (filteredHandprints.length === 0) {
    return null;
  }

  // Initialize pattern accumulator
  const patterns = {
    hand: hand,
    fingerDistances: {}, // e.g., '1-2': [1.2, 1.5, 1.3, ...]
    spanDistances: [],   // max distance in each handprint
    fingerAssignments: {}, // e.g., 'r0c1': {1: 5, 2: 3, ...} - count of each finger
    chordShapes: [],     // geometric templates
    avgComfort: 0
  };

  let totalComfort = 0;

  // Analyze each handprint
  for (const handprint of filteredHandprints) {
    totalComfort += handprint.comfortRating || 50;

    // Extract finger pair distances from measurements
    if (handprint.measurements) {
      for (const [pair, distance] of Object.entries(handprint.measurements)) {
        if (!patterns.fingerDistances[pair]) {
          patterns.fingerDistances[pair] = [];
        }
        patterns.fingerDistances[pair].push(distance);
      }
    }

    // Calculate max span
    const positions = handprint.positions;
    let maxSpan = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].col - positions[i].col;
        const dy = positions[j].row - positions[i].row;
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxSpan = Math.max(maxSpan, distance);
      }
    }
    patterns.spanDistances.push(maxSpan);

    // Record finger assignments by position
    for (const pos of positions) {
      const key = `r${pos.row}c${pos.col}`;
      if (!patterns.fingerAssignments[key]) {
        patterns.fingerAssignments[key] = {};
      }
      const finger = pos.finger;
      patterns.fingerAssignments[key][finger] = (patterns.fingerAssignments[key][finger] || 0) + 1;
    }

    // Extract chord shape (relative geometry)
    const shape = extractChordShape(handprint);
    if (shape) {
      patterns.chordShapes.push(shape);
    }
  }

  // Calculate averages
  patterns.avgComfort = totalComfort / filteredHandprints.length;

  // Calculate average and std dev for finger distances
  for (const [pair, distances] of Object.entries(patterns.fingerDistances)) {
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
    patterns.fingerDistances[pair] = {
      avg,
      stdDev: Math.sqrt(variance),
      samples: distances.length
    };
  }

  // Calculate average span
  const avgSpan = patterns.spanDistances.reduce((a, b) => a + b, 0) / patterns.spanDistances.length;
  const spanVariance = patterns.spanDistances.reduce((sum, s) => sum + Math.pow(s - avgSpan, 2), 0) / patterns.spanDistances.length;
  patterns.avgSpan = avgSpan;
  patterns.spanStdDev = Math.sqrt(spanVariance);

  return patterns;
}

/**
 * Extract chord shape (relative geometry) from a handprint
 * @param {Object} handprint - Handprint object
 * @returns {Object} Shape template
 */
function extractChordShape(handprint) {
  const positions = handprint.positions;
  if (positions.length < 3) return null;

  // Sort positions by finger
  const sorted = [...positions].sort((a, b) => a.finger - b.finger);

  // Use first position as anchor
  const anchor = sorted[0];

  // Calculate relative positions
  const relativePositions = sorted.map(pos => ({
    finger: pos.finger,
    rowOffset: pos.row - anchor.row,
    colOffset: pos.col - anchor.col,
    distance: Math.sqrt(
      Math.pow(pos.row - anchor.row, 2) +
      Math.pow(pos.col - anchor.col, 2)
    )
  }));

  return {
    numFingers: positions.length,
    fingers: sorted.map(p => p.finger),
    geometry: relativePositions,
    comfort: handprint.comfortRating || 50
  };
}

/**
 * Find best finger assignment for a position based on pattern history
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {Object} patterns - Pattern statistics from extractPatterns
 * @returns {number} Most common finger (1-5)
 */
export function suggestFingerForPosition(row, col, patterns) {
  const key = `r${row}c${col}`;
  const assignments = patterns.fingerAssignments[key];

  if (!assignments) return null;

  // Find finger with highest count
  let bestFinger = null;
  let maxCount = 0;
  for (const [finger, count] of Object.entries(assignments)) {
    if (count > maxCount) {
      maxCount = count;
      bestFinger = parseInt(finger);
    }
  }

  return bestFinger;
}

/**
 * Calculate similarity between a candidate fingering and learned patterns
 * @param {Object} candidateFingering - Fingering to evaluate
 * @param {Object} patterns - Pattern statistics
 * @returns {number} Similarity score (0-100)
 */
export function calculatePatternSimilarity(candidateFingering, patterns) {
  if (!patterns || patterns.chordShapes.length === 0) {
    return 50; // Neutral score if no patterns
  }

  let bestScore = 0;

  // Compare against each learned chord shape
  for (const shape of patterns.chordShapes) {
    let score = 0;

    // Finger count similarity
    if (candidateFingering.positions.length === shape.numFingers) {
      score += 20;
    }

    // Geometric similarity
    const candidateSpan = calculateSpan(candidateFingering.positions);
    const spanDiff = Math.abs(candidateSpan - patterns.avgSpan);
    const spanSimilarity = Math.max(0, 30 - spanDiff * 10);
    score += spanSimilarity;

    // Comfort rating from pattern
    score += shape.comfort / 2; // Max 50 points

    bestScore = Math.max(bestScore, score);
  }

  return Math.min(100, bestScore);
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
      const dx = positions[j].col - positions[i].col;
      const dy = positions[j].row - positions[i].row;
      const distance = Math.sqrt(dx * dx + dy * dy);
      maxSpan = Math.max(maxSpan, distance);
    }
  }
  return maxSpan;
}
