/**
 * MIDI I/O Module
 * Handles WebMIDI communication with external devices (e.g., Exquis controller)
 */

import { debugLog, errorLog, warnLog } from '../utils/debug.js';
import { ExquisDevMode } from './exquis-devmode.js';

/**
 * MIDI Manager class
 * Handles WebMIDI access, device selection, and note output
 */
export class MIDIManager {
  constructor() {
    this.midiAccess = null;
    this.selectedOutput = null;
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
    this.activeNotes = new Map(); // Track currently playing notes for hold functionality
    this.holdDuration = 1000; // Default hold duration in ms
    this.octaveRange = 0; // ±octaves to send
    this.isHolding = false; // For continuous hold mode
    this.devMode = null; // ExquisDevMode instance
  }

  /**
   * Initialize WebMIDI access
   * @returns {Promise<boolean>} Success status
   */
  async init() {
    if (!this.isSupported) {
      throw new Error('WebMIDI not supported in this browser');
    }

    try {
      debugLog('midi', '[MIDI] Requesting MIDI access with SysEx permission...');
      // Request SysEx permission for Developer Mode functionality
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      debugLog('midi', '[MIDI] ✓ MIDI access granted with SysEx support');
      this.midiAccess.onstatechange = () => {
        this._onDeviceStateChange();
      };
      return true;
    } catch (err) {
      errorLog('[MIDI] ✗ MIDI initialization failed:', err);
      throw new Error(`MIDI initialization failed: ${err.message}`);
    }
  }

