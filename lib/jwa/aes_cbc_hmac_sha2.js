const { strict: assert } = require('assert')
const { createCipheriv, createDecipheriv } = require('crypto')

const uint64be = require('../help/uint64be')
const timingSafeEqual = require('../help/timing_safe_equal')
const { KEYOBJECT } = require('../help/consts')
const { JWEInvalid, JWEDecryptionFailed } = require('../errors')

const checkInput = function (size, iv, tag) {
  if (iv.length !== 16) {
    throw new JWEInvalid('invalid iv')
  }
  if (arguments.length === 3) {
    if (tag.length !== size / 8) {
      throw new JWEInvalid('invalid tag')
    }
  }
}

const encrypt = (size, sign, { [KEYOBJECT]: keyObject }, cleartext, { iv, aad = Buffer.alloc(0) }) => {
  const key = keyObject.export()
  checkInput(size, iv)

  const keySize = size / 8
  const encKey = key.slice(keySize)
  const cipher = createCipheriv(`AES-${size}-CBC`, encKey, iv)
  const ciphertext = Buffer.concat([cipher.update(cleartext), cipher.final()])
  const macData = Buffer.concat([aad, iv, ciphertext, uint64be(aad.length * 8)])

  const macKey = key.slice(0, keySize)
  const tag = sign({ [KEYOBJECT]: macKey }, macData).slice(0, keySize)

  return { ciphertext, tag }
}

const decrypt = (size, sign, { [KEYOBJECT]: keyObject }, ciphertext, { iv, tag = Buffer.alloc(0), aad = Buffer.alloc(0) }) => {
  checkInput(size, iv, tag)

  const keySize = size / 8
  const key = keyObject.export()
  const encKey = key.slice(keySize)
  const macKey = key.slice(0, keySize)

  const macData = Buffer.concat([aad, iv, ciphertext, uint64be(aad.length * 8)])
  const expectedTag = sign({ [KEYOBJECT]: macKey }, macData, tag).slice(0, keySize)
  const macCheckPassed = timingSafeEqual(tag, expectedTag)

  let cleartext
  try {
    const cipher = createDecipheriv(`AES-${size}-CBC`, encKey, iv)
    cleartext = Buffer.concat([cipher.update(ciphertext), cipher.final()])
  } catch (err) {}

  if (!cleartext || !macCheckPassed) {
    throw new JWEDecryptionFailed()
  }

  return cleartext
}

module.exports = (JWA) => {
  ['A128CBC-HS256', 'A192CBC-HS384', 'A256CBC-HS512'].forEach((jwaAlg) => {
    const size = parseInt(jwaAlg.substr(1, 3), 10)

    assert(!JWA.encrypt.has(jwaAlg), `encrypt alg ${jwaAlg} already registered`)
    assert(!JWA.decrypt.has(jwaAlg), `decrypt alg ${jwaAlg} already registered`)

    JWA.encrypt.set(jwaAlg, encrypt.bind(undefined, size, JWA.sign.get(`HS${size * 2}`)))
    JWA.decrypt.set(jwaAlg, decrypt.bind(undefined, size, JWA.sign.get(`HS${size * 2}`)))
  })
}
