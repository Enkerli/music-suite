/**
 * SVG Grid Renderer
 * Handles rendering of the Exquis hex grid
 */

import {
  ROW_COUNT,
  getRowLength,
  getPadIndex,
  getCellCenter,
  getHexPoints,
  getViewBox,
  getMidiNote
} from '../core/grid.js';
import { midiToPitchClass } from '../core/music.js';
import { debugLog } from '../utils/debug.js';

/**
 * Grid Renderer class
 * Manages SVG rendering of the hex grid
 */
export class GridRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.orientation = 'portrait';
    this.labelMode = 'pc';
    this.spelledNames = null; // Map<pc, properly spelled name> when a key/set context exists
    this.baseMidi = 48;
    this.highlightedPCs = new Set();
    this.fingeringPattern = null;
    this.fingeringMode = false;
    this.onPadClick = null; // Callback for pad clicks
  }

  /**
   * Set orientation
   * @param {string} orientation - 'portrait' or 'landscape'
   */
  setOrientation(orientation) {
    this.orientation = orientation;
  }

  /**
   * Set label mode
   * @param {string} mode - 'pc', 'note', or 'midi'
   */
  setSpelledNames(map) {
    this.spelledNames = map;
  }

  setLabelMode(mode) {
    this.labelMode = mode;
  }

  /**
   * Set base MIDI note
   * @param {number} baseMidi - Base MIDI note number
   */
  setBaseMidi(baseMidi) {
    this.baseMidi = baseMidi;
  }

  /**
   * Set highlighted pitch classes
   * @param {Set<number>} pcs - Set of pitch classes to highlight
   */
  setHighlightedPCs(pcs) {
    this.highlightedPCs = pcs;
  }

  /**
   * Set fingering pattern
   * @param {FingeringPattern} pattern - Fingering pattern to display
   */
  setFingeringPattern(pattern) {
    this.fingeringPattern = pattern;
  }

  /**
   * Set fingering mode
   * @param {boolean} enabled - Enable/disable fingering mode
   */
  setFingeringMode(enabled) {
    this.fingeringMode = enabled;
  }

  /**
   * Set pad click callback
   * @param {Function} callback - Callback function(row, col, midiNote)
   */
  setPadClickHandler(callback) {
    this.onPadClick = callback;
  }

  /**
   * Render the complete grid
   */
  render() {
    debugLog('grid', '[GridRenderer] render() called', {
      svg: this.svg,
      orientation: this.orientation,
      labelMode: this.labelMode
    });

    const vb = getViewBox(this.orientation);
    this.svg.setAttribute('viewBox', vb.viewBox);

    // Clear existing content
    this.svg.innerHTML = '';

    // Create main group
    const gNode = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Apply rotation for landscape
    if (this.orientation === 'landscape') {
      gNode.setAttribute('transform', `translate(${vb.width},0) rotate(90)`);
    }

    // Render all pads
    let padCount = 0;
    for (let row = 0; row < ROW_COUNT; row++) {
      const cols = getRowLength(row);
      for (let col = 0; col < cols; col++) {
        this._renderPad(gNode, row, col);
        padCount++;
      }
    }

    debugLog('grid', `[GridRenderer] Rendered ${padCount} pads`);
    this.svg.appendChild(gNode);
    debugLog('grid', '[GridRenderer] Grid appended to SVG');
  }

  /**
   * Render a single pad
   * @private
   */
  _renderPad(parent, row, col) {
    const { x: cx, y: cy } = getCellCenter(row, col);
    const midiNote = getMidiNote(row, col, this.baseMidi);
    const pc = midiToPitchClass(midiNote);

    // Create hexagon
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', getHexPoints(cx, cy, 22));
    poly.setAttribute('class', 'pad');
    poly.setAttribute('stroke', '#666');
    poly.setAttribute('fill', '#6aa5ff');
    poly.setAttribute('fill-opacity', '0.12');

    // Add highlighted class if this PC is highlighted
    if (this.highlightedPCs.has(pc)) {
      poly.classList.add('on');
    }

    // Add fingering-mode class if enabled
    if (this.fingeringMode) {
      poly.classList.add('fingering-mode');
    }

    // Click handler
    poly.addEventListener('click', () => {
      if (this.onPadClick) {
        this.onPadClick(row, col, midiNote, pc);
      }
    });

    parent.appendChild(poly);

    // Render label
    this._renderLabel(parent, cx, cy, midiNote, pc);

    // Render fingering if exists
    if (this.fingeringPattern) {
      const fingering = this.fingeringPattern.getFingering(row, col);
      if (fingering) {
        this._renderFingering(parent, cx, cy, fingering);
      }
    }
  }

  /**
   * Render pad label
   * @private
   */
  _renderLabel(parent, cx, cy, midiNote, pc) {
    const labelText = this._getLabelText(midiNote, pc);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'label');

    // Keep labels horizontal in landscape mode
    if (this.orientation === 'landscape') {
      text.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    }

    text.textContent = labelText;
    parent.appendChild(text);
  }

  /**
   * Render fingering number
   * @private
   */
  _renderFingering(parent, cx, cy, fingering) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy - 8);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', `fing ${fingering.hand}`);

    // Keep fingerings horizontal in landscape mode
    if (this.orientation === 'landscape') {
      text.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    }

    text.textContent = fingering.finger;
    parent.appendChild(text);
  }

  /**
   * Get label text based on label mode
   * @private
   */
  _getLabelText(midiNote, pc) {
    switch (this.labelMode) {
      case 'pc':
        return pc;
      case 'note':
        return this._midiToNoteName(midiNote);
      case 'midi':
        return midiNote;
      default:
        return pc;
    }
  }

  /**
   * Convert MIDI to note name (simple version)
   * @private
   */
  _midiToNoteName(midiNote) {
    const pc = midiToPitchClass(midiNote);
    // Proper structural spelling when a key/set context exists (see
    // music-suite CONVENTIONS.md); chromatic fallback for out-of-set pads
    // and context-free display.
    const spelled = this.spelledNames?.get(pc);
    if (spelled !== undefined) return spelled;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[pc];
  }
}
