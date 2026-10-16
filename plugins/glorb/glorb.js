// Glorb: a desktop pet. Pure state machine (unit-tested in tests/plugins.test.mjs).
// State is never mutated — every function returns a new object.
// hunger: 0 (stuffed) .. 100 (starving) · happiness/energy: 0..100 · xp grows forever.

/** @typedef {{ hunger: number, happiness: number, energy: number, xp: number, lastTick: number }} Pet */
/** @typedef {{ cpu: number, mem: number }} Load */ // 0..1 fractions

const clamp = (/** @type {number} */ n) => Math.max(0, Math.min(100, Math.round(n)));

/** @param {number} now ms epoch @returns {Pet} */
export function newborn(now) {
  return { hunger: 20, happiness: 80, energy: 100, xp: 0, lastTick: now };
}

/**
 * Advance the pet to `now` given system load.
 * Hungry + hot CPUs make Glorb grumpy. Idle machines make it sleepy-happy.
 * @param {Pet} p @param {number} now @param {Load} load @param {{ hungerRate?: number }} [opts]
 * @returns {Pet}
 */
export function tick(p, now, load, opts = {}) {
  const rate = opts.hungerRate ?? 2;
  const dtMin = Math.max(0, (now - p.lastTick) / 60000);
  const capped = Math.min(dtMin, 240); // away for 4h+ = same as 4h, Glorb forgives
  const cpu = Math.max(0, Math.min(1, load.cpu ?? 0));
  return {
    hunger: clamp(p.hunger + capped * (0.8 + rate * 0.4) + cpu * 4),
    happiness: clamp(p.happiness - capped * (0.5 + cpu * 1.2) - (p.hunger > 70 ? capped * 1.5 : 0)),
    energy: clamp(p.energy - capped * 0.4 + (cpu < 0.15 ? capped * 0.6 : 0)),
    xp: p.xp + Math.floor(capped),
    lastTick: now,
  };
}

/** @param {Pet} p @param {number} now @returns {Pet} */
export function feed(p, now) {
  return { ...p, hunger: clamp(p.hunger - 35), happiness: clamp(p.happiness + 8), xp: p.xp + 2, lastTick: now };
}

/** @param {Pet} p @param {number} now @returns {Pet} */
export function play(p, now) {
  return {
    ...p,
    hunger: clamp(p.hunger + 5),
    happiness: clamp(p.happiness + 15),
    energy: clamp(p.energy - 10),
    xp: p.xp + 3,
    lastTick: now,
  };
}

/** @param {Pet} p @param {number} now @returns {Pet} */
export function nap(p, now) {
  return { ...p, energy: 100, hunger: clamp(p.hunger + 4), lastTick: now };
}

/**
 * Glorb's current form. Unimaginable but deterministic:
 * neglected -> ghost, overloaded CPU -> fire, idle + happy -> chill,
 * xp milestones -> baby/teen/adult/cosmic.
 * @param {Pet} p @param {Load} load @returns {{ emoji: string, form: string }}
 */
export function evolve(p, load) {
  const cpu = load.cpu ?? 0;
  if (p.hunger >= 100 && p.happiness <= 10) return { emoji: "👻", form: "ghost (feed me!)" };
  if (cpu > 0.85 && p.hunger > 50) return { emoji: "🔥", form: "fire-glorb (your CPU is cooking)" };
  if (cpu < 0.15 && p.happiness > 60) return { emoji: "🧊", form: "chill-glorb" };
  if (p.xp > 500) return { emoji: "🌈", form: "cosmic-glorb" };
  if (p.xp > 100) return { emoji: "👾", form: "adult" };
  if (p.xp > 20) return { emoji: "🐙", form: "teen" };
  if (p.xp > 3) return { emoji: "🐣", form: "baby" };
  return { emoji: "🥚", form: "egg" };
}

/** @param {Pet} p @param {Load} load @returns {{ emoji: string, text: string }} */
export function mood(p, load) {
  const evo = evolve(p, load);
  if (p.hunger >= 80) return { emoji: "🍖", text: `${evo.form} is STARVING` };
  if (p.energy <= 15) return { emoji: "😴", text: `${evo.form} needs a nap` };
  if (p.happiness >= 70) return { emoji: evo.emoji, text: `${evo.form} vibes` };
  if (p.happiness <= 25) return { emoji: "😤", text: `${evo.form} judges your tabs` };
  return { emoji: evo.emoji, text: evo.form };
}

/** stored JSON may be anything: keep a sane pet */
export function sanitize(/** @type {unknown} */ raw, /** @type {number} */ now) {
  if (!raw || typeof raw !== "object") return newborn(now);
  const r = /** @type {Record<string, unknown>} */ (raw);
  const num = (/** @type {unknown} */ v, /** @type {number} */ d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    hunger: clamp(num(r.hunger, 20)),
    happiness: clamp(num(r.happiness, 80)),
    energy: clamp(num(r.energy, 100)),
    xp: Math.max(0, Math.floor(num(r.xp, 0))),
    lastTick: typeof r.lastTick === "number" ? r.lastTick : now,
  };
}

// --- dice dungeon: roll NdM+k, coin flips, magic 8-ball. All pure. ---

/**
 * Parse "2d20", "d6", "3d8+5", "coin", "8ball will I ship it".
 * @param {string} text
 * @returns {{ kind: "dice", n: number, sides: number, mod: number } | { kind: "coin" } | { kind: "eight" } | null}
 */
export function parseGame(text) {
  const s = text.trim().toLowerCase();
  if (!s) return null;
  if (/^(coin|flip)( .*)?$/.test(s)) return { kind: "coin" };
  if (/^8ball(\s+.+)?$/.test(s)) return { kind: "eight" };
  const m = /^(?:(\d{1,2})?d(\d{1,3}))\s*([+-]\s*\d{1,3})?$/.exec(s);
  if (!m) return null;
  const n = m[1] === undefined || m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3].replace(/\s+/g, "")) : 0;
  if (n < 1 || n > 20 || sides < 2 || sides > 100) return null;
  return { kind: "dice", n, sides, mod };
}

/**
 * @param {{ n: number, sides: number, mod: number }} spec
 * @param {() => number} [rand] 0..1
 * @returns {{ rolls: number[], total: number }}
 */
export function rollDice(spec, rand = Math.random) {
  const rolls = Array.from({ length: spec.n }, () => 1 + Math.floor(rand() * spec.sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + spec.mod };
}

/** @param {() => number} [rand] */
export function coinFlip(rand = Math.random) {
  return rand() < 0.5 ? "heads" : "tails";
}

const EIGHT = [
  "yes. glorb has seen it.",
  "no. touch grass first.",
  "maybe. feed glorb and ask again.",
  "the CPU spirits say: ship it.",
  "404 prophecy not found.",
  "only on a full moon (or after coffee).",
  "glorb judges you silently. that means yes.",
  "nope. but style points for asking.",
];

/** @param {() => number} [rand] */
export function eightBall(rand = Math.random) {
  return EIGHT[Math.floor(rand() * EIGHT.length)];
}
