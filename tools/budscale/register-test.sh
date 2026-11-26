#!/bin/bash
# Follow-up to scale-bisect (2026-11-26), which showed ScaleBud 2 looks scales
# up by NAME: "Dorian" was accepted and "Dorian (test)" with the same notes
# was not. Two questions:
#   A. Given a known name, does it use OUR intervals or its own?
#   B. Does registering a name in customScales make an arbitrary set work,
#      and does ScaleBud 2 need a relaunch to see a new custom scale?
#
#   bash tools/budscale/register-test.sh ["ScaleBud 2 MIDI In"]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BUD=(python3 -I "$HERE/budscale.py")
DEV="${1:-ScaleBud 2 MIDI In}"
OUT="$HERE/results-$(date +%Y%m%d-%H%M%S).txt"
ask() { local a; read -r -p "$1 (y/n/note) " a; printf '%s\t%s\n' "$1" "$a" >> "$OUT"; }
step() { echo; echo "── $1"; printf '\n## %s\n' "$1" >> "$OUT"; }
go() { "${BUD[@]}" write "$@" | tee -a "$OUT"; "${BUD[@]}" trigger --device "$DEV"; }

"${BUD[@]}" backup --dir "$HERE" | tee -a "$OUT"

step "A. Messiaen mode 3's notes under the name 'Dorian'"
go --mask 3549 --root C --name "Dorian"
ask "ScaleBud 2 shows C Dorian (C D E♭ F G A B♭)? Or the 9 Messiaen notes (C D E♭ E F♯ G A♭ B♭ B)?"

step "B1. Register 'Messiaen mode 3' in customScales, then select it"
go --mask 3549 --root C --name "Messiaen mode 3" --register
ask "ScaleBud 2 shows C Messiaen mode 3 (9 notes), without a relaunch?"

step "B2. Same, after relaunching ScaleBud 2"
read -r -p "Quit and relaunch ScaleBud 2, then press Enter " _
"${BUD[@]}" trigger --device "$DEV"
ask "Now ScaleBud 2 shows C Messiaen mode 3?"
ask "Does 'Messiaen mode 3' appear in ScaleBud 2's own scale list (custom/favourites)?"

step "C. The routing: is BrainBud still sending its trigger?"
echo "Open MIDI Monitor, change the scale in BrainBud, and watch for Program Change 70 (= PC 69 from 0) from BrainBud."
ask "BrainBud still sends the program change?"
ask "Is ScaleBud 2's MIDI input set to receive from BrainBud (check its settings)?"

echo
echo "Results: $OUT  (paste it back)"
echo "Undo: python3 $HERE/budscale.py unregister 'Messiaen mode 3', or restore the backup above."
