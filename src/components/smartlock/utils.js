import sjcl from 'sjcl'
import base58 from 'bs58'

export function encryptKey (key, password) {
  // encrypt
  const secured = sjcl.encrypt(password, key)

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
