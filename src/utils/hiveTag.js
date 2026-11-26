// Hive tag rules.
//
// Hivemind validates feed tags with `^[a-z0-9-_]+$` before running a
// `bridge.get_ranked_posts` query. The chain itself does not, so a post can be
// published with a tag like `banksia.io` and never appear in a tag feed.
// The composer sanitises input to hyphens; read paths only validate, so
// existing posts render instead of hitting an "invalid tag" API error.

export const MAX_TAG_LENGTH = 24

const CHAIN_TAG_RE = /^[a-z0-9][a-z0-9_-]*$/

/** True when hivemind will accept the tag as a feed query. */
export function isValidTag (value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    CHAIN_TAG_RE.test(value)
}

/** Turn free text into a tag the composer can publish. */
export function sanitizeTag (value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/g, '')
}
