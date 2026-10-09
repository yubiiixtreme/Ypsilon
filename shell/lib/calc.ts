// Safe arithmetic evaluator for the launcher (`=2*(3+4)`). No eval/Function.
// Grammar: expr = term (('+'|'-') term)* ; term = pow (('*'|'/'|'%') pow)* ;
//          pow = unary ('^' pow)? ; unary = ('-'|'+') unary | postfix ;
//          postfix = atom ('!')* ; atom = number | constant | func postfix | '(' expr ')'
// Functions (degrees for trig): sqrt cbrt sin cos tan asin acos atan log ln log2
//   abs floor ceil round trunc exp. Constants: pi e tau phi. Factorial: 5! = 120.
const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
  log: (x) => Math.log10(x),
  ln: Math.log,
  log2: Math.log2,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  trunc: Math.trunc,
  exp: Math.exp,
}

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error("factorial")
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

export function calc(input: string): number | null {
  const s = input.replace(/\s+/g, "").toLowerCase()
  if (s === "" || !/^[0-9+\-*/%^().,!a-z]+$/.test(s)) return null
  let i = 0

  const peek = () => s[i]
  const num = (): number => {
    const m = /^\d*[.,]?\d+|^\d+/.exec(s.slice(i))
    if (!m) throw new Error("number")
    i += m[0].length
    return parseFloat(m[0].replace(",", "."))
  }
  const atom = (): number => {
    if (peek() === "(") {
      i++
      const v = expr()
      if (peek() !== ")") throw new Error("paren")
      i++
      return v
    }
    if (peek() && /[a-z]/.test(peek())) {
      const m = /^[a-z]+/.exec(s.slice(i))!
      i += m[0].length
      const name = m[0]
      if (name in CONSTS) return CONSTS[name]
      const fn = FUNCS[name]
      if (!fn) throw new Error("unknown")
      // sqrt(16) or sqrt16 or sqrt-4
      const v = postfix()
      return fn(v)
    }
    return num()
  }
  const postfix = (): number => {
    let v = atom()
    while (peek() === "!") {
      i++
      v = factorial(v)
    }
    return v
  }
  const unary = (): number => {
    if (peek() === "-") return (i++, -unary())
    if (peek() === "+") return (i++, unary())
    return postfix()
  }
  const pow = (): number => {
    const b = unary()
    if (peek() === "^") {
      i++
      return Math.pow(b, pow())
    }
    return b
  }
  const term = (): number => {
    let v = pow()
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = s[i++]
      // "**" is not a power operator here (kept invalid so typos don't silently work)
      if (op === "*" && peek() === "*") throw new Error("op")
      const r = pow()
      v = op === "*" ? v * r : op === "/" ? v / r : v % r
    }
    return v
  }
  const expr = (): number => {
    let v = term()
    while (peek() === "+" || peek() === "-") {
      const op = s[i++]
      const r = term()
      v = op === "+" ? v + r : v - r
    }
    return v
  }

  try {
    const v = expr()
    return i === s.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

export const formatNumber = (v: number) => String(Math.round(v * 1e8) / 1e8)
