// Pure Hive follow-state composition.
//
// A follow custom_json carries a complete `what` array. Sending only the flag
// being changed silently clears every other relationship, which is why an
// unmute must not reuse a generic unfollow. These helpers add or remove one
// flag while preserving the rest.

export const FOLLOW_FLAGS = ['blog', 'ignore', 'blacklist', 'follow_muted', 'follow_blacklist']

const FLAG_TO_RELATIONSHIP = {
  blog: 'follows',
  ignore: 'ignores',
  blacklist: 'blacklists',
  follow_muted: 'follows_muted',
  follow_blacklist: 'follows_blacklists'
}

export function flagsFromRelationship (relationship = {}) {
  const flags = {}
  for (const flag of FOLLOW_FLAGS) {
    flags[flag] = relationship[FLAG_TO_RELATIONSHIP[flag]] === true
  }
  return flags
}

/**
 * Build the next `what` array. `changes` may contain only the flags to set.
 */
export function followWhat (relationship = {}, changes = {}) {
  const flags = flagsFromRelationship(relationship)
  for (const flag of FOLLOW_FLAGS) {
    if (Object.prototype.hasOwnProperty.call(changes, flag)) {
      flags[flag] = changes[flag] === true
    }
  }
  return FOLLOW_FLAGS.filter(flag => flags[flag])
}

export function followJson (follower, following, relationship = {}, changes = {}) {
  return JSON.stringify(['follow', {
    follower,
    following,
    what: followWhat(relationship, changes)
  }])
}

export function followOperation (follower, following, relationship = {}, changes = {}) {
  return [
    follower,
    'posting',
    ['custom_json', {
      required_posting_auths: [follower],
      id: 'follow',
      json: followJson(follower, following, relationship, changes)
    }]
  ]
}

export default followOperation
