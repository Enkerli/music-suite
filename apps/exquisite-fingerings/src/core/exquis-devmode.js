/**
 * Exquis Developer Mode Module
 * Handles SysEx commands for LED control and pad event monitoring
 * Spec: Exquis Developer Mode MIDI specification
 */

import { ROW_START_CHROMATIC, ROW_START_INTERVALS, ROW_COUNT, getRowLength } from './grid.js';

/**
 * SysEx header for all Exquis commands
 * F0 00 21 7E 7F [id] [...] F7
 */
const SYSEX_HEADER = [0xF0, 0x00, 0x21, 0x7E, 0x7F];
const SYSEX_FOOTER = [0xF7];

/**
 * Developer Mode Command IDs
 */
const CMD = {
  DEV_MODE: 0x00,      // Enter/exit dev mode
  COLOR_PALETTE: 0x02, // Set palette colors
  REFRESH_LED: 0x03,   // Refresh LED display
  SET_LED_RGB: 0x04,   // Set LED colors directly (RGB)
  TEMPO_SYNC: 0x05,    // Set tempo
  ROOT_NOTE: 0x06,     // Set root note
  SCALE_NUM: 0x07,     // Set scale number
  CUSTOM_SCALE: 0x08,  // Set custom scale
  SNAPSHOT: 0x09       // Save/restore snapshot
};

/**
 * Zone masks for dev mode activation
 */
const ZONE_MASK = {
  PADS: 0x01,
  ENCODERS: 0x02,
  SLIDER: 0x04,
  UP_DOWN_BUTTONS: 0x08,
  SETTINGS_SOUND_BUTTONS: 0x10,
  OTHER_BUTTONS: 0x20,
  ALL: 0x3F
};

/**
 * LED effect values
 */
const LED_EFFECT = {
  NONE: 0x00,
  PULSE_BLACK: 0x3F,
  PULSE_WHITE: 0x7F,
  PULSE_RED: 0x3E,
  PULSE_GREEN: 0x7E
};

/**
 * Color palette for chord highlighting
 * Root = bright distinctive color
 * Other chord tones = contrasting colors
 */
const CHORD_COLORS = {
  ROOT: { r: 127, g: 0, b: 127 },      // Bright magenta
  THIRD: { r: 0, g: 127, b: 127 },     // Cyan
  FIFTH: { r: 127, g: 127, b: 0 },     // Yellow
  SEVENTH: { r: 127, g: 64, b: 0 },    // Orange
  NINTH: { r: 0, g: 127, b: 64 },      // Green-cyan
  ELEVENTH: { r: 64, g: 0, b: 127 },   // Purple
  THIRTEENTH: { r: 127, g: 0, b: 64 }, // Pink
  DEFAULT: { r: 64, g: 64, b: 64 }     // Gray for other tones
};

/**
 * ExquisDevMode class
 * Manages developer mode state and MIDI communication
 */
export class ExquisDevMode {
  constructor(midiOutput) {
    this.output = midiOutput;
    this.isActive = false;
    this.activeZones = 0;
    this.padStates = new Array(61).fill(false); // Track pad press states
    this.eventHandlers = {
      padPress: null,
      padRelease: null,
      encoder: null,
      button: null
    };
  }

  /**
   * Enter developer mode
   * @param {number} zoneMask - Bitmask of zones to activate (default: pads only)
   */
  async enter(zoneMask = ZONE_MASK.PADS) {
    if (!this.output) {
      throw new Error('No MIDI output available');
    }

    const message = [
      ...SYSEX_HEADER,
      CMD.DEV_MODE,
      zoneMask,
      ...SYSEX_FOOTER
    ];

    this.output.send(message);
    this.isActive = true;
    this.activeZones = zoneMask;

    console.log('[DevMode] Entered dev mode, zones:', zoneMask.toString(16));
  }

  /**
   * Exit developer mode
   */
  async exit() {
    if (!this.output) return;

    const message = [
      ...SYSEX_HEADER,
      CMD.DEV_MODE,
      0x00, // mask = 0 to exit
      ...SYSEX_FOOTER
    ];

    this.output.send(message);
    this.isActive = false;
    this.activeZones = 0;
    this.padStates.fill(false);

    console.log('[DevMode] Exited dev mode');
  }

