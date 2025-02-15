/* global BigInt */

const { randomBytes } = require('crypto')

const base64url = require('./base64url')

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)

const toJWKParameter = n => base64url.encodeBuffer(Buffer.from(n.toString(16), 'hex'))
const fromBuffer = buf => BigInt(`0x${buf.toString('hex')}`)
const bitLength = n => n.toString(2).length

const eGcdX = (a, b) => {
  let x = ZERO
  let y = ONE
  let u = ONE
  let v = ZERO

  while (a !== ZERO) {
    let q = b / a
    let r = b % a
    let m = x - (u * q)
    let n = y - (v * q)
    b = a
    a = r
    x = u
    y = v
    u = m
    v = n
  }
  return x
}

const gcd = (a, b) => {
  let shift = ZERO
  while (!((a | b) & ONE)) {
    a >>= ONE
    b >>= ONE
    shift++
  }
  while (!(a & ONE)) {
    a >>= ONE
  }
  do {
    while (!(b & ONE)) {
      b >>= ONE
    }
    if (a > b) {
      let x = a
      a = b
      b = x
    }
    b -= a
  } while (b)

  return a << shift
}

const modPow = (a, b, n) => {
  a = toZn(a, n)
  let result = ONE
  let x = a
  while (b > 0) {
    var leastSignificantBit = b % TWO
    b = b / TWO
    if (leastSignificantBit === ONE) {
      result = result * x
      result = result % n
    }
    x = x * x
    x = x % n
  }
  return result
}

const randBetween = (min, max) => {
  const interval = max - min
  const bitLen = bitLength(interval)
  let rnd
  do {
    rnd = fromBuffer(randBits(bitLen))
  } while (rnd > interval)
  return rnd + min
}

const randBits = (bitLength) => {
  const byteLength = Math.ceil(bitLength / 8)
  const rndBytes = randomBytes(byteLength)
  // Fill with 0's the extra bits
  rndBytes[0] = rndBytes[0] & (2 ** (bitLength % 8) - 1)
  return rndBytes
}

const toZn = (a, n) => {
  a = a % n
  return (a < 0) ? a + n : a
}

const odd = (n) => {
  let r = n
  while (r % TWO === ZERO) {
    r = r / TWO
  }
  return r
}

const getPrimeFactors = (e, d, n) => {
  const r = odd(e * d - ONE)

  let y
  do {
    let i = modPow(randBetween(TWO, n), r, n)
    let o = ZERO
    while (i !== ONE) {
      o = i
      i = (i * i) % n
    }
    if (o !== (n - ONE)) {
      y = o
    }
  } while (!y)

  const p = gcd(y - ONE, n)
  const q = n / p

  return p > q ? { p, q } : { p: q, q: p }
}

module.exports = (jwk) => {
  const e = fromBuffer(base64url.decodeToBuffer(jwk.e))
  const d = fromBuffer(base64url.decodeToBuffer(jwk.d))
  const n = fromBuffer(base64url.decodeToBuffer(jwk.n))

  const { p, q } = getPrimeFactors(e, d, n)
  const dp = d % (p - ONE)
  const dq = d % (q - ONE)
  const qi = toZn(eGcdX(toZn(q, p), p), p)

  return {
    ...jwk,
    p: toJWKParameter(p),
    q: toJWKParameter(q),
    dp: toJWKParameter(dp),
    dq: toJWKParameter(dq),
    qi: toJWKParameter(qi)
  }
}
