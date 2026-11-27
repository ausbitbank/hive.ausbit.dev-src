// Signing bridge for Vault grant bulletins.
//
// A Vault bulletin is a normal Hive comment, but its `json_metadata` payload is
// signed separately with the creator's posting key so a reader can verify the
// grant without trusting a Banksia server. Keychain, HiveAuth and SmartLock
// sign exactly the same payload shape as `signBufferData`; this module keeps
// the login-mode differences in one place, mirroring `imageSigning.js`.
//
// The posting key is only ever used to authenticate the bulletin. It is never
// used as an encryption key and never leaves the local signer.

let keychainPromise = null
let smartlockPromise = null
let hiveauthPromise = null
let hiveTxPromise = null
let sha256Promise = null

function loadKeychain () {
  return (keychainPromise ||= import('@hiveio/keychain').then(module => module.keychain))
}

function loadSmartlock () {
  return (smartlockPromise ||= import('components/smartlock/index.js').then(module => module.default))
}

function loadHiveAuth () {
  return (hiveauthPromise ||= import('src/services/hiveauth').then(module => module.default))
}

function loadHiveTx () {
  return (hiveTxPromise ||= import('hive-tx'))
}

function loadSha256 () {
  return (sha256Promise ||= import('@noble/hashes/sha256').then(module => module.sha256))
}

/**
 * Make sure SmartLock holds an unlocked posting key.
 *
 * `promptPassword` is injected by the caller so this module stays free of
 * Quasar dependencies and can run from services and tests.
 */
export async function ensureVaultSignerUnlocked ({ username, sessionMs, promptPassword } = {}) {
  const user = String(username || '').trim().toLowerCase()
  if (!user) throw new Error('Log in to sign a Vault bulletin.')
  const smartlock = await loadSmartlock()
  if (smartlock.isAccountUnlocked(user, sessionMs)) return
  const password = typeof promptPassword === 'function' ? await promptPassword() : ''
  if (!password) throw new Error('SmartLock is locked. Unlock it to sign the bulletin.')
  await smartlock.unlockAccount(user, password, false)
}

/**
 * Sign a canonical Vault payload with the account's posting authority.
 *
 * Returns the signature string exactly as the Hive signers emit it (hex,
 * 130 chars), so `verifyVaultPayload` can recover the posting public key.
 */
export async function signVaultPayload ({
  username,
  loginType,
  payload,
  smartlockSessionMs,
  promptPassword
} = {}) {
  const user = String(username || '').trim().toLowerCase()
  if (!user) throw new Error('Log in with Keychain, SmartLock or HiveAuth to sign a bulletin.')
  if (typeof payload !== 'string' || !payload) throw new Error('The Vault payload is missing.')

  if (loginType === 'hiveauth') {
    const hiveauth = await loadHiveAuth()
    const result = await hiveauth.signChallenge(user, { keyType: 'posting', challenge: payload })
    if (!result?.signature) throw new Error('HiveAuth did not return a signature.')
    return result.signature
  }

  if (loginType === 'keychain') {
    const keychain = await loadKeychain()
    const result = await keychain(window, 'requestSignBuffer', user, payload, 'Posting')
    if (!result?.success) {
      throw new Error(result?.cancel ? 'Cancelled in Keychain.' : (result?.msg || 'Keychain did not sign the bulletin.'))
    }
    const signature = result.msg || result.result
    if (!signature) throw new Error('Keychain did not return a signature.')
    return signature
  }

  if (loginType === 'smartlock') {
    await ensureVaultSignerUnlocked({ username: user, sessionMs: smartlockSessionMs, promptPassword })
    const smartlock = await loadSmartlock()
    return smartlock.api.signBuffer(user, payload)
  }

  throw new Error('Log in with Keychain, SmartLock or HiveAuth to sign a bulletin.')
}

/**
 * Verify a Vault payload against a Hive public key.
 *
 * `PublicKey.verify` is avoided because it needs a full Message object; the
 * recoverable signature plus the SHA-256 of the UTF-8 payload is the same
 * construction `hive-tx` and Keychain use. Returns false for malformed input
 * instead of throwing, so a tampered bulletin renders a safe error.
 */
export async function verifyVaultPayload ({ payload, signature, publicKey } = {}) {
  if (typeof payload !== 'string' || !payload) return false
  const sig = String(signature || '').trim().replace(/^0x/i, '')
  const key = String(publicKey || '').trim()
  if (!sig || !key) return false
  try {
    const [hiveModule, shaFn] = await Promise.all([loadHiveTx(), loadSha256()])
    const digest = shaFn(new TextEncoder().encode(payload))
    const recovered = hiveModule.Signature.from(sig).getPublicKey(digest).toString()
    return recovered === key
  } catch {
    return false
  }
}

/** Posting public keys from a `conda get_accounts` authority object. */
export function postingPublicKeys (account) {
  const auth = account && account.posting
  const keyAuths = Array.isArray(auth && auth.key_auths) ? auth.key_auths : []
  return keyAuths
    .map(entry => Array.isArray(entry) ? entry[0] : entry && entry[0])
    .filter(key => typeof key === 'string' && /^STM/.test(key))
}

/**
 * Verify a signature against any of the account's posting keys.
 * `publicKeys` may be an authority object or an explicit key list.
 */
export async function verifyVaultPayloadForAccount ({ payload, signature, account, publicKeys } = {}) {
  const keys = Array.isArray(publicKeys) ? publicKeys : postingPublicKeys(account)
  if (!keys.length) return false
  for (const key of keys) {
    if (await verifyVaultPayload({ payload, signature, publicKey: key })) return true
  }
  return false
}
