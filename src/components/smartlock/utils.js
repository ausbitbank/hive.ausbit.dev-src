import sjcl from 'sjcl'
import base58 from 'bs58'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// PBKDF2-HMAC-SHA256 rounds for new ciphertexts. SJCL is pure JavaScript, so
// this is deliberately below OWASP's 600k native-PBKDF2 figure but 3x the old
// 100k: ~1s on a desktop, and existing records keep their original count.
export const KDF_ITERATIONS = 310000

export function encryptKey (key, password) {
  // encrypt with a deliberately expensive KDF for new ciphertexts
  const secured = sjcl.encrypt(password, key, { iter: KDF_ITERATIONS })

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
