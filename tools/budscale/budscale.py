#!/usr/bin/env python3
"""
budscale — read and write the scale that Cem Olcay's Bud apps share.

The Bud apps (BrainBud, ScaleBud 2, …) keep their shared scale in an App
Group preferences domain, `group.bud`, and Program Change 69 on channel 1
tells the others to re-read it. See docs/HARDWARE_REPURPOSING.md §12.5.

    python3 budscale.py read                       # current scale + key, as a mask
    python3 budscale.py backup                     # copy the plist aside first
    python3 budscale.py write --mask 3549 --root 0 --name "Messiaen mode 3"
    python3 budscale.py write --pcs 0,2,3,4,6,7,8,10,11 --root C
    python3 budscale.py write ... --spelling raw    # degree/quality left generic
    python3 budscale.py write ... --register        # also add it to customScales (needed:
                                                   #   ScaleBud 2 looks scales up by name)
    python3 budscale.py write ... --dry-run         # print the JSON, change nothing
    python3 budscale.py unregister "Messiaen mode 3"
    python3 budscale.py write --json '{"description":…}' --root D   # exact JSON
    python3 budscale.py scales                     # the apps' own scales, as JSON
    python3 budscale.py doctor                     # disk vs cfprefsd, ownership
    python3 budscale.py trigger                    # PC 69 via sendmidi
    python3 budscale.py restore <backup.plist>

macOS only for read/write/backup/restore (they use `defaults`, so cfprefsd
sees the change instead of a stale file). `--dry-run` and `read --file`
work anywhere. Standard library only.

Encodings (observed, not documented by the developer):

  brainbud.scale  JSON {"description": str,
                        "intervals": [{"degree": 1-7, "quality": q, "semitones": 0-11}]}
                  quality: 0 diminished, 1 perfect, 2 minor, 3 major, 4 augmented
                  (an older MusicTheory enum: not today's public one)
  brainbud.key    JSON {"type": natural-letter pitch class (C0 D2 E4 F5 G7 A9 B11),
                        "accidental": semitones (-1 flat, +1 sharp)}

Masks follow the suite convention (CONVENTIONS.md): leftmost = LSB, pitch
class i = bit i, so C Ionian = 2741 and Messiaen mode 3 on C = 3549.
"""
from __future__ import annotations

import argparse
import json
import os
import plistlib
import shutil
import subprocess
import sys
import time

DOMAIN = os.path.expanduser("~/Library/Group Containers/group.bud/Library/Preferences/group.bud")
PLIST = DOMAIN + ".plist"

D, P, MIN, MAJ, A = 0, 1, 2, 3, 4
QUALITY_NAME = {D: "d", P: "P", MIN: "m", MAJ: "M", A: "A"}

# Semitones of each degree's natural (major-scale) interval, degree 1..7.
NATURAL = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11}
PERFECT_DEGREES = {1, 4, 5}

# Fallback for sets with no one-letter-per-degree spelling. A declared
# policy (CONVENTIONS.md allows one for context-free sets), matching how
# the Bud apps' own custom scales spell: tritone as A4.
TABLE = {0: (1, P), 1: (2, MIN), 2: (2, MAJ), 3: (3, MIN), 4: (3, MAJ), 5: (4, P),
         6: (4, A), 7: (5, P), 8: (6, MIN), 9: (6, MAJ), 10: (7, MIN), 11: (7, MAJ)}

LETTERS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
LETTER_OF = {v: k for k, v in LETTERS.items()}
# Default root spelling when only a pitch class is given (the PCS Pads policy).
ROOT_SPELLING = {0: (0, 0), 1: (2, -1), 2: (2, 0), 3: (4, -1), 4: (4, 0), 5: (5, 0),
                 6: (5, 1), 7: (7, 0), 8: (9, -1), 9: (9, 0), 10: (11, -1), 11: (11, 0)}


# ── masks ───────────────────────────────────────────────────────────────────

