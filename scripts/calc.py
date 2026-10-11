#!/usr/bin/env python3
"""`ypsilon calc EXPR` — safe calculator: a tiny recursive-descent parser, never eval().
Functions (degrees for trig), constants pi e tau phi, factorial (5!), ^ for powers."""
import math, re, sys
s = sys.argv[1].strip().lstrip("=").strip().replace(" ", "").lower().replace(",", ".")
if not s or not re.fullmatch(r"[0-9+\-*/%^().!a-z]+", s):
    print("not a valid expression", file=sys.stderr); sys.exit(1)
FUNCS = {"sqrt": math.sqrt, "cbrt": lambda x: x ** (1/3) if x >= 0 else -((-x) ** (1/3)),
         "sin": lambda x: math.sin(math.radians(x)), "cos": lambda x: math.cos(math.radians(x)),
         "tan": lambda x: math.tan(math.radians(x)),
         "asin": lambda x: math.degrees(math.asin(x)), "acos": lambda x: math.degrees(math.acos(x)),
         "atan": lambda x: math.degrees(math.atan(x)),
         "log": math.log10, "ln": math.log, "log2": math.log2,
         "abs": abs, "floor": math.floor, "ceil": math.ceil, "round": round, "trunc": math.trunc, "exp": math.exp}
CONSTS = {"pi": math.pi, "e": math.e, "tau": math.tau, "phi": (1 + math.sqrt(5)) / 2}
i = 0
def peek(): return s[i] if i < len(s) else ""
def num():
    global i
    m = re.match(r"\d*\.?\d+|\d+", s[i:])
    if not m: raise ValueError("number")
    i += len(m.group(0)); return float(m.group(0))
def atom():
    global i
    if peek() == "(":
        i += 1; v = expr()
        if peek() != ")": raise ValueError("paren")
        i += 1; return v
    if peek().isalpha():
        m = re.match(r"[a-z]+", s[i:]); i += len(m.group(0)); name = m.group(0)
        if name in CONSTS: return CONSTS[name]
        if name not in FUNCS: raise ValueError("unknown")
        return FUNCS[name](postfix())
    return num()
def postfix():
    global i
    v = atom()
    while peek() == "!":
        i += 1
        if not float(v).is_integer() or v < 0 or v > 170: raise ValueError("factorial")
        v = math.factorial(int(v))
    return v
def unary():
    global i
    if peek() == "-": i += 1; return -unary()
    if peek() == "+": i += 1; return unary()
    return postfix()
def power():
    global i
    b = unary()
    if peek() == "^": i += 1; return b ** power()
    return b
def term():
    global i
    v = power()
    while peek() in ("*", "/", "%"):
        op = s[i]; i += 1
        if op == "*" and peek() == "*": raise ValueError("op")
        r = power()
        v = v * r if op == "*" else (v / r if op == "/" else v % r)
    return v
def expr():
    global i
    v = term()
    while peek() in ("+", "-"):
        op = s[i]; i += 1; r = term()
        v = v + r if op == "+" else v - r
    return v
try:
    v = expr()
    if i != len(s) or not math.isfinite(v): raise ValueError("bad")
    v = round(v * 1e8) / 1e8
    if float(v).is_integer(): print(int(v))
    else: print(v)
except Exception:
    print("not a valid expression", file=sys.stderr); sys.exit(1)
