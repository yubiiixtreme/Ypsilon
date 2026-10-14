export const PROFILES = ["power-saver", "balanced", "performance"]
export const LABEL = { "power-saver": "Power saver", balanced: "Balanced", performance: "Performance" }
export const ICON = { "power-saver": "power-profile-power-saver-symbolic", balanced: "power-profile-balanced-symbolic", performance: "power-profile-performance-symbolic" }

/** @param {string} raw `powerprofilesctl get` output -> a known profile or null */
export const parseProfile = (raw) => PROFILES.find((p) => p === raw.trim()) ?? null

/** next profile in the cycle; unknown current starts at balanced */
export const nextProfile = (/** @type {string | null} */ cur) => PROFILES[(PROFILES.indexOf(cur ?? "balanced") + 1) % PROFILES.length]

/** @param {string} q fuzzy name match: "perf", "save", "bal" */
export const matchProfiles = (q) => PROFILES.filter((p) => !q.trim() || (p + " " + LABEL[/** @type {keyof typeof LABEL} */ (p)].toLowerCase()).includes(q.trim().toLowerCase()))
