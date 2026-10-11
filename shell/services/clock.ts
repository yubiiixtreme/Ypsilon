// One shared wall clock instead of a 1 s timer per bar/widget. Without seconds the text changes
// once a minute: a timer aligned to :00 (capped at 10 s, so the time is right soon after a resume
// from suspend, when the monotonic timer was frozen). The 1 s poll is lazy — it only runs while
// something actually shows seconds.
import { Accessor, createComputed, createState } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"

const now = () => GLib.DateTime.new_now_local()
const minuteOf = (d: GLib.DateTime) => Math.floor(d.to_unix() / 60)

const [minute, setMinute] = createState(minuteOf(now()))
let armed = false
function arm() {
  armed = true
  const ms = Math.ceil((60 - now().get_seconds()) * 1000)
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(50, Math.min(10_000, ms)), () => {
    setMinute(minuteOf(now())) // state ignores equal values: no re-render unless the minute changed
    arm()
    return GLib.SOURCE_REMOVE
  })
}

const second = createPoll(0, 1000, () => GLib.get_real_time())

/** `format` (GLib strftime) of the current time; ticks per second only while `seconds()` is true */
export function wallClock(format: () => string, seconds: () => boolean = () => false): Accessor<string> {
  if (!armed) arm()
  return createComputed(() => {
    if (seconds()) second()
    else minute()
    return now().format(format()) ?? ""
  })
}
