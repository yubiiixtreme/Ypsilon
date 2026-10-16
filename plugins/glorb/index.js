// @ts-check
import * as G from "./glorb.js";

/** @param {import("../../shell/lib/plugin-types").PluginApi} api */
export default function glorb(api) {
  const settings = () => /** @type {{ hungerRate: number, grumpyCpu: number }} */ (
    /** @type {unknown} */ (api.settings.peek())
  );
  const [pet, setPet] = api.state(api.storage.get("pet", G.newborn(Date.now())));
  const [cpu, setCpu] = api.state(0.2);

  const save = (/** @type {import("./glorb.js").Pet} */ p) => (setPet(p), api.storage.set("pet", p));
  const aged = () => {
    const p = G.tick(pet.peek(), Date.now(), { cpu: cpu.peek(), mem: 0 }, { hungerRate: settings().hungerRate });
    if (p.lastTick !== pet.peek().lastTick || p.xp !== pet.peek().xp) save(p);
    return p;
  };

  // sample CPU from /proc/stat roughly every 5s; Glorb reacts to real load
  /** @type {{ total: number, idle: number } | null} */
  let prev = null;
  api.poll(Date.now(), 5000, async () => {
    try {
      const out = await api.exec(["cat", "/proc/stat"]);
      const line = out.split("\n")[0].split(/\s+/).slice(1, 5).map(Number);
      const total = line.reduce((a, b) => a + b, 0);
      const idle = line[3] ?? 0;
      if (prev) {
        const dt = total - prev.total;
        if (dt > 0) setCpu(1 - (idle - prev.idle) / dt);
      }
      prev = { total, idle };
    } catch { /* Glorb survives without /proc */ }
    return Date.now();
  });

  const face = api.computed(() => G.mood(pet(), { cpu: cpu(), mem: 0 }).emoji);
  const label = api.computed(() => G.mood(pet(), { cpu: cpu(), mem: 0 }).text);

  const doFeed = () => {
    const p = G.feed(aged(), Date.now());
    save(p);
    return `glorb munches (${100 - p.hunger}% full)`;
  };
  const doPet = () => {
    const p = G.play(aged(), Date.now());
    save(p);
    return `glorb wiggles (+happiness ${p.happiness}%)`;
  };
  const doNap = () => {
    save(G.nap(aged(), Date.now()));
    return "glorb naps… zzz";
  };
  const doParty = () => {
    const p = G.play(G.feed(aged(), Date.now()), Date.now());
    save({ ...p, happiness: 100, energy: Math.max(p.energy, 60) });
    api.notify("🪩 Glorb party", "disco for 30 seconds. glorb is maximal.", "normal");
    return "party! glorb is maximal";
  };

  api.bar.add({
    position: "right",
    order: 40,
    widget: () =>
      api.h("button", { class: "pill-btn plugin-glorb", onClicked: doPet, tooltipText: "glorb: click = pet, launcher `glorb` = feed/party" },
        api.h("box", { spacing: 6 },
          api.h("label", { label: face }),
          api.h("label", { label }),
        )),
  });

  api.controlCenter.addTile({
    icon: "face-smile-symbolic",
    title: "Glorb",
    sub: label,
    onClick: doPet,
  });

  api.launcher.addProvider({
    name: "glorb: feed · pet · nap · party",
    prefix: "glorb",
    search: (q) => {
      const p = aged();
      const m = G.mood(p, { cpu: cpu.peek(), mem: 0 });
      const rows = [
        { title: `Status: ${m.emoji} ${m.text}`, sub: `hunger ${p.hunger}% · happy ${p.happiness}% · xp ${p.xp}`, icon: "face-smile-symbolic", run: () => {} },
        { title: "Feed glorb 🍖", icon: "emoji-food-symbolic", run: () => void api.notify("Glorb", doFeed(), "normal") },
        { title: "Pet glorb ✨", icon: "face-smile-symbolic", run: () => void api.notify("Glorb", doPet(), "normal") },
        { title: "Nap 😴", icon: "weather-clear-night-symbolic", run: () => void api.notify("Glorb", doNap(), "normal") },
        { title: "PARTY 🪩", sub: "maximal glorb", icon: "party-popper-symbolic", run: doParty },
      ];
      return q ? rows.filter((r) => `${r.title}`.toLowerCase().includes(q.toLowerCase())) : rows;
    },
  });

  api.launcher.addProvider({
    name: "dice: NdM · coin · 8ball",
    prefix: "roll",
    search: (q) => {
      const full = `roll${q ? ` ${q}` : ""}`.trim();
      const short = full.replace(/^roll\s*/, "");
      const g = G.parseGame(short || "d20");
      if (!g) return [{ title: "try: roll 2d20+3 · coin · 8ball …", icon: "roll-symbolic", run: () => {} }];
      if (g.kind === "coin") return [{ title: `flip: ${G.coinFlip()}`, icon: "coin-symbolic", run: () => void api.notify("Coin", G.coinFlip(), "normal") }];
      if (g.kind === "eight") return [{ title: `🎱 ${G.eightBall()}`, icon: "dialog-question-symbolic", run: () => void api.notify("8ball", G.eightBall(), "normal") }];
      const r = G.rollDice(g);
      return [{ title: `${short || "d20"} → ${r.total}  [${r.rolls.join(", ")}]`, icon: "roll-symbolic", run: () => void api.notify("Dice", `${short} → ${r.total}`, "normal") }];
    },
  });

  api.commands.add("status", () => {
    const p = aged();
    const m = G.mood(p, { cpu: cpu.peek(), mem: 0 });
    return `${m.emoji} ${m.text} (hunger ${p.hunger} happy ${p.happiness} energy ${p.energy} xp ${p.xp})`;
  });
  api.commands.add("feed", doFeed);
  api.commands.add("pet", doPet);
  api.commands.add("nap", doNap);
  api.commands.add("party", doParty);
}
