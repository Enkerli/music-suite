#!/usr/bin/env bash
#
# Build every GloriArp style model we can from the local corpora.
#
#   bash tools/build-all-models.sh [output-root]
#
# Three sources, three paths, because they are genuinely different material:
#
#   1. COMP STYLES → models (tools/comp-model.mjs). The three-hop chain, and
#      the one whose output GloriArp is known to read today. Kept as the safe
#      full set.
#   2. STRUM LOOPS → models directly (tools/comp-learn.mjs). One step, and the
#      models carry chord DEGREES as well as pitches, so realizeDegrees can move
#      them onto a chord the corpus never saw.
#   3. FUNKASTIC / TROUBLEMAKER CLIPS → models (msuite style learn). These have
#      real pitches, so GloriArp's own learner is the right tool and the chord
#      is one the clips were actually played against, not a chosen reference.
#
# Everything written here is statistics. The corpora stay where they are
# (INTENT D7) and none of this belongs in a repo.
set -uo pipefail

ROOT="${1:-$HOME/Desktop/Jazz Progs and Gen/corpora}"
SUITE="$HOME/Documents/Coding/music-suite"
LIB="$ROOT/MIDI Library"
STYLES="$ROOT/comp-styles"
MODELS="$ROOT/gloriarp-models"
LOG="$ROOT/build-models.log"

cd "$SUITE" || exit 1
: > "$LOG"
say() { printf '%s\n' "$*" | tee -a "$LOG"; }
run() { "$@" >>"$LOG" 2>&1; }

say "build-all-models — started $(date '+%Y-%m-%d %H:%M:%S')"
say "output root: $ROOT"
say ""

# ── 1. comp styles → models ──────────────────────────────────────────────────
# The frame is a CHOSEN reference: a comping style has no harmony of its own,
# so this only fixes which pitches get written into `notes`. Cm7 because a minor
# seventh sits neutrally under most of this material.
say "[1/3] comp styles → models (frame Cm7)"
if [ -d "$STYLES" ]; then
  mkdir -p "$MODELS/comp-via-style"
  run node tools/comp-model.mjs "$STYLES" --each --chord Cm7 -o "$MODELS/comp-via-style"
  say "      $(ls "$MODELS/comp-via-style"/*.json 2>/dev/null | wc -l | tr -d ' ') models in gloriarp-models/comp-via-style/"
else
  say "      SKIP — $STYLES not found"
fi
say ""

# ── 2. strum loops → degree-aware models, one step ───────────────────────────
say "[2/3] strum loops → degree-aware models"
mkdir -p "$MODELS/comp-direct"
# pack name : id prefix
PACKS=(
  "All That Jazz:jazz-comp"
  "Factory:comp"
  "Factory Electric:electric-comp"
  "Funk Essence:funk-comp"
  "Funky Cat:funky-comp"
  "Pop Rocks:pop-comp"
  "Take 3:ternary-comp"
)
for entry in "${PACKS[@]}"; do
  pack="${entry%%:*}"; prefix="${entry##*:}"
  if [ ! -d "$LIB/$pack" ]; then say "      SKIP $pack — not found"; continue; fi
  run node tools/comp-learn.mjs "$LIB/$pack" --by-groove --prefix "$prefix" --frame Cm7 -o "$MODELS/comp-direct"
  # Count this prefix, not the directory delta: a re-run overwrites the same
  # filenames, so a delta reads 0 for a pack that wrote every one of its models.
  say "      $pack → $(ls "$MODELS/comp-direct/$prefix"-*.json 2>/dev/null | wc -l | tr -d ' ') models ($prefix-*)"
done
say ""

# ── 3. Funkastic / Troublemaker clips → models ───────────────────────────────
# These DID get played against a chord, so the frame is an observation. The
# symbols match the models Alex already has: C-9, C-11, E♭7.
say "[3/3] Funkastic / Troublemaker clips → models"
mkdir -p "$MODELS/instrument"
CLIPS=(
  "funka:Eb7:funkastic-eb7"
  "tm303:Cm9:troublemaker-acid-cm9"
  "tmfunkacid:Cm11:troublemaker-funkacid-cm11"
)
for entry in "${CLIPS[@]}"; do
  IFS=: read -r dir chord id <<< "$entry"
  if [ ! -d "$SUITE/$dir" ]; then say "      SKIP $dir — not found"; continue; fi
  if run node packages/cli/dist/cli.js style learn "$SUITE/$dir" \
        --chord "$chord" --id "$id" -o "$MODELS/instrument/$id.json"; then
    n=$(ls "$SUITE/$dir"/*.mid 2>/dev/null | wc -l | tr -d ' ')
    say "      $dir ($n clips, $chord) → $id.json"
  else
    say "      FAILED $dir — see the log"
  fi
done
say ""

say "done $(date '+%Y-%m-%d %H:%M:%S')"
say "  gloriarp-models/comp-direct     $(ls "$MODELS/comp-direct"/*.json 2>/dev/null | wc -l | tr -d ' ')"
say "  gloriarp-models/comp-via-style  $(ls "$MODELS/comp-via-style"/*.json 2>/dev/null | wc -l | tr -d ' ')"
say "  gloriarp-models/instrument      $(ls "$MODELS/instrument"/*.json 2>/dev/null | wc -l | tr -d ' ')"
say "  full log: $LOG"