def mask_to_pcs(mask: int) -> list[int]:
    return [pc for pc in range(12) if mask >> pc & 1]


def pcs_to_mask(pcs) -> int:
    m = 0
    for pc in pcs:
        m |= 1 << (pc % 12)
    return m


# ── spelling ────────────────────────────────────────────────────────────────

def quality_for(degree: int, semis: int):
    """Quality code for an interval of `semis` on `degree`, or None if out of range."""
    off = semis - NATURAL[degree]
    if degree in PERFECT_DEGREES:
        return {-1: D, 0: P, 1: A}.get(off)
    return {-2: D, -1: MIN, 0: MAJ, 1: A}.get(off)


def spell(rel: list[int], mode: str) -> list[dict]:
    """Intervals for pitch classes relative to the root (rel[0] must be 0)."""
    if mode == "raw":
        # Degree/quality deliberately generic, to test whether the apps read
        # only `semitones`. Every interval is called a perfect unison.
        return [{"degree": 1, "quality": P, "semitones": s} for s in rel]
    if len(rel) == 7:
        # Structural: one letter per degree, quality from the size.
        out = []
        for i, s in enumerate(rel):
            q = quality_for(i + 1, s)
            if q is None:
                break
            out.append({"degree": i + 1, "quality": q, "semitones": s})
        else:
            return out
    return [{"degree": TABLE[s][0], "quality": TABLE[s][1], "semitones": s} for s in rel]


def interval_name(iv: dict) -> str:
    return f"{QUALITY_NAME.get(iv['quality'], '?')}{iv['degree']}"


# ── keys ────────────────────────────────────────────────────────────────────

def parse_root(text: str) -> tuple[int, dict]:
    """'Bb', 'F#', 'B♭', or a pitch class '10' → (pc, key JSON)."""
    t = text.strip().replace("♭", "b").replace("♯", "#")
    if t.lstrip("-").isdigit():
        pc = int(t) % 12
        letter_pc, acc = ROOT_SPELLING[pc]
    else:
        letter = t[0].upper()
        if letter not in LETTERS:
            raise SystemExit(f"cannot read root {text!r}")
        acc = t[1:].count("#") - t[1:].count("b")
        letter_pc = LETTERS[letter]
        pc = (letter_pc + acc) % 12
    return pc, {"type": letter_pc, "accidental": acc}


def key_name(key: dict) -> str:
    acc = key.get("accidental", 0)
    return LETTER_OF.get(key.get("type"), "?") + ("♯" * acc if acc > 0 else "♭" * -acc)


# ── the store ───────────────────────────────────────────────────────────────

def require_mac():
    if sys.platform != "darwin":
        raise SystemExit("this needs macOS (it writes through `defaults`); use --dry-run elsewhere")


def load_plist(path: str | None) -> dict:
    if path:
        with open(path, "rb") as f:
            return plistlib.load(f)
    require_mac()
    out = subprocess.run(["defaults", "export", DOMAIN, "-"], check=True, capture_output=True).stdout
    return plistlib.loads(out)


def decode(value):
    if isinstance(value, bytes):
        if value.startswith(b"bplist"):
            return plistlib.loads(value)
        return json.loads(value)
    return value


def describe(scale: dict, key: dict) -> str:
    pcs_rel = [iv["semitones"] for iv in scale["intervals"]]
    root = (key["type"] + key["accidental"]) % 12
    mask = pcs_to_mask((root + s) for s in pcs_rel)
    names = " ".join(interval_name(iv) for iv in scale["intervals"])
    return (f"{key_name(key)} {scale.get('description', '?')}\n"
            f"  intervals  {names}\n"
            f"  semitones  {' '.join(str(s) for s in pcs_rel)}\n"
            f"  mask       {mask}  (pcs {','.join(map(str, mask_to_pcs(mask)))}; leftmost = LSB)")


