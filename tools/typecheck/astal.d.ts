// Hand-written from Aylur/astal sources (lib/*/src/*.vala, wireplumber/src/*.c).
// Only the members Ypsilon uses + their real signatures.
declare module "gi://Astal?version=4.0" {
  import Gtk from "gi://Gtk?version=4.0"
  import Gdk from "gi://Gdk?version=4.0"
  namespace Astal {
    enum WindowAnchor { NONE = 0, TOP = 1, RIGHT = 2, LEFT = 4, BOTTOM = 8 }
    enum Exclusivity { NORMAL = 0, EXCLUSIVE = 1, IGNORE = 2 }
    enum Layer { BACKGROUND = 0, BOTTOM = 1, TOP = 2, OVERLAY = 3 }
    enum Keymode { NONE = 0, EXCLUSIVE = 1, ON_DEMAND = 2 }
    namespace Window {
      interface ConstructorProps extends Gtk.Window.ConstructorProps {
        namespace: string; anchor: WindowAnchor; exclusivity: Exclusivity; layer: Layer; keymode: Keymode
        gdkmonitor: Gdk.Monitor; monitor: number; margin_top: number; marginTop: number; margin_bottom: number; marginBottom: number
        margin_left: number; marginLeft: number; margin_right: number; marginRight: number; margin: number
      }
    }
    class Window extends Gtk.Window {
      constructor(props?: Partial<Window.ConstructorProps>)
      namespace: string; anchor: WindowAnchor; exclusivity: Exclusivity; layer: Layer; keymode: Keymode
      gdkmonitor: Gdk.Monitor; monitor: number
      get_current_monitor(): Gdk.Monitor
    }
    namespace Slider {
      interface ConstructorProps extends Gtk.Scale.ConstructorProps { value: number; min: number; max: number; step: number; page: number }
    }
    class Slider extends Gtk.Scale {
      constructor(props?: Partial<Slider.ConstructorProps>)
      value: number; min: number; max: number; step: number; page: number
    }
  }
  export default Astal
}
declare module "gi://Astal" { import A from "gi://Astal?version=4.0"; export default A }

declare module "gi://AstalHyprland" {
  import GObject from "gi://GObject"
  namespace AstalHyprland {
    /** null when Hyprland IPC is unavailable / fails to initialize (hyprland.vala) */
    function get_default(): Hyprland | null
    class Monitor extends GObject.Object { readonly id: number; readonly name: string }
    class Workspace extends GObject.Object {
      readonly id: number; readonly name: string; readonly monitor: Monitor; readonly clients: Client[]
      readonly hasFullscreen: boolean; readonly lastClient: Client
      focus(): void; move_to(m: Monitor): void
    }
    class Client extends GObject.Object {
      readonly address: string; readonly mapped: boolean; readonly hidden: boolean
      readonly x: number; readonly y: number; readonly width: number; readonly height: number
      readonly workspace: Workspace | null; readonly floating: boolean; readonly monitor: Monitor | null
      readonly class: string; readonly title: string; readonly initialClass: string; readonly initialTitle: string
      readonly pid: number; readonly xwayland: boolean; readonly pinned: boolean
      kill(): void; focus(): void; move_to(ws: Workspace): void; toggle_floating(): void
    }
    class Hyprland extends GObject.Object {
      static get_default(): Hyprland | null
      readonly monitors: Monitor[]; readonly workspaces: Workspace[]; readonly clients: Client[]
      /** null at runtime when nothing is focused / during startup */
      readonly focusedWorkspace: Workspace | null; readonly focusedMonitor: Monitor | null; readonly focusedClient: Client | null
      get_workspace(id: number): Workspace; get_client(address: string): Client | null
      message(msg: string): string; dispatch(dispatcher: string, args: string): void
    }
  }
  export default AstalHyprland
}

