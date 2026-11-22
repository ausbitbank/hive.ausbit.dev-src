// Vote breakdown helpers.
//
// Condenser, bridge and cached/snapshot reads all describe votes slightly
// differently: `rshares`/`percent` may be numbers or numeric strings, an
// entry may be missing fields, and a partially hydrated post may have no
// `active_votes` at all. The votes dialog must render whatever it is given
// without throwing, so normalise the list once and derive everything from it.

function finiteNumber (value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Direction of a vote. `rshares` is authoritative when non-zero; `percent` is
 * the fallback because bridge-only rows sometimes omit rshares.
 */
export function voteDirection (vote) {
  if (!vote || typeof vote !== 'object') return 0
  const rshares = finiteNumber(vote.rshares)
  if (rshares) return Math.sign(rshares)
  const percent = finiteNumber(vote.percent)
  if (percent) return Math.sign(percent)
  return 0
}

/** Coerce one raw vote row into the shape the dialog renders. */
export function normalizeVote (vote) {
  if (!vote || typeof vote !== 'object') return null
  const voter = typeof vote.voter === 'string' ? vote.voter.trim() : ''
  if (!voter) return null

  const rshares = finiteNumber(vote.rshares)
  const percent = finiteNumber(vote.percent)
  const reputation = finiteNumber(vote.reputation)
  return {
    voter,
    rshares: rshares ?? 0,
    percent: percent ?? null,
    reputation: reputation ?? null,
    time: typeof vote.time === 'string' ? vote.time : ''
  }
}

/** Normalise a vote list, dropping entries that cannot be rendered. */
export function normalizeVotes (votes) {
  if (!Array.isArray(votes)) return []
  return votes.map(normalizeVote).filter(Boolean)
}
