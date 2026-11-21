// Topic suggestions derived from the title and body.
//
// This is a local heuristic, not an AI call. Explicit #hashtags win, then
// frequent meaningful words, then the rest of the title. The composer adds
// recent tags and community suggestions on top.

import { normalizeTag } from './drafts'

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'another', 'because', 'been', 'before',
  'being', 'between', 'both', 'could', 'does', 'doing', 'down', 'during', 'each',
  'from', 'further', 'have', 'having', 'here', 'herself', 'himself', 'into', 'itself',
  'just', 'more', 'most', 'only', 'other', 'over', 'same', 'should', 'some', 'such',
  'than', 'that', 'their', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'under', 'until', 'very', 'were', 'what', 'when',
  'where', 'which', 'while', 'with', 'would', 'your', 'yours', 'yourself', 'you',
  'will', 'been', 'were', 'was', 'are', 'our', 'out', 'not', 'but', 'for', 'and',
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'is', 'it', 'as', 'at', 'by', 'be',
  'or', 'if', 'we', 'us', 'my', 'me', 'he', 'she', 'his', 'her', 'they', 'them',
  'this', 'that', 'these', 'those', 'from', 'with', 'has', 'had', 'can', 'may'
])

const WORD_RE = /[a-z][a-z0-9-]{3,40}/gi

function cleanText (value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/[^\s)"'<>]+/gi, ' ')
    .replace(/[#*_~>|]/g, ' ')
}

/** Normalise a topic-like word. Multi-word phrases are not produced. */
function topic (value) {
  const tag = normalizeTag(value)
  if (!tag || tag.length < 4 || STOPWORDS.has(tag)) return ''
  return tag
}

/**
 * Rank candidate topics. Explicit #hashtags are kept first, then title words,
 * then frequent body words. Existing tags and the community are excluded.
 */
export function suggestTopics ({ title = '', body = '', tags = [], community = '', limit = 8 } = {}) {
  const existing = new Set([
    ...(Array.isArray(tags) ? tags : []).map(normalizeTag),
    normalizeTag(community)
  ].filter(Boolean))
  const out = []
  const seen = new Set()
  const push = value => {
    const tag = topic(value)
    if (!tag || existing.has(tag) || seen.has(tag)) return
    seen.add(tag)
    out.push(tag)
  }

  const text = String(title || '') + '\n' + String(body || '')
  for (const match of text.matchAll(/#([a-z0-9][a-z0-9.-]{1,40})/gi)) {
    push(match[1])
    if (out.length >= limit) return out
  }

  const scores = new Map()
  const firstSeen = new Map()
  const addWords = (value, weight) => {
    const matches = cleanText(value).match(WORD_RE) || []
    matches.forEach((word, index) => {
      const tag = topic(word)
      if (!tag) return
      scores.set(tag, (scores.get(tag) || 0) + weight)
      if (!firstSeen.has(tag)) firstSeen.set(tag, index)
    })
  }
  addWords(title, 3)
  addWords(body, 1)

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || (firstSeen.get(a[0]) || 0) - (firstSeen.get(b[0]) || 0))
    .map(([tag]) => tag)
  for (const tag of ranked) {
    push(tag)
    if (out.length >= limit) break
  }
  return out
}