declare module "gi://AstalWp" {
  import GObject from "gi://GObject"
  namespace AstalWp {
    function get_default(): Wp | null
    class Node extends GObject.Object {
      readonly id: number; volume: number; mute: boolean; readonly description: string; readonly name: string
      readonly icon: string; readonly volumeIcon: string; readonly serial: number; readonly path: string
      set_volume(v: number): void; set_mute(m: boolean): void
    }
    class Endpoint extends Node { isDefault: boolean; set_is_default(d: boolean): void }
    class Stream extends Node {}
    class Audio extends GObject.Object {
      readonly speakers: Endpoint[]; readonly microphones: Endpoint[]; readonly streams: Stream[]
      /** NULL while PipeWire (re)connects or with no output device (wireplumber.c) */
      readonly defaultSpeaker: Endpoint | null; readonly defaultMicrophone: Endpoint | null
    }
    class Wp extends GObject.Object { static get_default(): Wp | null; readonly audio: Audio }
  }
  export default AstalWp
}

declare module "gi://AstalBattery" {
  import GObject from "gi://GObject"
  namespace AstalBattery {
    /** null without UPower (device.vala) */
    function get_default(): Device | null
    class Device extends GObject.Object {
      static get_default(): Device | null
      readonly percentage: number; readonly isPresent: boolean; readonly charging: boolean; readonly isBattery: boolean
      readonly iconName: string; readonly batteryIconName: string; readonly timeToEmpty: number; readonly timeToFull: number
      readonly energyRate: number
    }
  }
  export default AstalBattery
}

declare module "gi://AstalBluetooth" {
  import GObject from "gi://GObject"
  namespace AstalBluetooth {
    function get_default(): Bluetooth
    class Adapter extends GObject.Object { powered: boolean; readonly name: string; discovering: boolean; start_discovery(): void; stop_discovery(): void }
    class Device extends GObject.Object {
      readonly connected: boolean; readonly paired: boolean; readonly address: string; readonly icon: string
      readonly name: string; alias: string; readonly connecting: boolean; trusted: boolean; readonly batteryPercentage: number
      connect_device(cb?: (src: Device, res: unknown) => void): void; disconnect_device(cb?: (src: Device, res: unknown) => void): void
      pair(): void
    }
    class Bluetooth extends GObject.Object {
      static get_default(): Bluetooth
      readonly isPowered: boolean; readonly isConnected: boolean; readonly adapter: Adapter | null
      readonly adapters: Adapter[]; readonly devices: Device[]
      toggle(): void
    }
  }
  export default AstalBluetooth
}

declare module "gi://AstalNetwork" {
  import GObject from "gi://GObject"
  namespace AstalNetwork {
    function get_default(): Network
    enum Primary { UNKNOWN = 0, WIRED = 1, WIFI = 2 }
    class AccessPoint extends GObject.Object { readonly ssid: string | null; readonly strength: number; readonly iconName: string; readonly bssid: string; readonly requiresPassword: boolean; readonly frequency: number }
    class Wifi extends GObject.Object {
      readonly ssid: string; readonly strength: number; readonly iconName: string; enabled: boolean
      readonly scanning: boolean; readonly accessPoints: AccessPoint[]; readonly activeAccessPoint: AccessPoint | null
      scan(): void
    }
    class Wired extends GObject.Object { readonly iconName: string; readonly speed: number }
    class Network extends GObject.Object {
      static get_default(): Network
      readonly wifi: Wifi | null; readonly wired: Wired | null; readonly primary: Primary
    }
  }
  export default AstalNetwork
}

declare module "gi://AstalMpris" {
  import GObject from "gi://GObject"
  namespace AstalMpris {
    function get_default(): Mpris
    enum PlaybackStatus { PLAYING = 0, PAUSED = 1, STOPPED = 2 }
    class Player extends GObject.Object {
      readonly busName: string; readonly available: boolean; readonly identity: string; readonly entry: string
      readonly playbackStatus: PlaybackStatus; readonly canGoNext: boolean; readonly canGoPrevious: boolean
      readonly canControl: boolean; readonly canPlay: boolean; readonly canSeek: boolean
      readonly title: string; readonly artist: string; readonly album: string; readonly artUrl: string; readonly coverArt: string
      readonly length: number; position: number; volume: number
      play_pause(): void; next(): void; previous(): void; play(): void; pause(): void; raise(): void
    }
    class Mpris extends GObject.Object { static get_default(): Mpris; readonly players: Player[] }
  }
  export default AstalMpris
}

