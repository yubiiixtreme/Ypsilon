// Ypsilon brightness service — brightnessctl backend.
// (Astal ships no brightness library; importing gi://AstalBrightness would
// crash the whole shell at startup.) -1 means "no backlight on this machine".
import { createState } from "ags"
import { execAsync } from "ags/process"

const [level, setLevel] = createState(-1)
export const brightness = level

/** Re-read the backlight (0..1). `brightnessctl -m` → dev,class,cur,NN%,max */
export function refreshBrightness() {
  execAsync(["brightnessctl", "-m"])
    .then((out) => {
      const m = /,(\d+)%,/.exec(out)
      setLevel(m ? Number(m[1]) / 100 : -1)
    })
    .catch(() => setLevel(-1))
}

export function setBrightness(v: number) {
  const clamped = Math.max(0.05, Math.min(1, v))
  setLevel(clamped)
  execAsync(["brightnessctl", "-q", "set", `${Math.round(clamped * 100)}%`]).catch((e) =>
    print(`ypsilon: setBrightness failed: ${e}`),
  )
}