  /**
   * Set single pad color (RGB)
   * @param {number} padId - Pad ID (0-60)
   * @param {number} r - Red (0-127)
   * @param {number} g - Green (0-127)
   * @param {number} b - Blue (0-127)
   * @param {number} fx - LED effect (default: none)
   */
  setPadColor(padId, r, g, b, fx = LED_EFFECT.NONE) {
    if (!this.output) return;

    const message = [
      ...SYSEX_HEADER,
      CMD.SET_LED_RGB,
      padId,
      r & 0x7F,  // Ensure 0-127
      g & 0x7F,
      b & 0x7F,
      fx & 0x7F,
      ...SYSEX_FOOTER
    ];

    this.output.send(message);
  }

  /**
   * Set multiple pad colors at once
   * @param {Array<{id, r, g, b, fx}>} pads - Array of pad configurations
   */
  setPadColors(pads) {
    if (!this.output || pads.length === 0) return;

    // Sort by ID for optimal SysEx batching
    const sorted = [...pads].sort((a, b) => a.id - b.id);

    // For now, send individual messages (could optimize with batching)
    for (const pad of sorted) {
      this.setPadColor(pad.id, pad.r, pad.g, pad.b, pad.fx || LED_EFFECT.NONE);
    }
  }

  /**
   * Clear all pad colors (set to black)
   */
  clearAllPads() {
    const pads = [];
    for (let i = 0; i <= 60; i++) {
      pads.push({ id: i, r: 0, g: 0, b: 0, fx: LED_EFFECT.NONE });
    }
    this.setPadColors(pads);
  }

  /**
   * Highlight chord tones across the entire grid
   * @param {Array<number>} pitchClasses - Chord pitch classes (e.g., [0, 4, 7])
   * @param {number} rootPC - Root pitch class
   * @param {number} baseMidi - Base MIDI note (default 0 for full grid)
   * @param {number} transpose - Transposition offset (default 0)
   */
  highlightChord(pitchClasses, rootPC, baseMidi = 0, transpose = 0) {
    const pads = [];

    // Calculate interval positions
    const intervals = this.calculateIntervals(pitchClasses, rootPC);

    // Iterate through all 61 pads using chromatic pad IDs for LED addressing
    for (let chromaticPadId = 0; chromaticPadId <= 60; chromaticPadId++) {
      // Convert chromatic pad ID to (row, col)
      let row = 0, col = 0;
      let found = false;
      for (let r = 0; r < ROW_COUNT; r++) {
        if (chromaticPadId >= ROW_START_CHROMATIC[r]) {
          const c = chromaticPadId - ROW_START_CHROMATIC[r];
          if (c >= 0 && c < getRowLength(r)) {
            row = r;
            col = c;
            found = true;
            break;
          }
        }
      }

      if (!found) continue;

      // Calculate intervals mode pad index for pitch class calculation
      const intervalsPadIndex = ROW_START_INTERVALS[row] + col;
      const midiNote = baseMidi + intervalsPadIndex + transpose;
      const pc = midiNote % 12;

      if (pitchClasses.includes(pc)) {
        // Get color based on interval from root
        const interval = intervals.get(pc);
        const color = this.getColorForInterval(interval, pc === rootPC);

        pads.push({
          id: chromaticPadId,  // Use chromatic pad ID for LED addressing
          r: color.r,
          g: color.g,
          b: color.b,
          fx: pc === rootPC ? LED_EFFECT.PULSE_BLACK : LED_EFFECT.NONE
        });
      } else {
        // Turn off non-chord pads
        pads.push({ id: chromaticPadId, r: 0, g: 0, b: 0, fx: LED_EFFECT.NONE });
      }
    }

    this.setPadColors(pads);
  }

