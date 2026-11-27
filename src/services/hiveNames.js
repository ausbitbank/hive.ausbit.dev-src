// Hive account-name validation.
//
// Kept local (and synchronous) because search parsing and SmartLock validation
// both need it without pulling the signing stack into their route chunks. The
// rules and messages match hive-tx's `utils.validateUsername` and the old
// `@hiveio/hive-js` implementation.

export function validateAccountName (username) {
  let suffix = 'Account name should '
  if (!username || typeof username !== 'string') {
    return suffix + 'not be empty.'
  }
  const length = username.length
  if (length < 3) {
    return suffix + 'be longer.'
  }
  if (length > 16) {
    return suffix + 'be shorter.'
  }
  if (/\./.test(username)) {
    suffix = 'Each account segment should '
  }
  const ref = username.split('.')
  for (const label of ref) {
    if (!/^[a-z]/.test(label)) {
      return suffix + 'start with a lowercase letter.'
    }
    if (!/^[a-z0-9-]*$/.test(label)) {
      return suffix + 'have only lowercase letters, digits, or dashes.'
    }
    if (!/[a-z0-9]$/.test(label)) {
      return suffix + 'end with a lowercase letter or digit.'
    }
    if (label.length < 3) {
      return suffix + 'be longer'
    }
  }
  return null
}

export function isValidAccountName (username) {
  return validateAccountName(username) === null
}
