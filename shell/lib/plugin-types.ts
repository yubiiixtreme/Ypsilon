// The Ypsilon plugin API (v1) — the contract between the shell and plugins.
// JS plugins get editor completion + type-checking with:
//   /** @param {import("<repo>/shell/lib/plugin-types").PluginApi} api */
import type { Accessor, Setter } from "ags"
import type { Manifest } from "./plugins"

export type Widget = JSX.Element
export type MaybeAccessor<T> = T | Accessor<T>

/** a launcher result row; `glyph` (an emoji or one character) is shown instead of the icon */
export type Row = { title: string; sub?: string; icon?: string; glyph?: string; run: () => void }

export type LauncherProvider = {
  /** shown in the launcher hint */
  name: string
  /** rows only appear when the query starts with this (e.g. "!"); omit to join normal app search */
  prefix?: string
  /** synchronous: keep async data in your own state and return from it */
  search: (query: string) => Row[]
}

export type BarItem = { position: "left" | "center" | "right"; widget: () => Widget; order?: number }

export type Tile = {
  icon: MaybeAccessor<string>
  title: string
  sub: MaybeAccessor<string>
  active?: Accessor<boolean>
  onClick: () => void
}

export type Disposer = () => void

export interface PluginApi {
  readonly apiVersion: 1
  readonly id: string
  readonly manifest: Manifest
  /** directory of the plugin (read your assets from here) */
  readonly dir: string

  // --- reactivity (the shell's own Gnim instance) ---
  state<T>(init: T): [Accessor<T>, Setter<T>]
  computed<T>(fn: () => T): Accessor<T>
  bind<T extends object, K extends keyof T & string>(obj: T, prop: K): Accessor<T[K]>
  effect(fn: () => void): void
  /** fn every `ms`; value as an accessor; stopped when the plugin unloads */
  poll<T>(init: T, ms: number, fn: (prev: T) => T | Promise<T>): Accessor<T>

  // --- widgets: h("box", { spacing: 6 }, h("label", { label: "hi" })) ---
  h(type: string | ((props: any) => Widget) | (new (props: any) => Widget), props?: Record<string, unknown> | null, ...children: unknown[]): Widget

  // --- system ---
  exec(cmd: string | string[]): Promise<string>
  notify(summary: string, body?: string, urgency?: "low" | "normal" | "critical"): void
  open(uriOrPath: string): void
  log(...args: unknown[]): void

  // --- settings (schema in plugin.json; edited in Settings → Plugins) ---
  readonly settings: Accessor<Record<string, unknown>>
  setSetting(key: string, value: unknown): void

  /** small persistent JSON store: ~/.local/state/ypsilon/plugins/<id>.json */
  readonly storage: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void }

  // --- extension points (each returns a disposer; all are removed on unload) ---
  bar: { add(item: BarItem): Disposer }
  launcher: { addProvider(p: LauncherProvider): Disposer }
  controlCenter: { addTile(t: Tile): Disposer }
  /** `ypsilon plugin run <id> <name> [args…]` → fn(args); return a string to print */
  commands: { add(name: string, fn: (args: string[]) => string | void): Disposer }

  onCleanup(fn: () => void): void
}

/** a plugin module's default export */
export type PluginMain = (api: PluginApi) => void | Disposer | Promise<void | Disposer>