  /**
   * Calculate intervals from root for each pitch class
   * @param {Array<number>} pitchClasses - Chord pitch classes
   * @param {number} rootPC - Root pitch class
   * @returns {Map<number, string>} Map of PC to interval name
   */
  calculateIntervals(pitchClasses, rootPC) {
    const intervals = new Map();

    for (const pc of pitchClasses) {
      const semitones = (pc - rootPC + 12) % 12;
      let intervalName;

      switch (semitones) {
        case 0: intervalName = 'root'; break;
        case 2: intervalName = 'ninth'; break;
        case 3:
        case 4: intervalName = 'third'; break;
        case 5: intervalName = 'eleventh'; break;
        case 7: intervalName = 'fifth'; break;
        case 9: intervalName = 'thirteenth'; break;
        case 10:
        case 11: intervalName = 'seventh'; break;
        default: intervalName = 'default';
      }

      intervals.set(pc, intervalName);
    }

    return intervals;
  }

  /**
   * Get color for interval
   * @param {string} interval - Interval name
   * @param {boolean} isRoot - Whether this is the root note
   * @returns {{r, g, b}} RGB color
   */
  getColorForInterval(interval, isRoot) {
    if (isRoot) return CHORD_COLORS.ROOT;

    switch (interval) {
      case 'third': return CHORD_COLORS.THIRD;
      case 'fifth': return CHORD_COLORS.FIFTH;
      case 'seventh': return CHORD_COLORS.SEVENTH;
      case 'ninth': return CHORD_COLORS.NINTH;
      case 'eleventh': return CHORD_COLORS.ELEVENTH;
      case 'thirteenth': return CHORD_COLORS.THIRTEENTH;
      default: return CHORD_COLORS.DEFAULT;
    }
  }

  /**
   * Handle incoming MIDI message (call from MIDI input handler)
   * @param {Uint8Array} data - MIDI message data
   */
  handleMidiMessage(data) {
    if (data.length < 3) return;

    const [status, note, velocity] = data;
    const channel = status & 0x0F;
    const command = status & 0xF0;

    console.log('[DevMode] handleMidiMessage:', {
      status: status.toString(16),
      channel,
      command: command.toString(16),
      note,
      velocity
    });

    // Dev mode uses channel 16 (15 in 0-indexed)
    if (channel !== 0x0F) {
      console.log('[DevMode] Ignoring - not channel 16');
      return;
    }

    // Note On (0x90) = pad press
    if (command === 0x90 && velocity > 0) {
      console.log('[DevMode] Pad press detected - note:', note, 'velocity:', velocity);
      this.padStates[note] = true;
      if (this.eventHandlers.padPress) {
        console.log('[DevMode] Calling padPress handler');
        this.eventHandlers.padPress(note, velocity);
      } else {
        console.log('[DevMode] No padPress handler registered!');
      }
    }

    // Note Off (0x80) or Note On with velocity 0 = pad release
    if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      console.log('[DevMode] Pad release detected - note:', note);
      this.padStates[note] = false;
      if (this.eventHandlers.padRelease) {
        this.eventHandlers.padRelease(note);
      }
    }

    // Control Change (0xB0) = encoder or button
    if (command === 0xB0) {
      if (this.eventHandlers.encoder && note >= 110 && note <= 113) {
        this.eventHandlers.encoder(note - 110, velocity);
      } else if (this.eventHandlers.button) {
        this.eventHandlers.button(note, velocity);
      }
    }
  }

  /**
   * Set event handler
   * @param {string} event - Event name ('padPress', 'padRelease', 'encoder', 'button')
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (this.eventHandlers.hasOwnProperty(event)) {
      this.eventHandlers[event] = handler;
    }
  }

  /**
   * Get current pad states
   * @returns {Array<boolean>} Array of pad states (true = pressed)
   */
  getPadStates() {
    return [...this.padStates];
  }

  /**
   * Check if a pad is currently pressed
   * @param {number} padId - Pad ID (0-60)
   * @returns {boolean} True if pressed
   */
  isPadPressed(padId) {
    return this.padStates[padId] || false;
  }
}

// Export constants for external use
export { ZONE_MASK, LED_EFFECT, CHORD_COLORS };
