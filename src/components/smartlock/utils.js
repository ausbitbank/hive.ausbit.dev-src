import sjcl from 'sjcl'
import base58 from 'bs58'

export function encryptKey (key, password) {
  // encrypt with a deliberately expensive KDF for new ciphertexts
  const secured = sjcl.encrypt(password, key, { iter: 100000 })

  // encode
  const bytes = Buffer.from(secured, 'utf8')
  const encoded = base58.encode(bytes)

  return encoded
}

export function decryptKey (secured, password) {
  // decode
  const bytes = base58.decode(secured)

  // decrypt
  const clear = sjcl.decrypt(password, bytes.toString('utf8'))

  return clear
}
