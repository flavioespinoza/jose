const isObject = require('../help/is_object')
const secs = require('../help/secs')
const epoch = require('../help/epoch')
const JWS = require('../jws')

const isStringOptional = require('./shared_validations').isStringOptional.bind(undefined, TypeError)

const validateOptions = (options) => {
  if (typeof options.iat !== 'boolean') {
    throw new TypeError('options.iat must be a boolean')
  }

  if (typeof options.kid !== 'boolean') {
    throw new TypeError('options.kid must be a boolean')
  }

  isStringOptional(options.subject, 'options.subject')
  isStringOptional(options.issuer, 'options.issuer')

  if (
    options.audience !== undefined &&
    (
      (typeof options.audience !== 'string' || !options.audience) &&
      (!Array.isArray(options.audience) || options.audience.length === 0 || options.audience.some(a => !a || typeof a !== 'string'))
    )
  ) {
    throw new TypeError('options.audience must be a string or an array of strings')
  }

  if (options.header !== undefined && !isObject(options.header)) {
    throw new TypeError('options.header must be an object')
  }

  isStringOptional(options.algorithm, 'options.algorithm')
  isStringOptional(options.expiresIn, 'options.expiresIn')
  isStringOptional(options.notBefore, 'options.notBefore')
  isStringOptional(options.jti, 'options.jti')
  isStringOptional(options.nonce, 'options.nonce')

  if (!(options.now instanceof Date) || !options.now.getTime()) {
    throw new TypeError('options.now must be a valid Date object')
  }
}

module.exports = (payload, key, options = {}) => {
  if (!isObject(options)) {
    throw new TypeError('options must be an object')
  }

  const {
    algorithm, audience, expiresIn, header = {}, iat = true,
    issuer, jti, kid = true, nonce, notBefore, subject, now = new Date()
  } = options

  validateOptions({
    algorithm, audience, expiresIn, header, iat, issuer, jti, kid, nonce, notBefore, now, subject
  })

  if (!isObject(payload)) {
    throw new TypeError('payload must be an object')
  }

  const unix = epoch(now)

  payload = {
    ...payload,
    sub: subject || payload.sub,
    aud: audience || payload.aud,
    iss: issuer || payload.iss,
    iat: iat ? unix : payload.iat,
    nonce: nonce || payload.nonce,
    exp: expiresIn ? unix + secs(expiresIn) : payload.exp,
    nbf: notBefore ? unix + secs(notBefore) : payload.nbf
  }

  return JWS.sign(payload, key, {
    ...header,
    alg: algorithm || header.alg,
    kid: kid ? key.kid : header.kid
  })
}
