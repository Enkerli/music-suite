/**
 * Main Application
 * Wires together all components and manages app state
 */

import '@enkerli/ui/tokens.css';
import { GridRenderer } from './ui/svg-grid.js';
import { midiManager } from './core/midi.js';
import { FingeringPattern, ergoAnalyzer } from './core/fingering.js';
import { getPitchClasses, getSpelledNoteNames, parseCustomPitchClasses, PITCH_CLASS_SETS } from './core/music.js';
import { getRowCol, getPadIndex, setGridMode } from './core/grid.js';
import { savePattern, loadPattern, deletePattern, getPatternNames, saveSettings, loadSettings } from './utils/storage.js';
import { debugLog } from './utils/debug.js';
import { findChordFingerings } from './analysis/chord-matcher.js';
import { rankFingerings } from './analysis/fingering-scorer.js';
import { synthesizeFingerings } from './analysis/fingering-synthesizer.js';
import { getChordPitchClasses, getChordName, analyzeVoicing } from './core/chord-dictionary.js';

/**
 * Main App class
 */
class ExquisFingerings {
  constructor() {
    debugLog('app', '[APP] Constructor started');

    // Ensure grid starts in intervals mode FIRST (before any grid calculations)
    setGridMode('intervals');
    debugLog('app', '[APP] Grid mode set to intervals');

    // State
    this.settings = loadSettings();
    this.currentPattern = new FingeringPattern();
    this.currentFinger = 1;
    this.currentHand = 'right';
    this.fingeringMode = false;

    // Handprint capture state
    this.handprintMode = false;
    this.handprintCaptureState = null;  // 'waiting_basenote' | 'capturing_fingers' | 'rating'
    this.handprintCaptures = [];  // Current capture in progress (5 fingers)
    this.handprintCaptureHand = 'right';  // Selected hand for capture
    this.handprintSessionBaseMidi = null;  // Basenote for current session
    this.handprintSessionID = null;  // Session ID to link related handprints
    this.handprintSessionCount = 0;  // Count of handprints in current session
    this.savedHandprints = this.settings.handprints || [];  // All saved handprints

    // Suggestion synthesis state
    this.currentSuggestions = [];  // Array of synthesized suggestions
    this.currentSuggestionIndex = 0;  // Current suggestion being displayed
    this.currentSuggestionRating = 3;  // User rating for current suggestion
    this.suggestionEditMode = false;  // Whether we're editing the current suggestion
    this.editingPad = null;  // Which pad is being edited {row, col}

    // Chord capture state
    this.chordCaptureActive = false;  // Whether chord capture is active
    this.chordCaptureHand = 'right';  // Selected hand for chord capture
    this.chordCaptureSequence = [];  // Captured pad sequence (finger 1-5)
    this.chordCapturePitchClasses = [];  // Target chord pitch classes
    this.chordCaptureRoot = 0;  // Root pitch class
    this.chordCaptureQuality = 'dom7';  // Chord quality
    this.savedChordFingerings = this.settings.chordFingerings || [];  // Saved chord fingerings

    // UI Elements
    this.gridElement = document.getElementById('grid');
    debugLog('app', '[APP] Grid element:', this.gridElement);
    this.gridRenderer = new GridRenderer(this.gridElement);
    debugLog('app', '[APP] GridRenderer created');

    // Initialize
    this.initUI();
    this.loadStoredSettings();
    this.updatePatternMetadata();
    this.updateHandprintList();

    // Initial render to ensure grid displays immediately
    debugLog('app', '[APP] About to call initial render()');
    this.render();
    debugLog('app', '[APP] Constructor completed');
  }

