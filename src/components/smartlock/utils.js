import sjcl from 'sjcl'
import base58 from 'bs58'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function encryptKey (key, password) {
  // encrypt with a deliberately expensive KDF for new ciphertexts
  const secured = sjcl.encrypt(password, key, { iter: 100000 })

  // encode
  const bytes = encoder.encode(secured)
  const encoded = base58.encode(bytes)

  return encoded
}

export function decryptKey (secured, password) {
  // decode
  const bytes = base58.decode(secured)

  // decrypt
  const clear = sjcl.decrypt(password, decoder.decode(bytes))

  return clear
}
