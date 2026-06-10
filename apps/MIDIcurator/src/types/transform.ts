import type { Gesture, Harmonic } from './clip';

/** Parameters accepted by transformGesture(). */
export interface TransformParams {
  densityMultiplier?: number;
  quantizeStrength?: number;
  velocityScale?: number;
}

/** Return value from transformGesture(). */
export interface TransformResult {
  gesture: Gesture;
  harmonic: Harmonic;
}
