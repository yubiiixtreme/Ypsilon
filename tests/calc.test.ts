// Run: node --test tests/   (Node 22+ strips types natively)
import { test } from "node:test"
import assert from "node:assert/strict"
import { calc, formatNumber } from "../shell/lib/calc.ts"

test("arithmetic and precedence", () => {
  assert.equal(calc("2+2"), 4)
  assert.equal(calc("2+3*4"), 14)
  assert.equal(calc("(2+3)*4"), 20)
  assert.equal(calc("2^3^2"), 512)
  assert.equal(calc("-3+5"), 2)
  assert.equal(calc("10%4"), 2)
  assert.equal(calc(" 1.5 * 2 "), 3)
  assert.equal(calc("1,5*2"), 3)
})

test("rejects non-math and malformed input", () => {
  for (const bad of ["", "abc", "2+", "(1+2", "1+2)", "process.exit()", "1/0", "2**3", "alert(1)", "1;2"])
    assert.equal(calc(bad), null, bad)
})

test("functions, constants and factorial", () => {
  assert.equal(calc("sqrt(16)"), 4)
  assert.equal(calc("sqrt16"), 4)
  assert.equal(calc("cbrt(27)"), 3)
  assert.equal(calc("abs(-5)"), 5)
  assert.equal(calc("5!"), 120)
  assert.equal(calc("3!+4"), 10)
  assert.equal(calc("2*pi"), Math.PI * 2)
  assert.equal(calc("log(100)"), 2)
  assert.equal(calc("ln(e)"), 1)
  assert.ok(Math.abs(calc("sin(30)")! - 0.5) < 1e-9)
  assert.ok(Math.abs(calc("cos(60)")! - 0.5) < 1e-9)
  assert.equal(calc("+5"), 5)
  assert.equal(calc("--5"), 5)
  assert.equal(calc("sqrt(4)+sin(30)*2"), 3)
  for (const bad of ["foo(2)", "sqrt(-1)", "(-3)!", "5.5!", "999!"])
    assert.equal(calc(bad), null, bad)
})

test("formatting trims float noise", () => {
  assert.equal(formatNumber(0.1 + 0.2), "0.3")
})
