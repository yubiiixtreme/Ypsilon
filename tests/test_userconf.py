# config.json -> hypr/generated/{user.lua,hypridle.conf}. If Hyprland is installed, the rendered
# user.lua (default AND extreme values) must pass `Hyprland --verify-config`.
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
    "hypr": {"gapsIn": 9999, "gapsOut": -5, "borderSize": 8, "rounding": 40, "blur": False, "shadows": False, "dimInactive": False, "cube": False},
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
        self.assertEqual(self.load({})["hypr"]["cube"], True)  # 3D cube on by default
        self.assertEqual(self.load({"hypr": {"cube": False}})["hypr"]["cube"], False)

    def test_render(self):
        txt = U.render_user_conf(self.load(EXTREME))
        self.assertIn('kb_options = "grp:alt_shift_toggle,caps:escape"', txt)
        self.assertIn("animations = { enabled = false }", txt)  # reduceMotion kills animations
        flat = U.render_user_conf(self.load({"hypr": {"cube": False}}))
        self.assertIn('slidefade 20%', flat)  # cube off flattens the 3D swing
        cube = U.render_user_conf(self.load({}))
        self.assertNotIn('slidefade 20%', cube)  # cube on: 3d.lua owns the workspace anims
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
                with open(os.path.join(hypr, "generated", "paths.lua"), "w") as f:
                    f.write('hl.env("YPSILON_ROOT", "%s")\nreturn { ROOT = "%s", YPSILON = "%s/scripts/ypsilon" }\n'
                            % (ROOT, ROOT, ROOT))
                with open(os.path.join(hypr, "generated", "user.lua"), "w") as f:
                    f.write(U.render_user_conf(self.load(cfg)))
                # bare containers often lack XDG_RUNTIME_DIR and Hyprland aborts without it
                env = dict(os.environ, XDG_RUNTIME_DIR=d)
                cmd = ["Hyprland", "--verify-config", "-c", os.path.join(hypr, "ypsilon.lua")]
                if os.geteuid() == 0:
                    cmd.append("--i-am-really-stupid")  # CI containers run as root
                out = subprocess.run(cmd, capture_output=True, text=True, env=env).stdout
                self.assertIn("config ok", out, out[-800:])


if __name__ == "__main__":
    unittest.main()
