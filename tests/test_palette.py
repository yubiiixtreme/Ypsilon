# Run: python3 -m unittest discover -s tests
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import palette as P  # noqa: E402


class PaletteTest(unittest.TestCase):
    def test_contrast_known_values(self):
        self.assertAlmostEqual(P.contrast((0, 0, 0), (255, 255, 255)), 21.0, places=1)
        self.assertAlmostEqual(P.contrast((10, 10, 10), (10, 10, 10)), 1.0)

    def test_ensure_contrast_reaches_target(self):
        out = P.ensure_contrast((60, 60, 80), (20, 20, 30), 7.0)
        self.assertGreaterEqual(P.contrast(out, (20, 20, 30)), 7.0)

    def test_kmeans_finds_two_blobs(self):
        px = [(250, 10, 10)] * 300 + [(10, 10, 250)] * 100
        cl = P.kmeans(px, k=4)
        self.assertEqual(len(cl), 2)
        self.assertEqual(cl[0][1], 300)

    def test_theme_from_colorful_wallpaper(self):
        px = [(20, 30, 60)] * 500 + [(230, 120, 30)] * 150 + [(40, 200, 180)] * 120
        t = P.build_theme(P.kmeans(px))
        bg = P.rgb_of(t["bg"])
        for key, ratio in (("fg", 12.0), ("muted", 4.5), ("primary", 4.5), ("accent", 4.5), ("bad", 4.5)):
            self.assertGreaterEqual(P.contrast(P.rgb_of(t[key]), bg), ratio, key)
        self.assertEqual(len(t["ansi"]), 16)
        self.assertGreater(P.hue_dist(P.hls(P.rgb_of(t["primary"]))[0], P.hls(P.rgb_of(t["accent"]))[0]), 0.08)

    def test_monochrome_wallpaper_still_gets_an_accent(self):
        t = P.build_theme(P.kmeans([(128, 128, 128)] * 200 + [(30, 30, 30)] * 200))
        self.assertNotEqual(t["primary"], t["accent"])

    def test_light_variant(self):
        t = P.build_theme(P.kmeans([(200, 220, 240)] * 300 + [(240, 80, 120)] * 80), light=True)
        self.assertGreater(P.luminance(P.rgb_of(t["bg"])), 0.7)
        self.assertGreaterEqual(P.contrast(P.rgb_of(t["fg"]), P.rgb_of(t["bg"])), 12.0)

    def test_harmonize_turns_toward_the_primary_but_at_most_15_degrees(self):
        red = (220, 60, 60)
        far = P.from_hls(70 / 360, 0.5, 0.7)    # yellow-green, ~70° away from red
        near = P.from_hls(10 / 360, 0.5, 0.7)   # 10° away: moves half the gap
        self.assertAlmostEqual(P.hls(P.harmonize(far, red))[0] * 360, 55, delta=1)
        self.assertAlmostEqual(P.hls(P.harmonize(near, red))[0] * 360, 5, delta=1)
        wrap = P.from_hls(350 / 360, 0.5, 0.7)  # across 0°: turns forward, not the long way round
        self.assertAlmostEqual(P.hls(P.harmonize(wrap, red))[0] * 360, 355, delta=1)


if __name__ == "__main__":
    unittest.main()