  /**
   * Get list of available MIDI output devices
   * @returns {Array<{id: string, name: string}>} Available devices
   */
  getOutputDevices() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values()).map(output => ({
      id: output.id,
      name: output.name
    }));
  }

  /**
   * Select MIDI output device
   * @param {string} deviceId - Device ID
   * @returns {boolean} Success status
   */
  selectOutputDevice(deviceId) {
    if (!this.midiAccess) return false;
    const output = this.midiAccess.outputs.get(deviceId);
    if (output) {
      this.selectedOutput = output;
      // Re-initialize dev mode with new output
      if (this.devMode) {
        this.devMode.output = output;
      }
      return true;
    }
    return false;
  }

  /**
   * Get or create Exquis Developer Mode instance
   * @returns {ExquisDevMode} Dev mode instance
   */
  getDevMode() {
    if (!this.devMode) {
      this.devMode = new ExquisDevMode(this.selectedOutput);
    }
    return this.devMode;
  }

  /**
   * Set hold duration for MIDI notes
   * @param {number} durationMs - Duration in milliseconds
   */
  setHoldDuration(durationMs) {
    this.holdDuration = Math.max(100, Math.min(durationMs, 30000)); // 100ms - 30s
  }

  /**
   * Set octave range for MIDI output
   * @param {number} range - ±octaves (0-2)
   */
  setOctaveRange(range) {
    this.octaveRange = Math.max(0, Math.min(range, 2));
  }

  /**
   * Send MIDI note on
   * @param {number} midiNote - MIDI note number (0-127)
   * @param {number} velocity - Velocity (0-127)
   */
  noteOn(midiNote, velocity = 100) {
    if (!this.selectedOutput || midiNote < 0 || midiNote > 127) return;

    try {
      this.selectedOutput.send([0x90, midiNote, velocity]);
    } catch (err) {
      console.error('MIDI send error:', err);
    }
  }

  /**
   * Send MIDI note off
   * @param {number} midiNote - MIDI note number (0-127)
   */
  noteOff(midiNote) {
    if (!this.selectedOutput || midiNote < 0 || midiNote > 127) return;

    try {
      this.selectedOutput.send([0x80, midiNote, 0]);
    } catch (err) {
      console.error('MIDI send error:', err);
    }
  }

  /**
   * Send MIDI note with automatic note off after duration
   * @param {number} midiNote - MIDI note number
   * @param {number} velocity - Velocity (default 100)
   * @param {number} duration - Duration in ms (default uses holdDuration)
   */
  playNote(midiNote, velocity = 100, duration = null) {
    const actualDuration = duration !== null ? duration : this.holdDuration;

    // Send note across octave range
    const notesToPlay = this._getOctaveNotes(midiNote);
    notesToPlay.forEach(note => {
      this.noteOn(note, velocity);

      // Schedule note off
      if (!this.isHolding) {
        setTimeout(() => {
          this.noteOff(note);
        }, actualDuration);
      } else {
        // Track for manual release
        this.activeNotes.set(note, { velocity, time: Date.now() });
      }
    });
  }

  /**
   * Send multiple notes (e.g., a chord)
   * @param {Array<number>} midiNotes - Array of MIDI note numbers
   * @param {number} velocity - Velocity (default 100)
   * @param {number} duration - Duration in ms
   * @param {number} stagger - Stagger time between notes in ms (default 0)
   */
  playChord(midiNotes, velocity = 100, duration = null, stagger = 0) {
    midiNotes.forEach((note, index) => {
      setTimeout(() => {
        this.playNote(note, velocity, duration);
      }, index * stagger);
    });
  }

  /**
   * Enable hold mode (notes stay on until released)
   */
  enableHold() {
    this.isHolding = true;
    this.activeNotes.clear();
  }

  /**
   * Disable hold mode and release all held notes
   */
  disableHold() {
    this.isHolding = false;
    this.releaseAllNotes();
  }

  /**
   * Release all currently held notes
   */
  releaseAllNotes() {
    for (const [note] of this.activeNotes) {
      this.noteOff(note);
    }
    this.activeNotes.clear();
  }

  /**
   * Send all notes off message
   */
  allNotesOff() {
    if (!this.selectedOutput) return;
    try {
      // Send All Notes Off (CC 123)
      for (let channel = 0; channel < 16; channel++) {
        this.selectedOutput.send([0xB0 + channel, 123, 0]);
      }
    } catch (err) {
      console.error('MIDI send error:', err);
    }
    this.activeNotes.clear();
  }

  /**
   * Get octave-transposed notes based on octaveRange setting
   * @param {number} midiNote - Base MIDI note
   * @returns {Array<number>} Array of notes to play
   * @private
   */
  _getOctaveNotes(midiNote) {
    const notes = [midiNote];

    for (let octave = 1; octave <= this.octaveRange; octave++) {
      const noteUp = midiNote + (12 * octave);
      const noteDown = midiNote - (12 * octave);

      if (noteUp <= 127) notes.push(noteUp);
      if (noteDown >= 0) notes.push(noteDown);
    }

    return notes;
  }

  /**
   * Device state change handler
   * @private
   */
  _onDeviceStateChange() {
    // Check if selected device is still available
    if (this.selectedOutput) {
      const stillAvailable = this.midiAccess.outputs.get(this.selectedOutput.id);
      if (!stillAvailable) {
        this.selectedOutput = null;
      }
    }
  }

  /**
   * Set note handler for MIDI input
   * Used for capturing handprints and other input scenarios
   * @param {Function|null} handler - Function(padID, velocity) or null to clear
   * @param {boolean} devMode - If true, listen for Developer Mode messages on channel 16
   */
  setNoteHandler(handler, devMode = false) {
    this.noteHandler = handler;
    this.devModeActive = devMode;

    // Listen to all input devices
    if (this.midiAccess) {
      const inputs = this.midiAccess.inputs.values();
      for (const input of inputs) {
        if (handler) {
          input.onmidimessage = (message) => this._handleMidiInput(message);
        } else {
          input.onmidimessage = null;
        }
      }
    }
  }

  /**
   * Handle incoming MIDI messages
   * @private
   */
  _handleMidiInput(message) {
    const [status, note, velocity] = message.data;
    const messageType = status & 0xF0;
    const channel = status & 0x0F;

    // Log ALL incoming MIDI messages when in Developer Mode (if debug enabled)
    if (this.devModeActive) {
      debugLog('midi', '[MIDI IN] Status:', status.toString(16).padStart(2, '0').toUpperCase(),
                  'Channel:', channel,
                  'Note/Data1:', note,
                  'Velocity/Data2:', velocity,
                  'Type:', messageType.toString(16).padStart(2, '0').toUpperCase());

      // Pass message to dev mode handler
      if (this.devMode) {
        this.devMode.handleMidiMessage(message.data);
      }
    }

    // In Developer Mode, listen on channel 16 (index 15) for pad IDs
    if (this.devModeActive && channel === 15) {
      debugLog('midi', '[DEV MODE] Channel 16 message detected! Pad ID:', note, 'Velocity:', velocity);
      // Developer Mode: 9F [pad 0-60] 7F (press), 8F [pad 0-60] 00 (release)
      if (messageType === 0x90 || messageType === 0x80) {
        const actualVelocity = messageType === 0x80 ? 0 : velocity;
        const padID = note; // In dev mode, note IS the pad ID (0-60)
        debugLog('midi', '[DEV MODE] Triggering handler with pad ID:', padID, 'velocity:', actualVelocity);
        if (this.noteHandler) {
          this.noteHandler(padID, actualVelocity);
        }
      }
      return;
    }

    // Normal mode: accept Note On/Off on any channel
    // Only accept Note On (0x90) and Note Off (0x80) messages
    // Filter out: Polyphonic Aftertouch (0xA0), Control Change (0xB0),
    // Channel Pressure (0xD0), Pitch Bend (0xE0)
    if (messageType === 0x90 || messageType === 0x80) {
      const actualVelocity = messageType === 0x80 ? 0 : velocity;
      debugLog('midi', '[NORMAL MODE] Note event - Note:', note, 'Velocity:', actualVelocity);
      // Only trigger handler for actual note events (velocity > 0 for Note On)
      if (this.noteHandler) {
        this.noteHandler(note, actualVelocity);
      }
    }
    // Ignore all other message types during capture
  }

  /**
   * Send SysEx message
   * @param {Array<number>} data - SysEx data bytes
   */
  sendSysEx(data) {
    if (!this.selectedOutput) {
      warnLog('[SYSEX] ⚠️ No MIDI output device selected - cannot send SysEx');
      return;
    }

    const hexString = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    debugLog('midi', `[SYSEX] Sending to ${this.selectedOutput.name}:`, hexString);

    try {
      this.selectedOutput.send(data);
      debugLog('midi', '[SYSEX] ✓ Sent successfully');
    } catch (err) {
      errorLog('[SYSEX] ✗ Send error:', err);
    }
  }

  /**
   * Enter Exquis Developer Mode (pads only)
   * Sends: F0 00 21 7E 7F 00 01 F7
   */
  enterExquisDeveloperMode() {
    debugLog('midi', '[DEV MODE] 🔧 Entering Exquis Developer Mode...');
    const sysex = [0xF0, 0x00, 0x21, 0x7E, 0x7F, 0x00, 0x01, 0xF7];
    this.sendSysEx(sysex);
    debugLog('midi', '[DEV MODE] ✓ Developer Mode command sent (pads should now send pad IDs on channel 16)');
  }

  /**
   * Exit Exquis Developer Mode
   * Sends: F0 00 21 7E 7F 00 00 F7
   */
  exitExquisDeveloperMode() {
    debugLog('midi', '[DEV MODE] 🔧 Exiting Exquis Developer Mode...');
    const sysex = [0xF0, 0x00, 0x21, 0x7E, 0x7F, 0x00, 0x00, 0xF7];
    this.sendSysEx(sysex);
    debugLog('midi', '[DEV MODE] ✓ Exit command sent (pads should return to normal mode)');
  }

  /**
   * Get current status
   * @returns {object} Status object
   */
  getStatus() {
    const status = {
      isSupported: this.isSupported,
      isInitialized: this.midiAccess !== null,
      hasDevice: this.selectedOutput !== null,
      deviceName: this.selectedOutput?.name || null,
      isHolding: this.isHolding,
      activeNoteCount: this.activeNotes.size,
      holdDuration: this.holdDuration,
      octaveRange: this.octaveRange
    };

    // Add "isEnabled" flag for convenience
    status.isEnabled = status.isInitialized;
    return status;
  }

  /**
   * Old getStatus for compatibility
   * @returns {object} Status object
   */
  _oldGetStatus() {
    return {
      isSupported: this.isSupported,
      isInitialized: this.midiAccess !== null,
      hasDevice: this.selectedOutput !== null,
      deviceName: this.selectedOutput?.name || null,
      isHolding: this.isHolding,
      activeNoteCount: this.activeNotes.size,
      holdDuration: this.holdDuration,
      octaveRange: this.octaveRange
    };
  }
}

// Export singleton instance
export const midiManager = new MIDIManager();

/**
 * Utility: Convert note name to MIDI number
 * @param {string} noteName - Note name (e.g., 'C4', 'F#5')
 * @returns {number} MIDI note number
 */
export function noteNameToMidi(noteName) {
  const noteMap = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };

  const match = noteName.match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${noteName}`);

  const [, note, octave] = match;
  const pc = noteMap[note];
  if (pc === undefined) throw new Error(`Invalid note: ${note}`);

  return (parseInt(octave) + 1) * 12 + pc;
}
