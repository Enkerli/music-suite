/**
 * Chord Matcher Module
 * Finds fingerings from handprints that match target chord notes
 */

import { getPadIndex } from '../core/grid.js';
import { midiToPitchClass } from '../core/music.js';

/**
 * Generate all subsets of an array with size between min and max
 * @param {Array} arr - Input array
 * @param {number} minSize - Minimum subset size
 * @param {number} maxSize - Maximum subset size
 * @returns {Array<Array>} Array of subsets
 */
function generateSubsets(arr, minSize, maxSize) {
  const subsets = [];

  function backtrack(start, current) {
    const size = current.length;
    if (size >= minSize && size <= maxSize) {
      subsets.push([...current]);
    }
    if (size === maxSize) return;

    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return subsets;
}

/**
 * Find fingerings from handprints that match target chord
 * @param {Array<number>} targetPitchClasses - Set of pitch classes to match (e.g., [0, 4, 7] for C major)
 * @param {Array<Object>} handprints - Array of saved handprints
 * @param {number} baseMidi - Base MIDI note for the grid
 * @param {string} hand - 'left' or 'right' - filter by hand
 * @returns {Array<Object>} Array of matching fingerings with scores
 */
export function findChordFingerings(targetPitchClasses, handprints, baseMidi = 48, hand = null) {
  const targetSet = new Set(targetPitchClasses);
  const matches = [];

  // Filter handprints by hand if specified
  const filteredHandprints = hand
    ? handprints.filter(hp => hp.hand === hand)
    : handprints;

  for (const handprint of filteredHandprints) {
    // Generate all possible finger subsets (3-5 fingers for block chords)
    const fingerSubsets = generateSubsets(handprint.positions, 3, 5);

    for (const subset of fingerSubsets) {
      // Calculate pitch classes for this subset
      // IMPORTANT: Recalculate padIndex from (row, col) in intervals mode
      // Don't use stored padIndex (which was captured in chromatic mode)
      // Use handprint's own baseMidi for correct pitch class calculation
      const handprintBaseMidi = handprint.baseMidi || baseMidi;
      const pitchClasses = subset.map(pos => {
        const padIndex = getPadIndex(pos.row, pos.col); // Recalculate in current grid mode
        const midiNote = handprintBaseMidi + padIndex;
        return midiToPitchClass(midiNote);
      });

      // Check if pitch classes match target chord (subset match)
      // All target chord notes must be present (handprint can have extra notes)
      const pitchSet = new Set(pitchClasses);

      if ([...targetSet].every(pc => pitchSet.has(pc)) &&
          pitchSet.size >= targetSet.size) {
        // Found a match! Create fingering object
        const fingering = {
          handprintId: handprint.id,
          hand: handprint.hand,
          comfortRating: handprint.comfortRating || 50,
          baseMidi: handprintBaseMidi,
          midiDevice: handprint.midiDevice,
          capturedAt: handprint.capturedAt,
          positions: subset.map(pos => {
            const padIndex = getPadIndex(pos.row, pos.col); // Recalculate in intervals mode
            const midiNote = handprintBaseMidi + padIndex;
            return {
              row: pos.row,
              col: pos.col,
              padIndex: padIndex,  // Use recalculated padIndex
              midiNote: midiNote,
              finger: pos.finger,
              pitchClass: midiToPitchClass(midiNote)
            };
          }),
          // Will be filled by scorer
          score: 0,
          geometricScore: 0,
          ergonomicScore: 0
        };

        matches.push(fingering);
      }
    }
  }

  return matches;
}

/**
 * Check if a fingering uses consecutive fingers
 * @param {Array<Object>} positions - Fingering positions with finger property
 * @returns {boolean} True if fingers are consecutive
 */
export function usesConsecutiveFingers(positions) {
  const fingers = positions.map(p => p.finger).sort((a, b) => a - b);
  for (let i = 1; i < fingers.length; i++) {
    if (fingers[i] !== fingers[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate the span (max distance) of a fingering
 * @param {Array<Object>} positions - Fingering positions with row/col
 * @returns {number} Maximum distance between any two pads
 */
export function calculateSpan(positions) {
  let maxDistance = 0;

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[j].col - positions[i].col;
      const dy = positions[j].row - positions[i].row;
      const distance = Math.sqrt(dx * dx + dy * dy);
      maxDistance = Math.max(maxDistance, distance);
    }
  }

  return maxDistance;
}
