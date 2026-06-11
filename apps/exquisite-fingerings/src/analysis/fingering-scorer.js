/**
 * Fingering Scorer Module
 * Scores and ranks fingering suggestions based on comfort, geometry, and ergonomics
 */

import { calculateSpan, usesConsecutiveFingers } from './chord-matcher.js';

/**
 * Score a fingering based on multiple criteria
 * @param {Object} fingering - Fingering object with positions and comfort rating
 * @returns {Object} Fingering with updated scores
 */
export function scoreFingering(fingering) {
  const comfortScore = scoreComfort(fingering);
  const geometricScore = scoreGeometry(fingering);
  const ergonomicScore = scoreErgonomics(fingering);

  // Weighted average: 40% comfort, 30% geometry, 30% ergonomics
  const totalScore = (
    comfortScore * 0.4 +
    geometricScore * 0.3 +
    ergonomicScore * 0.3
  );

  return {
    ...fingering,
    score: Math.round(totalScore),
    comfortScore: Math.round(comfortScore),
    geometricScore: Math.round(geometricScore),
    ergonomicScore: Math.round(ergonomicScore)
  };
}

/**
 * Score based on handprint comfort rating
 * @param {Object} fingering - Fingering object
 * @returns {number} Score 0-100
 */
function scoreComfort(fingering) {
  // Use the comfort rating from the original handprint (0-100)
  return fingering.comfortRating || 50;
}

/**
 * Score based on geometric properties (span, compactness)
 * @param {Object} fingering - Fingering object
 * @returns {number} Score 0-100
 */
function scoreGeometry(fingering) {
  const span = calculateSpan(fingering.positions);

  // Ideal span for block chords: 3-5 pads
  // Score decreases for larger spans
  let spanScore;
  if (span <= 3) {
    spanScore = 100;
  } else if (span <= 5) {
    spanScore = 100 - ((span - 3) * 15); // 85 at span=5
  } else if (span <= 7) {
    spanScore = 70 - ((span - 5) * 15); // 40 at span=7
  } else {
    spanScore = Math.max(0, 40 - ((span - 7) * 10));
  }

  // Bonus for compact voicings (positions on same or adjacent rows)
  const rows = fingering.positions.map(p => p.row);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const rowSpan = maxRow - minRow;

  const compactnessScore = rowSpan <= 2 ? 100 : Math.max(0, 100 - (rowSpan - 2) * 20);

  // Average of span and compactness
  return (spanScore + compactnessScore) / 2;
}

/**
 * Score based on ergonomic factors (finger sequence, hand mechanics)
 * @param {Object} fingering - Fingering object
 * @returns {number} Score 0-100
 */
function scoreErgonomics(fingering) {
  let score = 50; // Start at neutral

  // Check if fingers are consecutive (e.g., 1-2-3 or 2-3-4)
  if (usesConsecutiveFingers(fingering.positions)) {
    score += 30; // Big bonus for consecutive fingers
  }

  // Check finger count (3-4 fingers is ideal for block chords)
  const fingerCount = fingering.positions.length;
  if (fingerCount === 3 || fingerCount === 4) {
    score += 20;
  } else if (fingerCount === 5) {
    score += 10; // Slight bonus (possible but harder)
  }

  // Penalize awkward finger combinations
  const fingers = fingering.positions.map(p => p.finger).sort((a, b) => a - b);

  // Thumb + pinky without middle fingers is awkward
  if (fingers.includes(1) && fingers.includes(5) &&
      !fingers.includes(2) && !fingers.includes(3) && !fingers.includes(4)) {
    score -= 30;
  }

  // Using only outer fingers (1, 5) or (1, 4, 5) is less stable
  if (fingers.length === 2 && fingers[0] === 1 && fingers[1] === 5) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Rank fingerings by score (descending)
 * @param {Array<Object>} fingerings - Array of fingerings
 * @returns {Array<Object>} Sorted array
 */
export function rankFingerings(fingerings) {
  return fingerings
    .map(f => scoreFingering(f))
    .sort((a, b) => b.score - a.score);
}
