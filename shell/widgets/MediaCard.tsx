import Gtk from "gi://Gtk"
import Pango from "gi://Pango"
import Mpris from "gi://AstalMpris"
import { createBinding, createComputed, With } from "ags"
import { createPoll } from "ags/time"
import { togglePlay, nextTrack, prevTrack } from "../services/media"
import Visualizer from "./Visualizer"

const fmt = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00")

function Player({ p }: { p: Mpris.Player }) {
  const status = createBinding(p, "playbackStatus")
  const art = createBinding(p, "coverArt")
  const length = createBinding(p, "length")
  // MPRIS does not signal position changes; sample it once a second
  const position = createPoll(0, 1000, () => p.position)
  const progress = createComputed(() => (length() > 0 ? Math.min(1, position() / length()) : 0))

  return (
    <box class="media-card" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <box spacing={12}>
        <box class="media-art" overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.CENTER}>
          <image file={art} pixelSize={56} visible={art((a) => a !== "")} />
          <image iconName="audio-x-generic-symbolic" pixelSize={28} visible={art((a) => a === "")} hexpand />
        </box>
        <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
          <label class="app-name" halign={Gtk.Align.START} maxWidthChars={26} ellipsize={Pango.EllipsizeMode.END} label={createBinding(p, "title")((t) => t || "Unknown")} />
          <label class="sub" halign={Gtk.Align.START} maxWidthChars={30} ellipsize={Pango.EllipsizeMode.END} label={createBinding(p, "artist")} />
          <label class="hint" halign={Gtk.Align.START} label={createBinding(p, "identity")} />
        </box>
      </box>
      <Visualizer width={300} height={36} when={status((s) => s === Mpris.PlaybackStatus.PLAYING)} />
      <levelbar class="media-progress" value={progress} visible={length((l) => l > 0)} />
      <box spacing={6} halign={Gtk.Align.CENTER}>
        <label class="hint" label={position((s) => fmt(s))} />
        <button class="icon-btn" onClicked={() => prevTrack(p)} sensitive={createBinding(p, "canGoPrevious")}>
          <image iconName="media-skip-backward-symbolic" pixelSize={15} />
        </button>
        <button class="icon-btn play" onClicked={() => togglePlay(p)}>
          <image
            iconName={status((s) => (s === Mpris.PlaybackStatus.PLAYING ? "media-playback-pause-symbolic" : "media-playback-start-symbolic"))}
            pixelSize={17}
          />
        </button>
        <button class="icon-btn" onClicked={() => nextTrack(p)} sensitive={createBinding(p, "canGoNext")}>
          <image iconName="media-skip-forward-symbolic" pixelSize={15} />
        </button>
        <label class="hint" label={length((l) => fmt(l))} />
      </box>
    </box>
  )
}

/** Now playing (album art, progress, transport) for the first available player. */
export default function MediaCard() {
  const players = createBinding(Mpris.get_default(), "players")
  const one = createComputed(() => players().find((p) => p.available) ?? null)
  return (
    <box visible={one((p) => p !== null)}>
      <With value={one}>{(p) => (p ? <Player p={p} /> : <box />)}</With>
    </box>
  )
}
