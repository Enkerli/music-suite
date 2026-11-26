#!/bin/bash
# Why did ScaleBud 2 take the KEY but not the SCALE? Bisect from "surely
# accepted" toward Messiaen mode 3, one difference at a time. Answers go to
# a results file you can paste back. macOS; needs python3 and sendmidi.
#
#   bash tools/budscale/scale-bisect.sh ["ScaleBud 2 MIDI In"]
#
# Before running: BrainBud → ScaleBud 2 should work again (step 0 helps).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BUD=(python3 -I "$HERE/budscale.py")
DEV="${1:-ScaleBud 2 MIDI In}"
OUT="$HERE/results-$(date +%Y%m%d-%H%M%S).txt"
ask() { local a; read -r -p "$1 (y/n/note) " a; printf '%s\t%s\n' "$1" "$a" >> "$OUT"; }
step() { echo; echo "── $1"; printf '\n## %s\n' "$1" >> "$OUT"; }

step "0. Health: does cfprefsd agree with the file?"
"${BUD[@]}" doctor | tee -a "$OUT"
"${BUD[@]}" backup --dir "$HERE" | tee -a "$OUT"
echo "Now change the scale in BrainBud (e.g. to Dorian) and watch ScaleBud 2."
ask "BrainBud drives ScaleBud 2 again?"
"${BUD[@]}" read | tee -a "$OUT"
"${BUD[@]}" scales > "$HERE/own-scales.jsonl"
own() { grep -A1 "^# $1" "$HERE/own-scales.jsonl" | sed -n 2p; }

try() {  # try <label> <budscale write args…>
  local label="$1"; shift
  step "$label"
  "${BUD[@]}" write "$@" | tee -a "$OUT"
  "${BUD[@]}" trigger --device "$DEV"
  ask "ScaleBud 2 shows it (right root AND right notes)?"
}

BAL="$(own 'brainbud.scale')"
PCO="$(own 'customScales: PCO')"

try "1. The apps' own current scale, byte-for-byte, on D (tests writing a scale at all)" --json "$BAL" --root D
try "2. Dorian on D, spelled by us, named 'Dorian' (catalogue scale)" --pcs 2,4,5,7,9,11,0 --root D --name "Dorian"
try "3. Same Dorian, named 'Dorian (test)' (does the name have to match?)" --pcs 2,4,5,7,9,11,0 --root D --name "Dorian (test)"
[ -n "$PCO" ] && try "4. Their own custom 8-note PCO, byte-for-byte, on C" --json "$PCO" --root C
try "5. Octatonic half-whole on C, by us (8 notes)" --pcs 0,1,3,4,6,7,9,10 --root C --name "Octatonic (test)"
try "6. Messiaen mode 3 on C, by us (9 notes)" --mask 3549 --root C --name "Messiaen mode 3 (test)"

echo
echo "Results: $OUT  (paste it back)"
echo "Restore: python3 $HERE/budscale.py restore <backup above> && python3 $HERE/budscale.py trigger"