def cmd_read(args):
    d = load_plist(args.file)
    scale = decode(d["brainbud.scale"])
    key = decode(d["brainbud.key"])
    print(describe(scale, key))


def cmd_backup(args):
    require_mac()
    dest = os.path.join(args.dir, f"group.bud.{time.strftime('%Y%m%d-%H%M%S')}.plist")
    subprocess.run(["defaults", "export", DOMAIN, dest], check=True)
    print(f"backed up to {dest}")


def cmd_restore(args):
    require_mac()
    subprocess.run(["defaults", "import", DOMAIN, args.backup], check=True)
    print(f"restored {args.backup}; send PC 69 (`budscale.py trigger`) so the apps re-read it")


def cmd_write(args):
    pc_root, key = parse_root(args.root)
    if args.json:
        # Exact scale JSON, untouched: a known-good value copied from the
        # apps' own store, to separate "how we write" from "what we write".
        text = open(args.json).read() if os.path.exists(args.json) else args.json
        scale = json.loads(text)
        return _write(scale, key, args)
    if args.mask is not None:
        mask = args.mask
    elif args.pcs:
        mask = pcs_to_mask(int(x) for x in args.pcs.split(","))
    else:
        raise SystemExit("give --mask or --pcs")
    if not 0 < mask <= 0xFFF:
        raise SystemExit("mask must be in 1..4095")
    if not mask >> pc_root & 1:
        raise SystemExit(f"the root ({pc_root}) is not in the set {mask_to_pcs(mask)}")
    rel = sorted((pc - pc_root) % 12 for pc in mask_to_pcs(mask))
    scale = {"description": args.name, "intervals": spell(rel, args.spelling)}
    return _write(scale, key, args)


def _write(scale: dict, key: dict, args):
    scale_json = json.dumps(scale, separators=(",", ":"))
    key_json = json.dumps(key, separators=(",", ":"))
    print(describe(scale, key))
    if args.dry_run:
        print(f"\nbrainbud.scale = {scale_json}\nbrainbud.key   = {key_json}\n(dry run: nothing written)")
        return
    require_mac()
    if getattr(args, "register", False):
        register(scale)
    for k, v in (("brainbud.scale", scale_json), ("brainbud.key", key_json)):
        subprocess.run(["defaults", "write", DOMAIN, k, "-data", v.encode().hex()], check=True)
    print("written. Now send PC 69 on ch 1 (`budscale.py trigger`).")


def _custom_scales() -> list:
    d = load_plist(None)
    return plistlib.loads(d["customScales"]) if "customScales" in d else []


def _write_custom_scales(scales: list):
    data = plistlib.dumps(scales, fmt=plistlib.FMT_BINARY)  # same encoding the apps use
    subprocess.run(["defaults", "write", DOMAIN, "customScales", "-data", data.hex()], check=True)


def register(scale: dict):
    """Add (or replace, by description) a scale in the apps' customScales list.

    ScaleBud 2 looks scales up by NAME (scale-bisect, 2026-11-26): a scale
    whose description is in neither its catalogue nor customScales falls back
    to major, whatever its intervals. Registering the name is what makes an
    arbitrary set reachable.
    """
    scales = [sc for sc in _custom_scales() if sc.get("description") != scale["description"]]
    scales.append({"intervals": scale["intervals"], "description": scale["description"]})
    _write_custom_scales(scales)
    print(f"registered {scale['description']!r} in customScales ({len(scales)} custom scales)")


def cmd_unregister(args):
    require_mac()
    scales = _custom_scales()
    kept = [sc for sc in scales if sc.get("description") != args.name]
    if len(kept) == len(scales):
        raise SystemExit(f"no custom scale named {args.name!r}")
    _write_custom_scales(kept)
    print(f"removed {args.name!r} ({len(kept)} custom scales left)")


