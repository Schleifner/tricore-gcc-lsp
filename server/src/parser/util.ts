export const enum CharCode {
  Null = 0,
  Tab = 0x09,
  LineFeed = 0x0A,
  CarriageReturn = 0x0D,

  Space = 0x20,
  Exclamation = 0x21,
  DoubleQuote = 0x22,
  Hash = 0x23,
  Dollar = 0x24,
  Percent = 0x25,
  Ampersand = 0x26,
  SingleQuote = 0x27,
  OpenParen = 0x28,
  CloseParen = 0x29,
  Asterisk = 0x2A,
  Plus = 0x2B,
  Comma = 0x2C,
  Minus = 0x2D,
  Dot = 0x2E,
  Slash = 0x2F,

  _0 = 0x30,
  _1 = 0x31,
  _2 = 0x32,
  _3 = 0x33,
  _4 = 0x34,
  _5 = 0x35,
  _6 = 0x36,
  _7 = 0x37,
  _8 = 0x38,
  _9 = 0x39,

  Colon = 0x3A,
  Semicolon = 0x3B,
  LessThan = 0x3C,
  Equals = 0x3D,
  GreaterThan = 0x3E,
  Question = 0x3F,
  At = 0x40,

  A = 0x41,
  B = 0x42,
  C = 0x43,
  D = 0x44,
  E = 0x45,
  F = 0x46,
  G = 0x47,
  H = 0x48,
  I = 0x49,
  J = 0x4A,
  K = 0x4B,
  L = 0x4C,
  M = 0x4D,
  N = 0x4E,
  O = 0x4F,
  P = 0x50,
  Q = 0x51,
  R = 0x52,
  S = 0x53,
  T = 0x54,
  U = 0x55,
  V = 0x56,
  W = 0x57,
  X = 0x58,
  Y = 0x59,
  Z = 0x5A,

  OpenBracket = 0x5B,
  BackSlash = 0x5C,
  CloseBracket = 0x5D,
  _ = 0x5F,
  Backtick = 0x60,

  a = 0x61,
  b = 0x62,
  c = 0x63,
  d = 0x64,
  e = 0x65,
  f = 0x66,
  g = 0x67,
  h = 0x68,
  i = 0x69,
  j = 0x6A,
  k = 0x6B,
  l = 0x6C,
  m = 0x6D,
  n = 0x6E,
  o = 0x6F,
  p = 0x70,
  q = 0x71,
  r = 0x72,
  s = 0x73,
  t = 0x74,
  u = 0x75,
  v = 0x76,
  w = 0x77,
  x = 0x78,
  y = 0x79,
  z = 0x7A,

}

export function isWhiteSpace(c: number): boolean {
  return c === CharCode.Tab || c === CharCode.Space;
}

export function isAlpha(c: number): boolean {
  let lowerC = c | 32;    // unify uppercases and lowercases;
  return lowerC >= CharCode.a && lowerC <= CharCode.z;
}

export function isDecimal(c: number): boolean {
  return c >= CharCode._0 && c <= CharCode._9;
}

export function isNameBeginner(c: number): boolean {
  //  '[._$a-zA-Z]'
  return isAlpha(c)
    || c === CharCode.Dot
    || c === CharCode._
    || c === CharCode.Dollar;
}

export function isPartOfName(c: number): boolean {
  // '[._$a-zA-Z0-9]'
  return isAlpha(c)
    || isDecimal(c)
    || c === CharCode.Dot
    || c === CharCode._
    || c === CharCode.Dollar;
}
