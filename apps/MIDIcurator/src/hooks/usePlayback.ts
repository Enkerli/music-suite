import { useState, useCallback, useRef, useEffect } from 'react';
import { PlaybackEngine } from '../lib/playback';
import type { PlaybackState } from '../lib/playback';
import type { Clip } from '../types/clip';

export interface UsePlaybackReturn {
  playbackState: PlaybackState;
  currentTime: number;
  play: (clip: Clip) => void;
  pause: () => void;
  stop: () => void;
  toggle: (clip: Clip) => void;
}

export function usePlayback(): UsePlaybackReturn {
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
