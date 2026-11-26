"""python3 -m unittest discover tools/budscale  (no macOS needed)"""
import json
import unittest

import budscale as b

MESSIAEN3_C = 3549  # {0,2,3,4,6,7,8,10,11}, leftmost = LSB


class Masks(unittest.TestCase):
    def test_suite_convention(self):
        self.assertEqual(b.pcs_to_mask([0, 2, 4, 5, 7, 9, 11]), 2741)  # C Ionian, not 2773
        self.assertEqual(b.mask_to_pcs(MESSIAEN3_C), [0, 2, 3, 4, 6, 7, 8, 10, 11])


class Spelling(unittest.TestCase):
    def names(self, rel, mode="structural"):
        return [b.interval_name(iv) for iv in b.spell(rel, mode)]

    def test_heptatonic_is_structural(self):
        self.assertEqual(self.names([0, 2, 4, 5, 7, 9, 11]), ["P1", "M2", "M3", "P4", "P5", "M6", "M7"])
        # Lydian ♭7 as the Bud apps store it uses d5; structurally it is A4.
        self.assertEqual(self.names([0, 2, 4, 6, 7, 9, 10]), ["P1", "M2", "M3", "A4", "P5", "M6", "m7"])
        self.assertEqual(self.names([0, 1, 3, 5, 6, 8, 10]), ["P1", "m2", "m3", "P4", "d5", "m6", "m7"])

    def test_non_heptatonic_uses_the_table(self):
        self.assertEqual(self.names([0, 2, 3, 4, 6, 7, 8, 10, 11]),
                         ["P1", "M2", "m3", "M3", "A4", "P5", "m6", "m7", "M7"])

    def test_semitones_always_survive(self):
        for mask in range(1, 4096, 37):
            rel = b.mask_to_pcs(mask)
            rel = [(pc - rel[0]) % 12 for pc in rel]
            for mode in ("structural", "raw"):
                self.assertEqual([iv["semitones"] for iv in b.spell(rel, mode)], rel)

    def test_quality_codes_match_the_store(self):
        # From a real group.bud: Balinese = P1 m2 m3 P5 m6 → qualities 1 2 2 1 2.
        self.assertEqual([iv["quality"] for iv in b.spell([0, 1, 3, 7, 8], "structural")], [1, 2, 2, 1, 2])


class Keys(unittest.TestCase):
    def test_observed_keys(self):
        self.assertEqual(b.parse_root("Bb"), (10, {"type": 11, "accidental": -1}))  # seen in the store
        self.assertEqual(b.parse_root("F#"), (6, {"type": 5, "accidental": 1}))     # seen in the store
        self.assertEqual(b.parse_root("B♭")[0], 10)
        self.assertEqual(b.parse_root("10"), (10, {"type": 11, "accidental": -1}))
        self.assertEqual(b.key_name({"type": 11, "accidental": -1}), "B♭")

    def test_describe_round_trip(self):
        scale = {"description": "t", "intervals": b.spell([0, 2, 3, 4, 6, 7, 8, 10, 11], "structural")}
        text = b.describe(json.loads(json.dumps(scale)), {"type": 0, "accidental": 0})
        self.assertIn(f"mask       {MESSIAEN3_C}", text)


if __name__ == "__main__":
    unittest.main()
