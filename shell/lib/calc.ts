// Safe arithmetic evaluator for the launcher (`=2*(3+4)`). No eval/Function.
// Grammar: expr = term (('+'|'-') term)* ; term = pow (('*'|'/'|'%') pow)* ;
//          pow = unary ('^' pow)? ; unary = '-' unary | atom ; atom = number | '(' expr ')'
export function calc(input: string): number | null {
  const s = input.replace(/\s+/g, "")
  if (s === "" || !/^[0-9+\-*/%^().,]+$/.test(s)) return null
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
    return num()
  }
  const unary = (): number => (peek() === "-" ? (i++, -unary()) : atom())
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