declare module "gi://AstalNotifd" {
  import GObject from "gi://GObject"
  namespace AstalNotifd {
    function get_default(): Notifd
    enum Urgency { LOW = 0, NORMAL = 1, CRITICAL = 2 }
    class Action extends GObject.Object { readonly id: string; readonly label: string; invoke(): void }
    class Notification extends GObject.Object {
      readonly id: number; readonly appName: string | null; readonly appIcon: string | null
      readonly summary: string; readonly body: string; readonly time: number; readonly expireTimeout: number
      readonly actions: Action[]; readonly image: string; readonly category: string; readonly desktopEntry: string
      readonly urgency: Urgency; readonly transient: boolean; readonly resident: boolean
      dismiss(): void; expire(): void; invoke(actionId: string): void
    }
    namespace Notifd {
      interface SignalSignatures extends GObject.Object.SignalSignatures {
        notified(id: number, replaced: boolean): void
        resolved(id: number, reason: number): void
      }
    }
    class Notifd extends GObject.Object {
      static get_default(): Notifd
      $signals: Notifd.SignalSignatures
      connect<K extends keyof Notifd.SignalSignatures>(signal: K, callback: GObject.SignalCallback<this, Notifd.SignalSignatures[K]>): number
      ignoreTimeout: boolean; dontDisturb: boolean; defaultTimeout: number
      readonly notifications: Notification[]
      get_notification(id: number): Notification | null
    }
  }
  export default AstalNotifd
}

declare module "gi://AstalTray" {
  import GObject from "gi://GObject"
  import Gio from "gi://Gio"
  namespace AstalTray {
    function get_default(): Tray
    class TrayItem extends GObject.Object {
      readonly title: string; readonly id: string; readonly itemId: string; readonly tooltipMarkup: string; readonly tooltipText: string
      readonly iconName: string; readonly gicon: Gio.Icon; readonly isMenu: boolean
      readonly menuModel: Gio.MenuModel | null; readonly actionGroup: Gio.ActionGroup | null
      about_to_show(): void; activate(x: number, y: number): void; secondary_activate(x: number, y: number): void
    }
    class Tray extends GObject.Object { static get_default(): Tray; readonly items: TrayItem[] }
  }
  export default AstalTray
}

declare module "gi://AstalApps" {
  import GObject from "gi://GObject"
  namespace AstalApps {
    class Application extends GObject.Object {
      readonly name: string; readonly entry: string; readonly description: string; readonly wmClass: string
      readonly executable: string; readonly iconName: string; readonly keywords: string[]; frequency: number
      launch(): boolean
    }
    namespace Apps { interface ConstructorProps { showHidden: boolean; nameMultiplier: number; entryMultiplier: number; executableMultiplier: number; descriptionMultiplier: number; keywordsMultiplier: number; minScore: number } }
    class Apps extends GObject.Object {
      constructor(props?: Partial<Apps.ConstructorProps>)
      readonly list: Application[]
      fuzzy_query(search?: string | null): Application[]; exact_query(search?: string | null): Application[]; reload(): void
    }
  }
  export default AstalApps
}

declare module "gi://AstalPowerProfiles" {
  import GObject from "gi://GObject"
  namespace AstalPowerProfiles {
    function get_default(): PowerProfiles
    type Profile = { profile: string; driver: string; cpuDriver: string; platformDriver: string }
    class PowerProfiles extends GObject.Object {
      static get_default(): PowerProfiles
      activeProfile: string; readonly iconName: string; readonly profiles: Profile[]
      get_profiles(): Profile[]; set_active_profile(p: string): void
    }
  }
  export default AstalPowerProfiles
}

declare module "gi://AstalCava" {
  import GObject from "gi://GObject"
  namespace AstalCava {
    /** nullable (cava.c); `active` defaults to TRUE = capture starts immediately */
    function get_default(): Cava | null
    class Cava extends GObject.Object {
      static get_default(): Cava | null
      active: boolean; bars: number; autosens: boolean; framerate: number
      get_values(): number[]
    }
  }
  export default AstalCava
}
