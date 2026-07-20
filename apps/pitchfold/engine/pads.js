/**
 * PitchFold pad override — JS port of ChordPadBank::activeMask/activeRoot
 * (Source/Pads/ChordPadBank.h in Enkerli/PitchFold). A selected pad's own
 * PCS wins over the main scale; radio selection (at most one pad selected).
 *
 * This was the standalone webapp's biggest confirmed gap
 * (docs/PITCHFOLD_AUDIT.md): the plugin resolves pad override every block,
 * but nothing in the webapp ever did — selecting a pad only changed which
 * button glowed. `activePcs` is that missing resolution, now real and
 * unit-tested.
 */

/**
 * @param {{ pads?: Array<{ mask: number, root: number, selected?: boolean }>,
 *           pcsMask: number, pcsRoot: number }} state
 * @returns {{ mask: number, root: number }}
 */
export function activePcs(state) {
  const pad = (state.pads || []).find((p) => p.selected);
  return pad ? { mask: pad.mask, root: pad.root } : { mask: state.pcsMask, root: state.pcsRoot };
}
