import { useState, useCallback, useRef, useEffect } from 'react';
import { PlaybackEngine } from '../lib/playback';
import type { PlaybackState } from '../lib/playback';
import type { Clip } from '../types/clip';
import { IN_PLUGIN, bridge } from '../lib/juce-bridge';
import { clipToHostClip } from '../lib/host-clip';

export interface UsePlaybackReturn {
  playbackState: PlaybackState;
  currentTime: number;
  play: (clip: Clip) => void;
  pause: () => void;
  stop: () => void;
  toggle: (clip: Clip) => void;
}

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

  // Initialize engine once
  useEffect(() => {
    const engine = new PlaybackEngine();
    engine.setListener((state, time) => {
      setPlaybackState(state);
      setCurrentTime(time);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
    };
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

  return { playbackState, currentTime, play, pause, stop, toggle };
}

// Hook choice is environment-constant for the page's lifetime, so the
// conditional does not break the rules of hooks.
export function usePlayback(): UsePlaybackReturn {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return IN_PLUGIN ? useHostPlayback() : useWebAudioPlayback();
}