def cmd_scales(args):
    """Print the apps' own stored scales as exact JSON, one per line, for --json."""
    d = load_plist(args.file)
    seen = []
    for k in ("brainbud.scale",):
        if k in d:
            seen.append((k, decode(d[k])))
    for k in ("customScales", "scalePicker.favorites"):
        for sc in decode(d.get(k, b"[]")) if k in d else []:
            seen.append((k, sc))
    if "scaleFinder" in d:
        seen.append(("scaleFinder", decode(d["scaleFinder"])["type"]))
    for k, sc in seen:
        print(f"# {k}: {sc.get('description')} ({len(sc['intervals'])} notes)")
        print(json.dumps(sc, separators=(",", ":")))


def cmd_doctor(args):
    """Does what cfprefsd serves match what is on disk? Who owns the file?"""
    require_mac()
    st = os.stat(PLIST)
    print(f"file   {PLIST}\n       mode {oct(st.st_mode & 0o7777)} uid {st.st_uid} "
          f"(you are {os.getuid()}) modified {time.ctime(st.st_mtime)}")
    with open(PLIST, "rb") as f:
        disk = plistlib.load(f)
    served = load_plist(None)
    for k in ("brainbud.scale", "brainbud.key"):
        a, b_ = disk.get(k), served.get(k)
        same = a == b_
        print(f"{k:15s} {'same' if same else 'DIFFERENT'} on disk and in cfprefsd")
        if not same:
            print(f"   disk:   {decode(a) if a is not None else None}\n   served: {decode(b_) if b_ is not None else None}")
    print("\nIf they differ, or BrainBud's changes stop reaching the file: quit the Bud apps,")
    print("restore the backup, run `killall cfprefsd` (it restarts on its own), relaunch the apps.")


def cmd_trigger(args):
    if not shutil.which("sendmidi"):
        raise SystemExit("sendmidi not found: send Program Change 69 on channel 1 by other means")
    subprocess.run(["sendmidi", "dev", args.device, "ch", "1", "pc", "69"], check=True)
    print(f"sent PC 69 (ch 1) to {args.device!r}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("read", help="show the shared scale and key")
    r.add_argument("--file", help="read a copied plist instead of the live domain")
    r.set_defaults(fn=cmd_read)
    b = sub.add_parser("backup", help="export the whole domain to a file")
    b.add_argument("--dir", default=".")
    b.set_defaults(fn=cmd_backup)
    rs = sub.add_parser("restore", help="import a backup")
    rs.add_argument("backup")
    rs.set_defaults(fn=cmd_restore)
    w = sub.add_parser("write", help="write a scale and key")
    w.add_argument("--mask", type=int, help="12-bit mask, leftmost = LSB")
    w.add_argument("--pcs", help="comma-separated pitch classes, e.g. 0,2,3,4")
    w.add_argument("--root", default="C", help="C, Bb, F#, B♭ … or a pitch class number")
    w.add_argument("--name", default="Custom set")
    w.add_argument("--spelling", choices=["structural", "raw"], default="structural")
    w.add_argument("--json", help="write this exact scale JSON (a string or a file) instead of --mask/--pcs")
    w.add_argument("--register", action="store_true",
                   help="also add the scale to customScales, so ScaleBud 2 can find it by name")
    w.add_argument("--dry-run", action="store_true")
    w.set_defaults(fn=cmd_write)
    un = sub.add_parser("unregister", help="remove a scale from customScales by name")
    un.add_argument("name")
    un.set_defaults(fn=cmd_unregister)
    sc = sub.add_parser("scales", help="print the apps' own stored scales as exact JSON")
    sc.add_argument("--file", help="read a copied plist instead of the live domain")
    sc.set_defaults(fn=cmd_scales)
    dr = sub.add_parser("doctor", help="compare the file on disk with what cfprefsd serves")
    dr.set_defaults(fn=cmd_doctor)
    t = sub.add_parser("trigger", help="send PC 69 so the Bud apps re-read")
    t.add_argument("--device", default="ScaleBud 2 MIDI In")
    t.set_defaults(fn=cmd_trigger)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
