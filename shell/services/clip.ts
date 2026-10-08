// Clipboard history (cliphist) for the launcher's `;` mode.
import { createState } from "ags"
import { execAsync } from "ags/process"

const [clips, setClips] = createState<string[]>([])
export { clips }

export function loadClips() {
  execAsync(["cliphist", "list"])
    .then((out) => setClips(out.split("\n").filter(Boolean).slice(0, 80)))
    .catch(() => setClips([]))
}

/** cliphist lines look like "123\tpreview"; strip the id for display. */
export const clipPreview = (line: string) => line.replace(/^\d+\s+/, "").replace(/\s+/g, " ").trim()

export const pasteClip = (line: string) =>
  execAsync(["bash", "-c", 'printf "%s" "$0" | cliphist decode | wl-copy', line]).catch((e) => print(`ypsilon clip: ${e}`))