  /**
   * Initialize UI event handlers
   */
  initUI() {
    // Orientation
    document.querySelectorAll('input[name="ori"]').forEach(el => {
      el.addEventListener('change', () => {
        this.settings.orientation = el.value;
        this.render();
        saveSettings(this.settings);
      });
    });

    // Labels
    document.querySelectorAll('input[name="lab"]').forEach(el => {
      el.addEventListener('change', () => {
        this.settings.labelMode = el.value;
        this.render();
        saveSettings(this.settings);
      });
    });

    // Key and Set
    document.getElementById('key').addEventListener('change', () => {
      this.updatePatternMetadata();
      this.render();
      this.updateMIDIHoldIfActive();
    });
    document.getElementById('set').addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      document.getElementById('customPC').disabled = !isCustom;
      this.updatePatternMetadata();
      this.render();
      this.updateMIDIHoldIfActive();
    });
    document.getElementById('customPC').addEventListener('input', () => {
      this.render();
      this.updateMIDIHoldIfActive();
    });
    document.getElementById('baseMidi').addEventListener('input', (e) => {
      this.settings.baseMidi = parseInt(e.target.value);
      this.render();
      this.updateMIDIHoldIfActive();
      saveSettings(this.settings);
    });

    // Fingering Mode
    document.getElementById('fingeringMode').addEventListener('change', (e) => {
      this.fingeringMode = e.target.checked;
      document.getElementById('fingeringModeInfo').style.display = this.fingeringMode ? 'block' : 'none';
      document.querySelectorAll('.finger-btn').forEach(btn => {
        btn.disabled = !this.fingeringMode;
      });
      this.render();
    });

    // Hand selection
    document.getElementById('fingeringHand').addEventListener('change', (e) => {
      this.currentHand = e.target.value;
    });

    // Finger buttons
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`fingBtn${i}`);
      btn.addEventListener('click', () => {
        this.currentFinger = i;
        this.updateFingerButtonState();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.fingeringMode && e.key >= '1' && e.key <= '5') {
        this.currentFinger = parseInt(e.key);
        this.updateFingerButtonState();
      }
    });

    // Clear fingerings
    document.getElementById('clearFingerings').addEventListener('click', () => {
      this.currentPattern.clearAll();
      this.render();
    });

    // Suggest fingerings
    document.getElementById('suggestFingerings').addEventListener('click', () => {
      this.suggestFingerings();
    });

    // Pattern management
    document.getElementById('savePattern').addEventListener('click', () => this.saveCurrentPattern());
    document.getElementById('loadPattern').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadPatternByName(e.target.value);
      }
    });
    document.getElementById('deletePattern').addEventListener('click', () => this.deleteCurrentPattern());

    // Export/Import
    document.getElementById('exportPattern').addEventListener('click', () => this.exportPattern());
    document.getElementById('importPatternBtn').addEventListener('click', () => {
      document.getElementById('importPattern').click();
    });
    document.getElementById('importPattern').addEventListener('change', (e) => this.importPattern(e));

    // MIDI
    document.getElementById('enableMidi').addEventListener('click', () => this.initMIDI());
    document.getElementById('midiDevice').addEventListener('change', (e) => {
      if (e.target.value) {
        midiManager.selectOutputDevice(e.target.value);
        this.updateMIDIStatus();
      }
    });

    // MIDI Hold Duration
    const holdDurationSlider = document.getElementById('midiHoldDuration');
    const holdDurationValue = document.getElementById('holdDurationValue');
    holdDurationSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      holdDurationValue.textContent = `${(value / 1000).toFixed(1)}s`;
      midiManager.setHoldDuration(value);
      this.settings.midiHoldDuration = value;
      saveSettings(this.settings);
    });

    // MIDI Octave Range
    const octaveRangeSlider = document.getElementById('midiOctaveRange');
    const octaveRangeValue = document.getElementById('octaveRangeValue');
    octaveRangeSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      octaveRangeValue.textContent = value === 0 ? '0 (none)' : `±${value}`;
      midiManager.setOctaveRange(value);
      this.settings.midiOctaveRange = value;
      saveSettings(this.settings);
    });

    // MIDI Hold Toggle
    const holdToggle = document.getElementById('midiHoldToggle');
    holdToggle?.addEventListener('change', (e) => {
      if (e.target.checked) {
        midiManager.enableHold();
        this.sendHighlightedNotes();
      } else {
        midiManager.disableHold();
      }
    });

    // MIDI Send Highlighted
    document.getElementById('midiSendHighlighted')?.addEventListener('click', () => {
      this.sendHighlightedNotes();
    });

    // Ergonomics analysis
    document.getElementById('analyzeErgo')?.addEventListener('click', () => {
      this.analyzeErgonomics();
    });

    // Hand size
    document.getElementById('handSize')?.addEventListener('change', (e) => {
      const value = e.target.value;
      ergoAnalyzer.setHandSize(value);
      this.settings.handSize = value;
      saveSettings(this.settings);
    });

    // Chord capture - Hand selection
    document.getElementById('captureLeftHand')?.addEventListener('click', () => {
      this.selectChordCaptureHand('left');
    });

    document.getElementById('captureRightHand')?.addEventListener('click', () => {
      this.selectChordCaptureHand('right');
    });

    // Chord capture - Start
    document.getElementById('startChordCapture')?.addEventListener('click', () => {
      this.startChordCapture();
    });

    // Chord capture - Stop
    document.getElementById('stopChordCapture')?.addEventListener('click', () => {
      this.stopChordCapture();
    });

    // Chord capture - Save
    document.getElementById('saveCapturedFingering')?.addEventListener('click', () => {
      this.saveChordFingering();
    });

    // Chord capture - Discard
    document.getElementById('discardCapturedFingering')?.addEventListener('click', () => {
      this.discardChordFingering();
    });

    // Chord capture - Comfort rating
    document.getElementById('captureComfort')?.addEventListener('input', (e) => {
      document.getElementById('captureComfortValue').textContent = e.target.value;
    });

    // Hand selection for handprint capture
    document.getElementById('selectLeftHand')?.addEventListener('click', () => {
      this.selectHandForCapture('left');
    });

    document.getElementById('selectRightHand')?.addEventListener('click', () => {
      this.selectHandForCapture('right');
    });

    // Start handprint capture
    document.getElementById('startHandprintCapture')?.addEventListener('click', () => {
      this.startHandprintCapture();
    });

    // Export handprints
    document.getElementById('exportHandprints')?.addEventListener('click', () => {
      this.exportHandprints();
    });

    // Clear handprints
    document.getElementById('clearHandprints')?.addEventListener('click', () => {
      this.clearAllHandprints();
    });

    // Chord suggestion - Clear notes
    document.getElementById('clearChordNotes')?.addEventListener('click', () => {
      document.querySelectorAll('input[name="chordNote"]').forEach(checkbox => {
        checkbox.checked = false;
      });
    });

    // Chord suggestion - Find fingerings
    document.getElementById('findChordFingerings')?.addEventListener('click', () => {
      this.findChordFingeringSuggestions();
    });

    // Suggestion synthesis - Generate button
    document.getElementById('generateSuggestion')?.addEventListener('click', () => {
      this.generateChordSuggestion();
    });

    // Suggestion synthesis - Save button
    document.getElementById('saveSuggestion')?.addEventListener('click', () => {
      this.saveSuggestionAsPattern();
    });

    // Suggestion synthesis - Next button
    document.getElementById('nextSuggestion')?.addEventListener('click', () => {
      this.showNextSuggestion();
    });

    // Suggestion synthesis - Comfort rating
    document.getElementById('comfortRating')?.addEventListener('input', (e) => {
      this.currentSuggestionRating = parseInt(e.target.value);
      document.getElementById('comfortRatingValue').textContent = e.target.value;
    });

    // Auto-suggest on key/set change
    document.getElementById('key')?.addEventListener('change', () => {
      if (document.getElementById('autoSuggestChords')?.checked) {
        this.generateChordSuggestion();
      }
    });

    document.getElementById('set')?.addEventListener('change', () => {
      if (document.getElementById('autoSuggestChords')?.checked) {
        this.generateChordSuggestion();
      }
    });

    // Fingering type
    document.getElementById('fingeringType')?.addEventListener('change', (e) => {
      this.settings.fingeringType = e.target.value;
      saveSettings(this.settings);
    });

    // Grid click handler
    this.gridRenderer.setPadClickHandler((row, col, midiNote, pc) => {
      if (this.handprintMode) {
        this.handleHandprintClick(row, col);
      } else if (this.suggestionEditMode) {
        this.handleSuggestionEditClick(row, col);
      } else if (this.fingeringMode) {
        this.handleFingeringClick(row, col);
      } else {
        // Play MIDI note
        midiManager.playNote(midiNote);
      }
    });
  }

  /**
   * Load stored settings
   */
  loadStoredSettings() {
    // Orientation
    const oriRadio = document.querySelector(`input[name="ori"][value="${this.settings.orientation}"]`);
    if (oriRadio) oriRadio.checked = true;

    // Label mode
    const labRadio = document.querySelector(`input[name="lab"][value="${this.settings.labelMode}"]`);
    if (labRadio) labRadio.checked = true;

    // Base MIDI
    const baseMidiInput = document.getElementById('baseMidi');
    if (baseMidiInput) baseMidiInput.value = this.settings.baseMidi;

    // MIDI settings
    const holdDurationSlider = document.getElementById('midiHoldDuration');
    if (holdDurationSlider) {
      holdDurationSlider.value = this.settings.midiHoldDuration;
      document.getElementById('holdDurationValue').textContent = `${(this.settings.midiHoldDuration / 1000).toFixed(1)}s`;
      midiManager.setHoldDuration(this.settings.midiHoldDuration);
    }

    const octaveRangeSlider = document.getElementById('midiOctaveRange');
    if (octaveRangeSlider) {
      octaveRangeSlider.value = this.settings.midiOctaveRange;
      const value = this.settings.midiOctaveRange;
      document.getElementById('octaveRangeValue').textContent = value === 0 ? '0 (none)' : `±${value}`;
      midiManager.setOctaveRange(value);
    }

    // Hand size
    const handSizeSelect = document.getElementById('handSize');
    if (handSizeSelect) {
      handSizeSelect.value = this.settings.handSize;
      ergoAnalyzer.setHandSize(this.settings.handSize);
    }

    // Update pattern list
    this.updatePatternList();
  }

  /**
   * Render the grid
   */
  render() {
    debugLog('app', '[APP] render() called');
    this.gridRenderer.setOrientation(this.settings.orientation);
    this.gridRenderer.setLabelMode(this.settings.labelMode);
    this.gridRenderer.setBaseMidi(this.settings.baseMidi);

    // During handprint capture, show no pitch class highlights (plain chromatic grid)
    if (this.handprintMode) {
      this.gridRenderer.setHighlightedPCs(new Set());
      this.gridRenderer.setSpelledNames(null);
    } else {
      this.gridRenderer.setHighlightedPCs(this.getHighlightedPCs());
      this.gridRenderer.setSpelledNames(this.getSpelledNames());
    }

    // During handprint capture, show captured fingers or empty pattern
    if (this.handprintMode) {
      if (this.handprintCaptures.length > 0) {
        const tempPattern = new FingeringPattern('temp_handprint');
        this.handprintCaptures.forEach(cap => {
          tempPattern.setFingering(cap.row, cap.col, this.handprintCaptureHand, cap.finger);
        });
        this.gridRenderer.setFingeringPattern(tempPattern);
      } else {
        // Show empty pattern during capture (no existing fingerings)
        this.gridRenderer.setFingeringPattern(new FingeringPattern('empty'));
      }
    } else {
      this.gridRenderer.setFingeringPattern(this.currentPattern);
    }

    this.gridRenderer.setFingeringMode(this.fingeringMode || this.handprintMode);
    this.gridRenderer.render();
    debugLog('app', '[APP] render() completed');
  }

  /**
   * Get currently highlighted pitch classes
   */
  /** Properly spelled names for the current key/set, or null (chromatic fallback). */
  getSpelledNames() {
    try {
      const key = document.getElementById('key').value;
      const setType = document.getElementById('set').value;
      if (setType === 'custom') return null;
      return getSpelledNoteNames(key, setType);
    } catch {
      return null;
    }
  }

  getHighlightedPCs() {
    const setType = document.getElementById('set').value;
    if (setType === 'custom') {
      const customPC = document.getElementById('customPC').value;
      return parseCustomPitchClasses(customPC);
    } else {
      const key = document.getElementById('key').value;
      return getPitchClasses(key, setType);
    }
  }

  /**
   * Handle fingering click
   */
  handleFingeringClick(row, col) {
    const existing = this.currentPattern.getFingering(row, col);
    if (existing && existing.hand === this.currentHand && existing.finger === this.currentFinger) {
      // Remove if clicking same fingering
      this.currentPattern.removeFingering(row, col);
    } else {
      // Set new fingering
      this.currentPattern.setFingering(row, col, this.currentHand, this.currentFinger);
    }
    this.render();
  }

  /**
   * Update finger button visual state
   */
  updateFingerButtonState() {
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`fingBtn${i}`);
      btn.style.opacity = i === this.currentFinger ? '1' : '0.5';
    }
  }

  /**
   * Suggest fingerings for highlighted notes
   */
  suggestFingerings() {
    const pcs = this.getHighlightedPCs();
    if (pcs.size === 0) {
      alert('No notes highlighted. Please select a key and scale/chord first.');
      return;
    }

    // Get all (row, col) positions for highlighted pads
    const highlightedPads = [];
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < (row % 2 === 0 ? 6 : 5); col++) {
        const padIndex = getPadIndex(row, col); // Use correct grid calculation
        const midiNote = this.settings.baseMidi + padIndex;
        const pc = midiNote % 12;
        if (pcs.has(pc)) {
          highlightedPads.push({ row, col });
        }
      }
    }

    if (highlightedPads.length === 0) {
      alert('No pads match the selected notes in the current range.');
      return;
    }

    // Get selected hand
    const hand = document.getElementById('fingeringHand').value;

    // Get suggestions from ErgoAnalyzer
    const suggestions = ergoAnalyzer.suggestFingerings(highlightedPads, hand, this.settings.baseMidi);

    // Clear existing fingerings for this hand
    const existingPads = this.currentPattern.getPadsForHand(hand);
    existingPads.forEach(pad => {
      this.currentPattern.removeFingering(pad.row, pad.col);
    });

    // Apply suggestions
    suggestions.forEach(suggestion => {
      this.currentPattern.setFingering(
        suggestion.row,
        suggestion.col,
        suggestion.hand,
        suggestion.finger
      );
    });

    this.render();
    alert(`Suggested fingerings for ${suggestions.length} pads (${hand} hand)`);
  }

  /**
   * Save current pattern
   */
  saveCurrentPattern() {
    const name = document.getElementById('patternName').value.trim();
    if (!name) {
      alert('Please enter a pattern name');
      return;
    }

    const patternData = {
      ...this.currentPattern.toJSON(),
      key: document.getElementById('key').value,
      set: document.getElementById('set').value,
      baseMidi: this.settings.baseMidi
    };

    savePattern(name, patternData);
    this.updatePatternList();
    document.getElementById('patternName').value = '';
    alert(`Pattern "${name}" saved!`);
  }

  /**
   * Load pattern by name
   */
  loadPatternByName(name) {
    const patternData = loadPattern(name);
    if (!patternData) {
      alert(`Pattern "${name}" not found`);
      return;
    }

    this.currentPattern = FingeringPattern.fromJSON(patternData);
    document.getElementById('key').value = patternData.key;
    document.getElementById('set').value = patternData.set;
    this.settings.baseMidi = patternData.baseMidi;
    document.getElementById('baseMidi').value = patternData.baseMidi;

    this.render();
  }

  /**
   * Delete current pattern
   */
  deleteCurrentPattern() {
    const name = document.getElementById('loadPattern').value;
    if (!name) {
      alert('Please select a pattern to delete');
      return;
    }

    if (!confirm(`Delete pattern "${name}"?`)) return;

    deletePattern(name);
    this.updatePatternList();
    document.getElementById('loadPattern').value = '';
  }

  /**
   * Export current pattern to JSON file
   */
  exportPattern() {
    if (this.currentPattern.fingerings.size === 0) {
      alert('No fingerings to export. Create a fingering pattern first.');
      return;
    }

    // Update metadata before export
    this.updatePatternMetadata();

    // Update pattern name from input
    const nameInput = document.getElementById('patternName');
    if (nameInput.value.trim()) {
      this.currentPattern.name = nameInput.value.trim();
    }

    // Generate default filename based on metadata if name is "Untitled"
    let filename;
    if (this.currentPattern.name === 'Untitled' || !this.currentPattern.name.trim()) {
      const key = this.currentPattern.metadata.key || 'C';
      const setType = this.currentPattern.metadata.setType || 'major';
      const hand = this.currentHand || 'right';
      // Add timestamp to distinguish multiple attempts at same scale
      const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      filename = `${key}_${setType}_${hand}_${timestamp}`;
    } else {
      filename = this.currentPattern.name;
    }

    // Create JSON blob
    const json = JSON.stringify(this.currentPattern.toJSON(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Exported "${this.currentPattern.name}" to JSON file`);
  }

  /**
   * Import pattern from JSON file
   */
  importPattern(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const pattern = FingeringPattern.fromJSON(json);

        // Load the imported pattern
        this.currentPattern = pattern;
        document.getElementById('patternName').value = pattern.name;

        // Render and update UI
        this.render();
        alert(`Imported "${pattern.name}" with ${pattern.fingerings.size} fingerings`);

        // Reset file input
        event.target.value = '';
      } catch (err) {
        alert(`Error importing file: ${err.message}`);
        console.error('Import error:', err);
      }
    };

    reader.readAsText(file);
  }

  /**
   * Update pattern list dropdown
   */
  updatePatternList() {
    const select = document.getElementById('loadPattern');
    const names = getPatternNames();

    select.innerHTML = '<option value="">-- Select Pattern --</option>';
    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  /**
   * Initialize MIDI
   */
  async initMIDI() {
    try {
      await midiManager.init();
      this.updateMIDIDeviceList();
      this.updateMIDIStatus();
    } catch (err) {
      this.updateMIDIStatus(err.message);
    }
  }

  /**
   * Update MIDI device list
   */
  updateMIDIDeviceList() {
    const select = document.getElementById('midiDevice');
    const devices = midiManager.getOutputDevices();

    select.innerHTML = '<option value="">-- Select device --</option>';
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      select.appendChild(option);
    });

    select.disabled = devices.length === 0;
  }

  /**
   * Update MIDI status display
   */
  updateMIDIStatus(error = null) {
    const status = midiManager.getStatus();
    const statusEl = document.getElementById('midiStatus');

    if (error) {
      statusEl.textContent = `Error: ${error}`;
      statusEl.className = 'error-box';
    } else if (!status.isSupported) {
      statusEl.textContent = 'WebMIDI not supported (use Chrome/Brave/Edge)';
      statusEl.className = 'warning-box';
    } else if (!status.isInitialized) {
      statusEl.textContent = 'MIDI not initialized';
      statusEl.className = 'warning-box';
    } else if (!status.hasDevice) {
      statusEl.textContent = 'MIDI ready - select a device';
      statusEl.className = 'info-box';
    } else {
      statusEl.textContent = `Connected: ${status.deviceName}`;
      statusEl.className = 'success-box';
    }
  }

  /**
   * Send all highlighted notes via MIDI
   */
  sendHighlightedNotes() {
    const pcs = this.getHighlightedPCs();
    const notes = [];

    // Collect all MIDI notes that match the highlighted PCs
    for (let padIndex = 0; padIndex < 39; padIndex++) {
      const midiNote = this.settings.baseMidi + padIndex;
      const pc = midiNote % 12;
      if (pcs.has(pc)) {
        notes.push(midiNote);
      }
    }

    // Send as chord with stagger
    midiManager.playChord(notes, 100, null, 20);
  }

  /**
   * Update pattern metadata with current key and set type
   */
  updatePatternMetadata() {
    const key = document.getElementById('key').value;
    const setType = document.getElementById('set').value;

    this.currentPattern.metadata.key = key;
    this.currentPattern.metadata.setType = setType;
    this.currentPattern.metadata.modifiedAt = Date.now();
  }

  /**
   * Update MIDI hold when PCS changes
   * If hold mode is active, release old notes and play new ones
   */
  updateMIDIHoldIfActive() {
    const holdToggle = document.getElementById('midiHoldToggle');
    if (holdToggle && holdToggle.checked && midiManager.getStatus().isHolding) {
      // Release old notes
      midiManager.releaseAllNotes();
      // Play new highlighted notes
      this.sendHighlightedNotes();
    }
  }

  /**
   * Analyze ergonomics
   */
  analyzeErgonomics() {
    const result = ergoAnalyzer.analyzePattern(this.currentPattern);

    // Display results
    const resultEl = document.getElementById('ergoResult');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="score-display">
          <div class="score-label">Ergonomic Score</div>
          <div class="score-value">${result.score}</div>
          <div class="score-recommendation">${result.recommendation}</div>
        </div>
        ${result.issues.length > 0 ? `
          <h4>Issues Found:</h4>
          <ul class="issue-list">
            ${result.issues.map(issue => `<li class="issue-item">${this.formatIssue(issue)}</li>`).join('')}
          </ul>
        ` : '<div class="success-box">No ergonomic issues found!</div>'}
      `;
    }
  }

  /**
   * Format ergonomic issue for display
   */
  formatIssue(issue) {
    switch (issue.type) {
      case 'excessive_stretch':
        return `Excessive stretch between fingers ${issue.fingers.join(' and ')} (${issue.hand} hand)`;
      case 'uncomfortable_stretch':
        return `Uncomfortable stretch between fingers ${issue.fingers.join(' and ')} (${issue.hand} hand)`;
      case 'finger_crossing':
        return `Possible finger crossing: fingers ${issue.fingers.join(' and ')} (${issue.hand} hand)`;
      default:
        return JSON.stringify(issue);
    }
  }

  /**
   * Select hand for handprint capture
   */
  selectHandForCapture(hand) {
    this.handprintCaptureHand = hand;

    // Update button states
    const leftBtn = document.getElementById('selectLeftHand');
    const rightBtn = document.getElementById('selectRightHand');

    if (hand === 'left') {
      leftBtn?.classList.add('active');
      rightBtn?.classList.remove('active');
    } else {
      rightBtn?.classList.add('active');
      leftBtn?.classList.remove('active');
    }
  }

  /**
   * Start handprint capture session
   * Auto-enables MIDI if not already enabled
   */
  async startHandprintCapture() {
    // If already in handprint mode, stop the session instead
    if (this.handprintMode) {
      this.stopHandprintSession();
      return;
    }

    // Change button immediately to show we're starting
    const startBtn = document.getElementById('startHandprintCapture');
    startBtn.textContent = 'Stop Capture';
    startBtn.style.background = '#c44';

    // Auto-enable MIDI if not enabled
    if (!midiManager.getStatus().isInitialized) {
      try {
        await midiManager.init();
        this.updateMIDIDeviceList();
        this.updateMIDIStatus();

        // Auto-select output device, preferring "Exquis" over others
        const devices = midiManager.getOutputDevices();
        if (devices.length > 0) {
          // Try to find "Exquis" device first
          const exquisDevice = devices.find(d => d.name.toLowerCase().includes('exquis'));
          const selectedDevice = exquisDevice || devices[0];

          midiManager.selectOutputDevice(selectedDevice.id);
          document.getElementById('midiDevice').value = selectedDevice.id;
          this.updateMIDIStatus();
        }
      } catch (err) {
        alert(`Cannot enable MIDI: ${err.message}\n\nFallback: You can click pads on the grid instead.`);
      }
    }

    // Start capture session
    this.handprintMode = true;
    this.handprintCaptureState = 'waiting_basenote'; // Need to calibrate Developer Mode offset
    this.handprintCaptures = [];
    this.handprintSessionBaseMidi = this.settings.baseMidi;
    this.handprintSessionPadOffset = null; // Developer Mode pad ID offset
    this.handprintSessionID = `session_${Date.now()}`;
    this.handprintSessionCount = 0;
    this.lastHandprintNoteTime = 0;  // For debouncing

    // Store original label mode and switch to chromatic (index) display
    this.preCaptureLabelMode = this.settings.labelMode;
    this.settings.labelMode = 'index';

    // Switch grid to chromatic mode (sequential pad numbering)
    setGridMode('chromatic');

    // Enter Exquis Developer Mode (pads send pad IDs on channel 16)
    midiManager.enterExquisDeveloperMode();

    this.render();

    const statusEl = document.getElementById('handprintCaptureStatus');
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:#334; padding:12px; border-radius:4px; margin-top:8px;">
          <strong>Calibration - ${this.handprintCaptureHand.toUpperCase()} hand</strong><br/>
          <strong style="color:#6f6;">Press bottom-left pad (0,0) to calibrate</strong><br/>
          <span style="font-size:0.85em; opacity:0.7;">This sets the reference point for your handprint</span>
          <div style="margin-top:8px; font-size:1.2em; color:#6af;">
            <strong id="handprintCounter">Waiting for calibration...</strong>
          </div>
        </div>
      `;
    }

    // Listen for MIDI input in Developer Mode (channel 16, pad IDs)
    midiManager.setNoteHandler((padID, velocity) => {
      if (this.handprintMode && velocity > 0) {
        // Debounce rapid note events (prevent note on + off triggering twice)
        const now = Date.now();
        if (now - this.lastHandprintNoteTime > 100) {  // 100ms debounce
          this.lastHandprintNoteTime = now;
          this.handleHandprintPadID(padID);
        }
      }
    }, true); // true = Developer Mode
  }

  /**
   * Stop handprint capture session
   */
  stopHandprintSession() {
    const hasCaptures = this.handprintSessionCount > 0;

    // Exit Exquis Developer Mode
    midiManager.exitExquisDeveloperMode();

    // Reset capture state
    this.handprintMode = false;
    this.handprintCaptureState = null;
    this.handprintCaptures = [];
    this.handprintSessionBaseMidi = null;
    this.handprintSessionID = null;
    this.handprintSessionCount = 0;
    midiManager.setNoteHandler(null);

    // Restore original label mode
    if (this.preCaptureLabelMode) {
      this.settings.labelMode = this.preCaptureLabelMode;
      this.preCaptureLabelMode = null;
    }

    // Restore grid to intervals mode (musical thirds layout)
    setGridMode('intervals');

    const statusEl = document.getElementById('handprintCaptureStatus');
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="padding:8px; opacity:0.7;">
          ${hasCaptures ? `Session complete. Captured ${hasCaptures} handprint${hasCaptures > 1 ? 's' : ''}.` : 'Session cancelled.'}
        </div>
      `;

      // Clear message after 2 seconds
      setTimeout(() => {
        statusEl.innerHTML = '';
      }, 2000);
    }

    // Reset button
    const startBtn = document.getElementById('startHandprintCapture');
    startBtn.textContent = 'Start Capture';
    startBtn.style.background = '';

    this.render();
  }

  /**
   * Handle pad ID from Developer Mode (0-60)
   */
  handleHandprintPadID(padID) {
    // Calibration step: establish offset
    if (this.handprintCaptureState === 'waiting_basenote') {
      // User pressed pad 0,0 - record the offset
      this.handprintSessionPadOffset = padID;
      this.handprintCaptureState = 'capturing_fingers';

      debugLog('handprint', `[HANDPRINT] Developer Mode calibrated: pad 0,0 has ID ${padID}`);

      const statusEl = document.getElementById('handprintCaptureStatus');
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="background:#334; padding:12px; border-radius:4px; margin-top:8px;">
            <strong>Capture Active - ${this.handprintCaptureHand.toUpperCase()} hand</strong><br/>
            <strong style="color:#6f6;">Press 5 fingers in order 👍 1 → 2 → 3 → 4 → 5 🤙</strong>
            <div style="margin-top:8px; font-size:1.2em; color:#6af;">
              <strong id="handprintCounter">Captured: 0/5</strong>
            </div>
          </div>
        `;
      }

      this.render();
      return;
    }

    if (this.handprintCaptureState !== 'capturing_fingers') return;
    if (this.handprintCaptures.length >= 5) return;

    // Apply offset to get actual pad index
    const actualPadIndex = padID - this.handprintSessionPadOffset;

    // Check if this pad has already been captured
    if (this.handprintCaptures.some(cap => cap.padIndex === actualPadIndex)) {
      console.log('Ignoring duplicate pad:', actualPadIndex);
      return;
    }

    // Convert to (row, col) using chromatic grid logic
    try {
      const { row, col } = getRowCol(actualPadIndex);
      const midiNote = this.handprintSessionBaseMidi + actualPadIndex;

      this.handprintCaptures.push({
        row,
        col,
        padIndex: actualPadIndex,
        midiNote,
        finger: this.handprintCaptures.length + 1,
        timestamp: Date.now()
      });

      // Update counter
      const counterEl = document.getElementById('handprintCounter');
      if (counterEl) {
        counterEl.textContent = `Captured: ${this.handprintCaptures.length}/5`;
      }

      // Visual feedback on grid (show numbered fingers)
      this.render();

      if (this.handprintCaptures.length === 5) {
        this.finishHandprintCapture();
      }
    } catch (err) {
      console.error('Invalid pad index:', actualPadIndex, 'from pad ID:', padID, err);
    }
  }

  /**
   * Handle pad click during handprint capture (fallback if no MIDI/Developer Mode)
   */
  handleHandprintClick(row, col) {
    if (this.handprintCaptureState !== 'capturing_fingers') return;
    if (this.handprintCaptures.length >= 5) return;

    const padIndex = getPadIndex(row, col);

    // Check if this pad has already been captured
    if (this.handprintCaptures.some(cap => cap.padIndex === padIndex)) {
      console.log('Ignoring duplicate pad click:', padIndex);
      return;
    }

    const midiNote = this.handprintSessionBaseMidi + padIndex;

    this.handprintCaptures.push({
      row,
      col,
      padIndex,
      midiNote,
      finger: this.handprintCaptures.length + 1,
      timestamp: Date.now()
    });

    // Update counter
    const counterEl = document.getElementById('handprintCounter');
    if (counterEl) {
      counterEl.textContent = `Captured: ${this.handprintCaptures.length}/5 (click)`;
    }

    // Visual feedback on grid (show numbered fingers)
    this.render();

    if (this.handprintCaptures.length === 5) {
      this.finishHandprintCapture();
    }
  }

  /**
   * Complete handprint capture and ask for comfort rating
   */
  finishHandprintCapture() {
    this.handprintCaptureState = 'rating';

    // Show comfort rating UI
    const statusEl = document.getElementById('handprintCaptureStatus');
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:#243; padding:12px; border-radius:4px; margin-top:8px;">
          <strong>Handprint Captured!</strong><br/>
          How comfortable was this position?
          <div style="margin-top:12px;">
            <input type="range" id="comfortRating" min="0" max="100" value="100"
                   style="width:100%;" />
            <div style="display:flex; justify-content:space-between; font-size:0.85em; opacity:0.7;">
              <span>Uncomfortable</span>
              <span id="comfortValue">100</span>
              <span>Very Comfortable</span>
            </div>
          </div>
          <button id="saveHandprintWithRating" style="width:100%; margin-top:12px; background:#4a6;">
            Save Handprint
          </button>
          <button id="discardHandprint" style="width:100%; margin-top:4px; background:#666;">
            Discard
          </button>
        </div>
      `;

      // Update comfort value display
      const slider = document.getElementById('comfortRating');
      const valueDisplay = document.getElementById('comfortValue');
      slider?.addEventListener('input', (e) => {
        valueDisplay.textContent = e.target.value;
      });

      // Save button
      document.getElementById('saveHandprintWithRating')?.addEventListener('click', () => {
        const comfort = parseInt(slider?.value || '100');
        this.saveHandprint(comfort);
      });

      // Discard button
      document.getElementById('discardHandprint')?.addEventListener('click', () => {
        this.discardHandprint();
      });
    }

    // NOTE: Don't reset button here - we're still in the capture session!
    // The button should stay "Stop Capture" until stopHandprintSession() is called.

    this.render();
  }

  /**
   * Save handprint with comfort rating
   */
  saveHandprint(comfortRating) {
    // Calculate all finger-pair distances
    const measurements = {};
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const pad1 = this.handprintCaptures[i];
        const pad2 = this.handprintCaptures[j];
        const distance = Math.sqrt(
          Math.pow(pad2.row - pad1.row, 2) + Math.pow(pad2.col - pad1.col, 2)
        );
        const key = `${i + 1}-${j + 1}`;
        measurements[key] = distance;
      }
    }

    // Get MIDI device name
    const midiStatus = midiManager.getStatus();
    const deviceName = midiStatus.deviceName || 'Unknown';

    // Create handprint with unique ID and complete metadata
    const handprintID = `${this.handprintCaptureHand}_${Date.now()}`;
    const handprint = {
      id: handprintID,
      sessionID: this.handprintSessionID,
      hand: this.handprintCaptureHand,
      orientation: this.settings.orientation,
      baseMidi: this.handprintSessionBaseMidi,
      midiDevice: deviceName,
      comfortRating,
      positions: this.handprintCaptures,
      measurements,
      capturedAt: Date.now()
    };

    // Save to settings immediately
    this.savedHandprints.push(handprint);
    this.settings.handprints = this.savedHandprints;
    saveSettings(this.settings);

    // Increment session count
    this.handprintSessionCount++;

    // Update UI
    this.updateHandprintList();

    const statusEl = document.getElementById('handprintCaptureStatus');
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:#243; padding:12px; border-radius:4px; margin-top:8px; color:#6f6;">
          ✓ Handprint ${this.handprintSessionCount} Saved!<br/>
          <strong>Comfort:</strong> ${comfortRating}/100<br/>
          <strong>Session total:</strong> ${this.handprintSessionCount} handprint(s)
          <div style="margin-top:8px; border-top:1px solid #444; padding-top:8px;">
            Press another pad to capture next handprint,<br/>
            or click "Stop Capture" to finish.
          </div>
        </div>
      `;
    }

    // Clear captures and prepare for next handprint (reuse basenote)
    this.handprintCaptures = [];
    this.handprintCaptureState = 'capturing_fingers';

    // Update counter for next capture
    const counterEl = document.getElementById('handprintCounter');
    if (counterEl) {
      counterEl.textContent = `Captured: 0/5`;
    }

    this.render();
  }

  /**
   * Discard captured handprint and continue session
   */
  discardHandprint() {
    this.handprintCaptures = [];
    this.handprintCaptureState = 'capturing_fingers';

    const statusEl = document.getElementById('handprintCaptureStatus');
    if (statusEl) {
      // Show the active capture UI again (session still active)
      statusEl.innerHTML = `
        <div style="background:#334; padding:12px; border-radius:4px; margin-top:8px;">
          <strong>Capture Active - ${this.handprintCaptureHand.toUpperCase()} hand</strong><br/>
          <strong style="color:#6f6;">Press 5 fingers in order 👍 1 → 2 → 3 → 4 → 5 🤙</strong>
          <div style="margin-top:8px; font-size:1.2em; color:#6af;">
            <strong id="handprintCounter">Captured: 0/5</strong>
          </div>
          <div style="margin-top:8px; padding-top:8px; border-top:1px solid #444; font-size:0.9em; opacity:0.7;">
            Previous handprint discarded. Ready for next capture.
          </div>
        </div>
      `;
    }

    this.render();
  }

  /**
   * Update handprint list display
   */
  updateHandprintList() {
    const listEl = document.getElementById('handprintList');
    const exportBtn = document.getElementById('exportHandprints');
    const clearBtn = document.getElementById('clearHandprints');

    if (this.savedHandprints.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.7;">No handprints captured yet.</div>';
      exportBtn.style.display = 'none';
      clearBtn.style.display = 'none';
      return;
    }

    listEl.innerHTML = this.savedHandprints.map(hp => {
      const date = new Date(hp.capturedAt);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const comfort = hp.comfortRating || '?';
      return `
        <div class="handprint-item ${hp.hand}">
          <strong>${hp.hand.toUpperCase()}</strong> | Comfort: ${comfort}/100<br/>
          <span style="font-size:0.85em; opacity:0.7;">MIDI ${hp.baseMidi} | ${hp.orientation} | ${timeStr}</span>
        </div>
      `;
    }).join('');

    exportBtn.style.display = 'block';
    clearBtn.style.display = 'block';
  }

  /**
   * Clear all saved handprints
   */
  clearAllHandprints() {
    if (!confirm(`Clear all ${this.savedHandprints.length} handprint(s)?\n\nThis cannot be undone!`)) {
      return;
    }

    this.savedHandprints = [];
    this.settings.handprints = [];
    saveSettings(this.settings);

    this.updateHandprintList();
    alert('All handprints cleared.');
  }

  /**
   * Export all handprints to JSON
   */
  exportHandprints() {
    if (this.savedHandprints.length === 0) {
      alert('No handprints to export.');
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      handprints: this.savedHandprints
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `handprints_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Exported ${this.savedHandprints.length} handprint(s) to JSON file.`);
  }

  /**
   * Find chord fingering suggestions based on selected notes
   */
  findChordFingeringSuggestions() {
    // Get selected chord notes
    const selectedNotes = [];
    document.querySelectorAll('input[name="chordNote"]:checked').forEach(checkbox => {
      selectedNotes.push(parseInt(checkbox.value));
    });

    // Validate input
    if (selectedNotes.length < 3) {
      const statusEl = document.getElementById('chordSuggestionsStatus');
      statusEl.innerHTML = `
        <div class="warning-box" style="margin-top:8px;">
          Please select at least 3 notes for a chord.
        </div>
      `;
      return;
    }

    if (selectedNotes.length > 5) {
      const statusEl = document.getElementById('chordSuggestionsStatus');
      statusEl.innerHTML = `
        <div class="warning-box" style="margin-top:8px;">
          Please select no more than 5 notes for block chords.
        </div>
      `;
      return;
    }

    // Check if we have handprints
    if (this.savedHandprints.length === 0) {
      const statusEl = document.getElementById('chordSuggestionsStatus');
      statusEl.innerHTML = `
        <div class="warning-box" style="margin-top:8px;">
          No handprints available. Please capture some handprints first.
        </div>
      `;
      return;
    }

    // Find matching fingerings
    const matches = findChordFingerings(
      selectedNotes,
      this.savedHandprints,
      this.settings.baseMidi
    );

    if (matches.length === 0) {
      const statusEl = document.getElementById('chordSuggestionsStatus');
      statusEl.innerHTML = `
        <div class="info-box" style="margin-top:8px;">
          No matching fingerings found in your handprints.
          Try capturing more handprint positions.
        </div>
      `;
      document.getElementById('chordSuggestions').style.display = 'none';
      return;
    }

    // Rank by score
    const ranked = rankFingerings(matches);

    // Display suggestions
    this.displayChordSuggestions(ranked, selectedNotes);
  }

  /**
   * Display chord fingering suggestions
   */
  displayChordSuggestions(fingerings, targetNotes) {
    const statusEl = document.getElementById('chordSuggestionsStatus');
    const suggestionsEl = document.getElementById('chordSuggestions');
    const listEl = document.getElementById('suggestionsList');

    // Show success message
    statusEl.innerHTML = `
      <div class="success-box" style="margin-top:8px;">
        Found ${fingerings.length} matching fingering${fingerings.length > 1 ? 's' : ''}!
      </div>
    `;

    // Show top 5 suggestions
    const topSuggestions = fingerings.slice(0, 5);

    listEl.innerHTML = topSuggestions.map((fingering, index) => {
      const fingerList = fingering.positions
        .sort((a, b) => a.finger - b.finger)
        .map(p => `F${p.finger}`)
        .join('-');

      const noteList = [...new Set(fingering.positions.map(p => p.pitchClass))]
        .sort((a, b) => a - b)
        .map(pc => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pc])
        .join('-');

      return `
        <div class="suggestion-item" style="
          background: ${index === 0 ? '#eef' : '#f5f5f5'};
          border: 2px solid ${index === 0 ? '#6aa5ff' : '#ddd'};
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: pointer;
        " data-suggestion-index="${index}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:#446; font-size:1.1em;">#${index + 1} ${noteList}</strong>
            <span style="background:#446; color:#fff; padding:4px 8px; border-radius:12px; font-size:0.9em; font-weight:bold;">
              ${fingering.score}
            </span>
          </div>
          <div style="font-size:0.85em; opacity:0.8; margin-bottom:4px;">
            Fingers: ${fingerList} (${fingering.hand} hand)
          </div>
          <div style="display:flex; gap:8px; font-size:0.75em; opacity:0.7;">
            <span title="Comfort">💆 ${fingering.comfortScore}</span>
            <span title="Geometry">📐 ${fingering.geometricScore}</span>
            <span title="Ergonomics">✋ ${fingering.ergonomicScore}</span>
          </div>
          ${index === 0 ? '<div style="margin-top:8px; font-size:0.85em; color:#446;">⭐ Best match - Click to view on grid</div>' : ''}
        </div>
      `;
    }).join('');

    // Add click handlers
    listEl.querySelectorAll('.suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.showSuggestionOnGrid(topSuggestions[index]);
      });
    });

    suggestionsEl.style.display = 'block';
  }

  /**
   * Show a fingering suggestion on the grid
   */
  showSuggestionOnGrid(fingering) {
    // Create a temporary fingering pattern
    const pattern = new FingeringPattern('chord_suggestion');

    fingering.positions.forEach(pos => {
      pattern.setFingering(pos.row, pos.col, fingering.hand, pos.finger);
    });

    // Update current pattern and render
    this.currentPattern = pattern;
    this.render();

    // Highlight the notes
    const pitchClasses = new Set(fingering.positions.map(p => p.pitchClass));
    this.gridRenderer.setHighlightedPCs(pitchClasses);
    this.gridRenderer.render();

    // Show feedback
    const statusEl = document.getElementById('chordSuggestionsStatus');
    statusEl.innerHTML = `
      <div class="success-box" style="margin-top:8px;">
        ✓ Showing suggestion on grid. Click "Find Fingerings" to see other options.
      </div>
    `;
  }

  /**
   * Generate chord fingering suggestion using synthesis
   */
  generateChordSuggestion() {
    // Get target pitch classes from selected key/set
    const pcs = this.getHighlightedPCs();
    if (pcs.size === 0) {
      alert('No chord selected. Please select a key and chord type first.');
      return;
    }

    const targetPitchClasses = Array.from(pcs);

    // Check if we have handprints
    if (this.savedHandprints.length === 0) {
      alert('No handprints available. Please capture some handprints first.');
      return;
    }

    // Get selected hand
    const hand = document.getElementById('suggestionHand').value;

    // Generate suggestions
    const suggestions = synthesizeFingerings(
      targetPitchClasses,
      this.savedHandprints,
      this.settings.baseMidi,
      hand,
      10 // Generate up to 10 suggestions
    );

    if (suggestions.length === 0) {
      alert('Could not generate suggestions for this chord. Try a different range or capture more handprints.');
      return;
    }

    // Store suggestions
    this.currentSuggestions = suggestions;
    this.currentSuggestionIndex = 0;

    // Display first suggestion
    this.displayCurrentSuggestion();
  }

  /**
   * Display the current suggestion
   */
  displayCurrentSuggestion() {
    if (this.currentSuggestions.length === 0) return;

    const suggestion = this.currentSuggestions[this.currentSuggestionIndex];

    // Create pattern from suggestion
    const pattern = new FingeringPattern('synthesized_suggestion');
    suggestion.positions.forEach(pos => {
      pattern.setFingering(pos.row, pos.col, suggestion.hand, pos.finger);
    });

    // Update current pattern and render
    this.currentPattern = pattern;
    this.render();

    // Highlight the chord notes
    const pitchClasses = new Set(suggestion.targetPitchClasses);
    this.gridRenderer.setHighlightedPCs(pitchClasses);
    this.gridRenderer.render();

    // Update suggestion display
    const displayEl = document.getElementById('suggestionDisplay');
    const noteNames = suggestion.targetPitchClasses
      .sort((a, b) => a - b)
      .map(pc => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pc])
      .join('-');

    const fingerList = suggestion.positions
      .sort((a, b) => a.finger - b.finger)
      .map(p => {
        const padKey = `${p.row},${p.col}`;
        return `
          <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
            <span style="font-weight:bold;">Finger ${p.finger}:</span>
            <span>r${p.row}c${p.col}</span>
            <button class="change-finger-btn" data-row="${p.row}" data-col="${p.col}" data-current-finger="${p.finger}"
              style="padding:2px 8px; background:#446; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:0.8em;">
              Change
            </button>
          </div>
        `;
      })
      .join('');

    displayEl.innerHTML = `
      <div style="margin-bottom:8px;">
        <strong style="color:#446;">${noteNames}</strong> (${suggestion.hand} hand)
      </div>
      <div style="font-size:0.85em;">
        ${fingerList}
      </div>
      <div style="margin-top:8px; font-size:0.85em; opacity:0.7;">
        Suggestion ${this.currentSuggestionIndex + 1} of ${this.currentSuggestions.length}
        • Score: ${Math.round(suggestion.score)}
      </div>
    `;

    // Add click handlers for change buttons
    displayEl.querySelectorAll('.change-finger-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = parseInt(btn.dataset.row);
        const col = parseInt(btn.dataset.col);
        const currentFinger = parseInt(btn.dataset.currentFinger);
        this.showFingerSelector(row, col, currentFinger);
      });
    });

    // Show the suggestion UI
    document.getElementById('currentSuggestion').style.display = 'block';
  }

  /**
   * Show next suggestion
   */
  showNextSuggestion() {
    if (this.currentSuggestions.length === 0) return;

    this.currentSuggestionIndex = (this.currentSuggestionIndex + 1) % this.currentSuggestions.length;
    this.displayCurrentSuggestion();
  }

  /**
   * Save current suggestion as a pattern
   */
  saveSuggestionAsPattern() {
    if (this.currentSuggestions.length === 0) return;

    const suggestion = this.currentSuggestions[this.currentSuggestionIndex];

    // Get chord name from key/set
    const key = document.getElementById('key').value;
    const setType = document.getElementById('set').value;
    const setName = document.querySelector(`#set option[value="${setType}"]`).textContent;
    const patternName = `${key} ${setName}`;

    // Create pattern
    const pattern = new FingeringPattern(patternName);
    suggestion.positions.forEach(pos => {
      pattern.setFingering(pos.row, pos.col, suggestion.hand, pos.finger);
    });

    // Add metadata
    pattern.metadata = {
      key,
      setType,
      baseMidi: this.settings.baseMidi,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      comfortRating: this.currentSuggestionRating,
      synthesized: true,
      hand: suggestion.hand
    };

    // Save pattern
    const patternData = {
      ...pattern.toJSON(),
      ...pattern.metadata
    };

    const patterns = JSON.parse(localStorage.getItem('fingeringPatterns') || '{}');
    patterns[patternName] = patternData;
    localStorage.setItem('fingeringPatterns', JSON.stringify(patterns));

    // Update pattern list
    this.updatePatternList();

    // Show feedback
    alert(`Saved as "${patternName}" with comfort rating ${this.currentSuggestionRating}/5`);
  }

  /**
   * Show finger selector dialog for a pad
   */
  showFingerSelector(row, col, currentFinger) {
    // Get all fingers used in current suggestion
    const suggestion = this.currentSuggestions[this.currentSuggestionIndex];
    const usedFingers = new Set(suggestion.positions.map(p => p.finger));

    // Remove current finger from used set (since we're changing it)
    usedFingers.delete(currentFinger);

    // Create finger selector buttons
    const buttons = [];
    for (let f = 1; f <= 5; f++) {
      const isUsed = usedFingers.has(f);
      const isCurrent = f === currentFinger;
      const label = isCurrent ? `${f} (current)` : isUsed ? `${f} (used)` : `${f}`;
      const disabled = isUsed ? 'disabled' : '';
      const style = isCurrent ? 'background:#6aa5ff;' : isUsed ? 'opacity:0.3;' : '';

      buttons.push(`
        <button onclick="window.app.changeSuggestionFinger(${row}, ${col}, ${f})"
          ${disabled}
          style="padding:12px 20px; margin:4px; font-size:1.2em; cursor:pointer; border:2px solid #446; border-radius:4px; ${style}">
          ${label}
        </button>
      `);
    }

    // Show modal dialog
    const modal = document.createElement('div');
    modal.id = 'fingerSelectorModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="background:#fff; padding:24px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); max-width:400px;">
        <h3 style="margin:0 0 16px 0; color:#446;">Select Finger for r${row}c${col}</h3>
        <div style="display:flex; flex-wrap:wrap; justify-content:center;">
          ${buttons.join('')}
        </div>
        <button onclick="document.getElementById('fingerSelectorModal').remove()"
          style="width:100%; margin-top:16px; padding:8px; background:#666; color:#fff; border:none; border-radius:4px; cursor:pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Change finger assignment for a pad in current suggestion
   */
  changeSuggestionFinger(row, col, newFinger) {
    if (this.currentSuggestions.length === 0) return;

    const suggestion = this.currentSuggestions[this.currentSuggestionIndex];

    // Find the position to update
    const posIndex = suggestion.positions.findIndex(p => p.row === row && p.col === col);
    if (posIndex === -1) return;

    // Check if new finger is already used
    const fingerUsed = suggestion.positions.some((p, i) => i !== posIndex && p.finger === newFinger);
    if (fingerUsed) {
      alert(`Finger ${newFinger} is already assigned to another pad. Please choose a different finger.`);
      return;
    }

    // Update the finger
    suggestion.positions[posIndex].finger = newFinger;

    // Close modal
    document.getElementById('fingerSelectorModal')?.remove();

    // Refresh display
    this.displayCurrentSuggestion();
  }

  /**
   * Handle suggestion edit click (not currently used, but kept for potential alternative approach)
   */
  handleSuggestionEditClick(row, col) {
    // This could be used for a click-on-grid editing mode
    // Currently we use the Change buttons instead
    if (this.currentSuggestions.length === 0) return;

    const suggestion = this.currentSuggestions[this.currentSuggestionIndex];
    const pos = suggestion.positions.find(p => p.row === row && p.col === col);

    if (pos) {
      this.showFingerSelector(row, col, pos.finger);
    }
  }

  /**
   * Select hand for chord capture
   */
  selectChordCaptureHand(hand) {
    this.chordCaptureHand = hand;

    // Update UI
    document.getElementById('captureLeftHand').classList.toggle('active', hand === 'left');
    document.getElementById('captureRightHand').classList.toggle('active', hand === 'right');
  }

  /**
   * Start chord fingering capture
   */
  async startChordCapture() {
    // Get chord from selectors
    const rootPC = parseInt(document.getElementById('chordRoot').value);
    const quality = document.getElementById('chordQuality').value;

    // Get pitch classes for this chord
    const pitchClasses = getChordPitchClasses(rootPC, quality);
    const chordName = getChordName(rootPC, quality);

    this.chordCaptureRoot = rootPC;
    this.chordCaptureQuality = quality;
    this.chordCapturePitchClasses = pitchClasses;
    this.chordCaptureSequence = [];

    // Auto-enable MIDI if not enabled (same as handprint capture)
    if (!midiManager.getStatus().isInitialized) {
      try {
        await midiManager.init();
        this.updateMIDIDeviceList();
        this.updateMIDIStatus();

        // Auto-select output device, preferring "Exquis" over others
        const devices = midiManager.getOutputDevices();
        if (devices.length > 0) {
          // Try to find "Exquis" device first
          const exquisDevice = devices.find(d => d.name.toLowerCase().includes('exquis'));
          const selectedDevice = exquisDevice || devices[0];

          midiManager.selectOutputDevice(selectedDevice.id);
          document.getElementById('midiDevice').value = selectedDevice.id;
          this.updateMIDIStatus();

          console.log('[ChordCapture] Auto-selected MIDI device:', selectedDevice.name);
        }
      } catch (err) {
        alert(`Cannot enable MIDI: ${err.message}`);
        return;
      }
    }

    // Check if device is selected (Fix #1)
    if (!midiManager.selectedOutput) {
      alert('Please select a MIDI output device first.');
      return;
    }

    // Get dev mode instance
    const devMode = midiManager.getDevMode();
    console.log('[ChordCapture] Dev mode instance:', devMode);

    // Set flag BEFORE entering dev mode to prevent timing issues
    this.chordCaptureActive = true;

    // Enter dev mode (pads only)
    try {
      await devMode.enter(0x01); // ZONE_MASK.PADS
      console.log('[ChordCapture] Entered dev mode');

      // Highlight chord across entire grid
      devMode.highlightChord(pitchClasses, rootPC, 0, 0);
      console.log('[ChordCapture] Highlighted chord:', chordName, 'PCs:', pitchClasses);

      // Set up pad event handler
      devMode.on('padPress', (padId, velocity) => {
        console.log('[ChordCapture] Pad press event:', padId, velocity);
        this.handleChordCapturePadPress(padId, velocity);
      });

      // Enable MIDI input in developer mode
      // Pass empty handler - MIDI manager will route dev mode messages automatically
      midiManager.setNoteHandler(() => {}, true); // true = Developer Mode
      console.log('[ChordCapture] Enabled MIDI input handler for dev mode');

      // Update UI
      document.getElementById('chordCaptureStatus').innerHTML = `
        <div class="success-box">
          ✓ Capturing ${chordName} - Press pads in finger sequence (1→5)
        </div>
      `;
      document.getElementById('chordCaptureActive').style.display = 'block';
      this.updateCaptureProgress();

    } catch (err) {
      this.chordCaptureActive = false;
      alert(`Failed to enter developer mode: ${err.message}`);
      console.error('Dev mode error:', err);
    }
  }

  /**
   * Handle pad press during chord capture
   */
  handleChordCapturePadPress(padId, velocity) {
    console.log('[ChordCapture] handleChordCapturePadPress called:', { padId, velocity, active: this.chordCaptureActive });

    if (!this.chordCaptureActive) {
      console.log('[ChordCapture] Ignoring pad press - capture not active');
      return;
    }

    // Get current finger number (sequence length + 1)
    const fingerNum = this.chordCaptureSequence.length + 1;

    if (fingerNum > 5) {
      // Already captured 5 fingers, ignore
      console.log('[ChordCapture] Ignoring pad press - already have 5 fingers');
      return;
    }

    // Record this pad
    this.chordCaptureSequence.push({
      padId: padId,
      finger: fingerNum,
      timestamp: Date.now(),
      velocity: velocity
    });

    console.log('[ChordCapture] Recorded pad press - finger', fingerNum, 'at pad', padId);

    // Update progress
    this.updateCaptureProgress();

    // If we've captured 5 fingers (or user stops early), move to rating
    if (this.chordCaptureSequence.length >= 5) {
      console.log('[ChordCapture] Captured all 5 fingers, stopping...');
      setTimeout(() => {
        this.stopChordCapture();
      }, 300);
    }
  }

  /**
   * Update capture progress display
   */
  updateCaptureProgress() {
    const progress = document.getElementById('captureProgress');
    const captured = this.chordCaptureSequence.length;
    const fingers = this.chordCaptureSequence.map(p => `F${p.finger}:Pad${p.padId}`).join(', ');

    progress.innerHTML = `
      Captured: ${captured}/5 fingers<br>
      ${fingers || 'Press first pad with finger 1...'}
    `;
  }

  /**
   * Stop chord capture
   */
  async stopChordCapture() {
    if (!this.chordCaptureActive) return;

    // Exit dev mode
    const devMode = midiManager.getDevMode();
    await devMode.exit();

    // Disable MIDI handler
    midiManager.setNoteHandler(null, false);

    this.chordCaptureActive = false;

    // If we have at least 3 fingers, show rating UI
    if (this.chordCaptureSequence.length >= 3) {
      this.showChordCaptureRating();
    } else {
      // Not enough fingers, just clear
      document.getElementById('chordCaptureStatus').innerHTML = `
        <div class="warning-box">
          Capture stopped. Need at least 3 fingers for a valid fingering.
        </div>
      `;
      document.getElementById('chordCaptureActive').style.display = 'none';
      this.chordCaptureSequence = [];
    }
  }

  /**
   * Show rating UI for captured fingering
   */
  showChordCaptureRating() {
    document.getElementById('chordCaptureActive').style.display = 'none';

    // Filter to only chord tones (remove skips)
    const chordTones = this.chordCaptureSequence.filter(pad => {
      const pc = pad.padId % 12; // Simplified - assumes pad IDs map directly to pitch classes
      return this.chordCapturePitchClasses.includes(pc);
    });

    // Display fingering
    const display = document.getElementById('capturedFingeringDisplay');
    const chordName = getChordName(this.chordCaptureRoot, this.chordCaptureQuality);

    display.innerHTML = `
      <strong>${chordName}</strong> (${this.chordCaptureHand} hand)<br>
      ${this.chordCaptureSequence.map(p => {
        const isChordTone = this.chordCapturePitchClasses.includes(p.padId % 12);
        const label = isChordTone ? `Finger ${p.finger}: Pad ${p.padId}` : `Finger ${p.finger}: SKIP (Pad ${p.padId})`;
        return `<div style="opacity:${isChordTone ? 1 : 0.5}">${label}</div>`;
      }).join('')}
    `;

    document.getElementById('chordCaptureRate').style.display = 'block';
  }

  /**
   * Save captured chord fingering
   */
  saveChordFingering() {
    const comfort = parseInt(document.getElementById('captureComfort').value);

    // Convert pad IDs to MIDI notes (assuming intervals mode)
    const positions = this.chordCaptureSequence.map(pad => ({
      padId: pad.padId,
      finger: pad.finger,
      // We'll analyze MIDI notes based on pad positions
      timestamp: pad.timestamp
    }));

    const fingering = {
      id: `chord_${Date.now()}`,
      chordRoot: this.chordCaptureRoot,
      chordQuality: this.chordCaptureQuality,
      pitchClasses: this.chordCapturePitchClasses,
      hand: this.chordCaptureHand,
      positions: positions,
      comfortRating: comfort,
      capturedAt: Date.now()
    };

    // Save to storage
    this.savedChordFingerings.push(fingering);
    this.settings.chordFingerings = this.savedChordFingerings;
    saveSettings(this.settings);

    // Show success
    const chordName = getChordName(this.chordCaptureRoot, this.chordCaptureQuality);
    document.getElementById('chordCaptureStatus').innerHTML = `
      <div class="success-box">
        ✓ Saved ${chordName} fingering (comfort: ${comfort}/5)
      </div>
    `;

    // Clear UI
    document.getElementById('chordCaptureRate').style.display = 'none';
    this.chordCaptureSequence = [];

    // Update list
    this.updateChordFingeringList();
  }

  /**
   * Discard captured chord fingering
   */
  discardChordFingering() {
    document.getElementById('chordCaptureRate').style.display = 'none';
    document.getElementById('chordCaptureStatus').innerHTML = '';
    this.chordCaptureSequence = [];
  }

  /**
   * Update chord fingering list display
   */
  updateChordFingeringList() {
    const listEl = document.getElementById('chordFingeringList');

    if (this.savedChordFingerings.length === 0) {
      listEl.innerHTML = '<div style="opacity:0.7;">No chord fingerings captured yet.</div>';
      document.getElementById('exportChordFingerings').style.display = 'none';
      document.getElementById('clearChordFingerings').style.display = 'none';
      return;
    }

    listEl.innerHTML = this.savedChordFingerings.map((f, index) => {
      const chordName = getChordName(f.chordRoot, f.chordQuality);
      return `
        <div style="padding:6px; background:#f5f5f5; border-radius:3px; margin-bottom:4px;">
          <strong>${chordName}</strong> (${f.hand})<br>
          <span style="font-size:0.85em;">
            ${f.positions.length} fingers • Comfort: ${f.comfortRating}/5
          </span>
        </div>
      `;
    }).join('');

    document.getElementById('exportChordFingerings').style.display = 'block';
    document.getElementById('clearChordFingerings').style.display = 'block';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ExquisFingerings();
});
