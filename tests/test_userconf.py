# config.json -> hypr/generated/{user,hypridle}.conf. If Hyprland is installed, the rendered
# files (default AND extreme values) must pass `Hyprland --verify-config`.
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import userconf as U  # noqa: E402

EXTREME = {
    "hypr": {"gapsIn": 9999, "gapsOut": -5, "borderSize": 8, "rounding": 40, "blur": False, "shadows": False, "dimInactive": False},
    "input": {"kbLayout": "us,de,fr", "kbVariant": ",nodeadkeys,", "kbOptions": "grp:alt_shift_toggle,caps:escape",
              "naturalScroll": False, "sensitivity": -0.75, "repeatRate": 100, "repeatDelay": 100},
    "idle": {"dimSec": 0, "lockSec": 60, "screenOffSec": 0, "suspendSec": 0},
    "reduceMotion": True,
}


class UserConfTest(unittest.TestCase):
    def load(self, cfg):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(cfg, f)
        try:
            return U.load(f.name)
        finally:
            os.unlink(f.name)

    def test_defaults_and_clamping(self):
        c = self.load(EXTREME)
        self.assertEqual(c["hypr"]["gapsIn"], 40)
        self.assertEqual(c["hypr"]["gapsOut"], 0)
        self.assertEqual(c["input"]["sensitivity"], -0.75)
        self.assertEqual(self.load({"input": {"kbLayout": "us\nexec-once = evil"}})["input"]["kbLayout"], "us")
        self.assertEqual(self.load({"hypr": {"blur": "yes"}})["hypr"]["blur"], True)  # wrong type -> default
        self.assertEqual(self.load({"hypr": {"rounding": True}})["hypr"]["rounding"], 18)  # bool is not a number

    def test_render(self):
        txt = U.render_user_conf(self.load(EXTREME))
        self.assertIn("kb_options = grp:alt_shift_toggle,caps:escape", txt)
        self.assertIn("enabled = false", txt)  # animations off for reduceMotion
        idle = U.render_hypridle(self.load(EXTREME), "/x")
        self.assertEqual(idle.count("listener {"), 1)  # only the lock step is enabled
        self.assertIn("lock_cmd = /x/scripts/ypsilon lock", idle)

    @unittest.skipUnless(shutil.which("Hyprland"), "Hyprland not installed")
    def test_hyprland_accepts_rendered_config(self):
        for cfg in ({}, EXTREME):
            with tempfile.TemporaryDirectory() as d:
                hypr = os.path.join(d, "hypr")
                shutil.copytree(os.path.join(ROOT, "hypr"), hypr, ignore=shutil.ignore_patterns("generated"))
                os.makedirs(os.path.join(hypr, "generated"))
                with open(os.path.join(hypr, "generated", "paths.conf"), "w") as f:
                    f.write("$YPSILON = %s\n$ypsilon = %s/scripts/ypsilon\n" % (ROOT, ROOT))
                with open(os.path.join(hypr, "generated", "user.conf"), "w") as f:
                    f.write(U.render_user_conf(self.load(cfg)))
                out = subprocess.run(["Hyprland", "--verify-config", "-c", os.path.join(hypr, "ypsilon.conf")],
                                     capture_output=True, text=True).stdout
                self.assertIn("config ok", out, out[-800:])


if __name__ == "__main__":
    unittest.main()
