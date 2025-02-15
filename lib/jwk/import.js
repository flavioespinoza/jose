const { createPublicKey, createPrivateKey, createSecretKey, KeyObject } = require('crypto')

const base64url = require('../help/base64url')
const isObject = require('../help/is_object')
const { jwkToPem } = require('../help/key_utils')
const errors = require('../errors')

const RSAKey = require('./key/rsa')
const ECKey = require('./key/ec')
const OKPKey = require('./key/okp')
const OctKey = require('./key/oct')

const importable = new Set(['string', 'buffer', 'object'])

const mergedParameters = (target = {}, source = {}) => {
  return Object.assign({}, {
    alg: source.alg,
    key_ops: source.key_ops,
    kid: source.kid,
    use: source.use,
    x5c: source.x5c,
    x5t: source.x5t,
    'x5t#S256': source['x5t#S256']
  }, target)
}

const importKey = (key, parameters) => {
  let privateKey, publicKey, secret

  if (!importable.has(typeof key)) {
    throw new TypeError('key argument must be a string, buffer or an object')
  }

  if (parameters !== undefined && !isObject(parameters)) {
    throw new TypeError('parameters argument must be a plain object when provided')
  }

  if (key instanceof KeyObject) {
    switch (key.type) {
      case 'private':
        privateKey = key
        break
      case 'public':
        publicKey = key
        break
      case 'secret':
        secret = key
        break
    }
  } else if (typeof key === 'object' && 'kty' in key && key.kty === 'oct') { // symmetric key <Object>
    try {
      secret = createSecretKey(base64url.decodeToBuffer(key.k))
    } catch (err) {
      if (!('k' in key)) {
        secret = { type: 'secret' }
      }
    }
    parameters = mergedParameters(parameters, key)
  } else if (typeof key === 'object' && 'kty' in key) { // assume JWK formatted asymmetric key <Object>
    let pem
    try {
      pem = jwkToPem(key)
    } catch (err) {
      if (err instanceof errors.JOSEError) {
        throw err
      }
    }
    if (pem && key.d) {
      privateKey = createPrivateKey(pem)
    } else if (pem) {
      publicKey = createPublicKey(pem)
    }
    parameters = mergedParameters(parameters, key)
  } else { // <Object> | <string> | <Buffer> passed to crypto.createPrivateKey or crypto.createPublicKey or <Buffer> passed to crypto.createSecretKey
    try {
      privateKey = createPrivateKey(key)
    } catch (err) {}
    try {
      publicKey = createPublicKey(key)
    } catch (err) {}
    try {
      // this is to filter out invalid PEM keys and certs, i'll rather have them fail import then
      // have them imported as symmetric "oct" keys
      if (!key.includes('-----BEGIN')) {
        secret = createSecretKey(Buffer.isBuffer(key) ? key : Buffer.from(key))
      }
    } catch (err) {}
  }

  const keyObject = privateKey || publicKey || secret

  if (privateKey || publicKey) {
    switch (keyObject.asymmetricKeyType) {
      case 'rsa':
        return new RSAKey(keyObject, parameters)
      case 'ec':
        return new ECKey(keyObject, parameters)
      case 'ed25519':
      case 'ed448':
      case 'x25519':
      case 'x448':
        return new OKPKey(keyObject, parameters)
      default:
        throw new errors.JOSENotSupported('only RSA, EC and OKP asymmetric keys are supported')
    }
  } else if (secret) {
    return new OctKey(keyObject, parameters)
  }

  throw new errors.JWKImportFailed('import failed')
}

module.exports = importKey
