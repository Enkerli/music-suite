import { useState, useCallback, useRef, useEffect } from 'react';
import { PlaybackEngine } from '../lib/playback';
import type { PlaybackState } from '../lib/playback';
import type { Clip } from '../types/clip';
import { IN_PLUGIN, bridge } from '../lib/juce-bridge';
import { clipToHostClip } from '../lib/host-clip';
import {
  midiSupported, startMidiOut, outputs as listMidiOutputs, selectOutput,
  selectedOutputId, onDevices, midiSink,
} from '../lib/webmidi-out';

/** Standalone MIDI-output selector state (absent in the plugin). */
export interface MidiOutUi {
  outputs: { id: string; name: string }[];
  selectedId: string | null;
  error: string;
  select: (id: string | null) => void;
}

export interface UsePlaybackReturn {
  playbackState: PlaybackState;
  currentTime: number;
  play: (clip: Clip) => void;
  pause: () => void;
  stop: () => void;
  toggle: (clip: Clip) => void;
  /** Present only in the standalone webapp with Web MIDI available. */
  midi?: MidiOutUi;
}

const MIDI_OUT_KEY = 'midicurator.midi-out-name';

/**
 * Plugin variant: "play" loads the clip into the C++ MidiClipScheduler,
 * looped and host-synced — the host's play button is the play button
 * (suite doctrine; same as Progression Studio). "playing" therefore means
 * "armed in the host", and there is no in-page WebAudio preview.
 */
function useHostPlayback(): UsePlaybackReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  // bpm of the armed clip: the playhead maps seconds → ticks with the
  // clip's own bpm, so clipBeat * 60 / bpm lands on the right tick no
  // matter what tempo the host runs at.
  const armedRef = useRef<{ id: string; bpm: number } | null>(null);

  // The editor streams transport { bpm, playing, beat } at 10 Hz, with
  // beat = the scheduler's clip-relative (loop-wrapped) position.
  useEffect(() => {
    return bridge.on('transport', (data) => {
      const armed = armedRef.current;
      if (!armed) return;
      const { playing, beat } = (data ?? {}) as { playing?: boolean; beat?: number };
      setPlaybackState(playing ? 'playing' : 'paused');
      if (playing && typeof beat === 'number')
        setCurrentTime((beat * 60) / armed.bpm);
    });
  }, []);

  const play = useCallback((clip: Clip) => {
    const { notes, lengthBeats } = clipToHostClip(clip);
    bridge.setClip(notes, lengthBeats, true);
    armedRef.current = { id: clip.id, bpm: clip.bpm || 120 };
    setPlaybackState('paused'); // armed; the next transport tick refines it
  }, []);

  const stop = useCallback(() => {
    bridge.clearClip();
    armedRef.current = null;
    setPlaybackState('stopped');
    setCurrentTime(0);
  }, []);

  const toggle = useCallback(
    (clip: Clip) => {
      if (armedRef.current?.id === clip.id) stop();
      else play(clip);
    },
    [play, stop],
  );

  return { playbackState, currentTime, play, pause: stop, stop, toggle };
}

function useWebAudioPlayback(): UsePlaybackReturn {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTime, setCurrentTime] = useState(0);
  const activeClipIdRef = useRef<string | null>(null);

  // MIDI-out selector state (standalone only).
  const [midiOuts, setMidiOuts] = useState<{ id: string; name: string }[]>([]);
  const [midiSelId, setMidiSelId] = useState<string | null>(null);
  const [midiError, setMidiError] = useState('');

  // Initialize engine once; give it the MIDI sink so a selected port takes
  // over from the oscillators automatically.
  useEffect(() => {
    const engine = new PlaybackEngine();
    engine.setListener((state, time) => {
      setPlaybackState(state);
      setCurrentTime(time);
    });
    engine.setMidiOut(midiSink);
    engineRef.current = engine;

    return () => {
      engine.dispose();
    };
  }, []);

  // Enable Web MIDI output and track ports (hot-plug + remember-by-name).
  useEffect(() => {
    if (!midiSupported()) return undefined;
    let cancelled = false;
    const apply = (ports: { id: string; name: string }[]) => {
      if (cancelled) return;
      setMidiOuts(ports);
      if (!selectedOutputId()) {
        let saved: string | null = null;
        try { saved = localStorage.getItem(MIDI_OUT_KEY); } catch { /* ignore */ }
        const match = saved ? ports.find((p) => p.name === saved) : undefined;
        if (match) { selectOutput(match.id); setMidiSelId(match.id); }
      }
    };
    const off = onDevices(apply);
    startMidiOut().then((r) => {
      if (cancelled) return;
      if (r.ok) { setMidiError(''); apply(r.outputs); }
      else setMidiError(r.error || 'MIDI unavailable');
    });
    return () => { cancelled = true; off(); };
  }, []);

  const selectMidi = useCallback((id: string | null) => {
    selectOutput(id);
    setMidiSelId(id);
    try {
      const name = listMidiOutputs().find((p) => p.id === id)?.name;
      if (name) localStorage.setItem(MIDI_OUT_KEY, name);
      else localStorage.removeItem(MIDI_OUT_KEY);
    } catch { /* private mode — selection stays in memory */ }
  }, []);

  const play = useCallback((clip: Clip) => {
    if (!engineRef.current) return;
    // If switching clips, start fresh
    if (activeClipIdRef.current !== clip.id) {
      engineRef.current.stop();
      activeClipIdRef.current = clip.id;
    }
    engineRef.current.play(clip.gesture, clip.harmonic, clip.bpm);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    activeClipIdRef.current = null;
  }, []);

  const toggle = useCallback((clip: Clip) => {
    if (!engineRef.current) return;
    const state = engineRef.current.getState();

    if (state === 'playing') {
      engineRef.current.pause();
    } else {
      // If different clip, start fresh
      if (activeClipIdRef.current !== clip.id) {
        engineRef.current.stop();
        activeClipIdRef.current = clip.id;
      }
      engineRef.current.play(clip.gesture, clip.harmonic, clip.bpm);
    }
  }, []);

  const midi: MidiOutUi | undefined = midiSupported()
    ? { outputs: midiOuts, selectedId: midiSelId, error: midiError, select: selectMidi }
    : undefined;

  return { playbackState, currentTime, play, pause, stop, toggle, midi };
}

// Hook choice is environment-constant for the page's lifetime, so the
// conditional does not break the rules of hooks.
export function usePlayback(): UsePlaybackReturn {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return IN_PLUGIN ? useHostPlayback() : useWebAudioPlayback();
}
