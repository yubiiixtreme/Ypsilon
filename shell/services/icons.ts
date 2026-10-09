// Icons for things that only have a name: a window class, the running distro.
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"
import { getApps } from "./apps"

const cache = new Map<string, string>()
const FALLBACK = "application-x-executable"

function has(name: string) {
  const display = Gdk.Display.get_default()
  return !!display && Gtk.IconTheme.get_for_display(display).has_icon(name)
}

/** best icon for a Hyprland window class: "chromium", "com.microsoft.VSCode", "steam_app_123"… */
export function iconForClass(cls: string): string {
  if (!cls) return FALLBACK
  const hit = cache.get(cls)
  if (hit) return hit
  const lower = cls.toLowerCase()
  const last = lower.split(".").pop() ?? lower
  let icon = [cls, lower, last].find(has)
  if (!icon) {
    // a desktop entry that claims this window (StartupWMClass) or shares its id/executable
    const app = getApps().list.find((a) => {
      const wm = (a.wmClass ?? "").toLowerCase()
      const entry = (a.entry ?? "").replace(/\.desktop$/, "").toLowerCase()
      return wm === lower || entry === lower || entry.endsWith(`.${last}`) || (a.executable ?? "").split(" ")[0].endsWith(`/${last}`)
    })
    icon = app?.iconName && has(app.iconName) ? app.iconName : FALLBACK
  }
  cache.set(cls, icon)
  return icon
}

// Nerd Font glyphs for the bar's logo button (needs a Nerd Font, which Ypsilon already uses)
const DISTRO: Record<string, string> = {
  arch: "", endeavouros: "", manjaro: "", cachyos: "", garuda: "",
  debian: "", ubuntu: "", linuxmint: "", pop: "", fedora: "",
  nixos: "", opensuse: "", "opensuse-tumbleweed": "", gentoo: "", void: "",
}

/** the running distro's logo glyph (Tux when unknown) */
export const distroGlyph = () => DISTRO[GLib.get_os_info("ID") ?? ""] ?? ""
