#!/bin/bash
# Messiaen mode 3 test for the Bud apps' shared scale (macOS).
#
# Question: do the Bud apps accept a set that is not in their catalogue, and
# a 9-note one at that? And do they read the spelled intervals, or only the
# semitones? See docs/HARDWARE_REPURPOSING.md §12.5.
#
#   bash tools/budscale/messiaen3-test.sh ["ScaleBud 2 MIDI In"]
#
# Needs python3 and Geert Bevin's sendmidi on PATH. Close nothing: leave
# BrainBud and ScaleBud 2 open, so you can watch them. It backs up the
# group.bud preferences first and tells you how to restore them.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BUD=(python3 -I "$HERE/budscale.py")
DEV="${1:-ScaleBud 2 MIDI In}"
pause() { read -r -p "$1 [Enter] " _; }

echo "── 0. Backup and current state"
"${BUD[@]}" backup --dir "$HERE"
"${BUD[@]}" read
echo

echo "── 1. Messiaen mode 3 on C, spelled (9 notes, two intervals on degree 3 and degree 7)"
"${BUD[@]}" write --mask 3549 --root C --name "Messiaen mode 3 (test)"
"${BUD[@]}" trigger --device "$DEV"
pause "Does ScaleBud 2 show C Messiaen mode 3 (C D E♭ E F♯ G A♭ B♭ B)? Does BrainBud?"
echo

echo "── 2. Same set on B♭ (checks the key encoding: B♭ = {type 11, accidental -1})"
"${BUD[@]}" write --mask "$(python3 -c 'm=3549; print(((m<<10)|(m>>2))&0xFFF)')" --root Bb --name "Messiaen mode 3 on B♭ (test)"
"${BUD[@]}" trigger --device "$DEV"
pause "Does ScaleBud 2 now show it on B♭ (B♭ C D♭ D E F G♭ A♭ A)?"
echo

echo "── 3. Same set on C, spelling left generic (every interval called P1)"
"${BUD[@]}" write --mask 3549 --root C --name "Messiaen mode 3 (raw)" --spelling raw
"${BUD[@]}" trigger --device "$DEV"
pause "Same notes as step 1? (If yes, the apps read semitones; if not, they use degree/quality.)"
echo

echo "── Done. To put things back:"
echo "   python3 $HERE/budscale.py restore <the backup file above>"
echo "   python3 $HERE/budscale.py trigger"
