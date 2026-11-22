// Signing bridge for images.hive.blog uploads.
//
// The image host verifies sha256("ImageSigningChallenge" + file) against the
// account's posting key. Keychain, SmartLock and HiveAuth each sign the exact
// same Buffer-shaped payload; this module keeps that difference in one place
// so every composer can upload images without duplicating login-mode logic.

let keychainPromise = null
let smartlockPromise = null
let hiveauthPromise = null

// Load signers only when the user uploads, not when a composer opens.
export function loadKeychain () {
  return (keychainPromise ||= import('@hiveio/keychain').then(module => module.keychain))
}

export function loadSmartlock () {
  return (smartlockPromise ||= import('components/smartlock/index.js').then(module => module.default))
}

export function loadHiveAuth () {
  return (hiveauthPromise ||= import('src/services/hiveauth').then(module => module.default))
}

/**
 * Make sure SmartLock holds an unlocked posting key.
 *
 * `promptPassword` is a UI callback that resolves to the password (or an empty
 * string when cancelled). Keeping it injected means this module has no Quasar
 * dependency and can be reused from non-component code.
 */
export async function ensureSmartlockUnlocked ({ username, sessionMs, promptPassword } = {}) {
  const user = String(username || '').trim().toLowerCase()
  if (!user) throw new Error('Log in to upload images.')
  const smartlock = await loadSmartlock()
  if (smartlock.isAccountUnlocked(user, sessionMs)) return
  const password = typeof promptPassword === 'function' ? await promptPassword() : ''
  if (!password) throw new Error('SmartLock is locked. Unlock it to upload images.')
  await smartlock.unlockAccount(user, password, false)
}

/**
 * Sign an upload challenge and return the posting-key signature string.
 *
 * `payload` is the JSON Buffer shape produced by `buildImageSigningPayload`.
 * Errors are normalised to readable messages so callers can show them directly.
 */
export async function signImageUploadChallenge ({
  username,
  loginType,
  payload,
  smartlockSessionMs,
  promptPassword
} = {}) {
  const user = String(username || '').trim().toLowerCase()
  if (!user) throw new Error('Log in with Keychain, SmartLock or HiveAuth to upload images.')
  if (!payload) throw new Error('The image upload challenge is missing.')

  if (loginType === 'hiveauth') {
    try {
      const hiveauth = await loadHiveAuth()
      const result = await hiveauth.signChallenge(user, { keyType: 'posting', challenge: payload })
      if (!result?.signature) throw new Error('HiveAuth did not return a signature.')
      return result.signature
    } catch (error) {
      throw new Error(error?.message || 'HiveAuth could not sign the upload.', { cause: error })
    }
  }

  if (loginType === 'keychain') {
    const keychain = await loadKeychain()
    const result = await keychain(window, 'requestSignBuffer', user, payload, 'Posting')
    if (!result?.success) {
      throw new Error(result?.cancel ? 'Cancelled in Keychain.' : (result?.msg || 'Keychain did not sign the upload.'))
    }
    const signature = result.msg || result.result
    if (!signature) throw new Error('Keychain did not return a signature.')
    return signature
  }

  if (loginType === 'smartlock') {
    await ensureSmartlockUnlocked({ username: user, sessionMs: smartlockSessionMs, promptPassword })
    try {
      const smartlock = await loadSmartlock()
      return await smartlock.api.signBuffer(user, payload)
    } catch (error) {
      throw new Error(error?.message || 'SmartLock could not sign the upload.', { cause: error })
    }
  }

  throw new Error('Log in with Keychain, SmartLock or HiveAuth to upload images.')
}
