// Lightweight replacement for `remarkable/linkify`.
//
// The upstream plugin uses Autolinker (~200 KB of source) to find URLs and
// email addresses. `linkify-it` plus the IANA TLD list produces identical
// rendered output on a corpus of real Hive posts and is much smaller.
//
// The token walk mirrors remarkable/linkify so markdown links, raw <a> tags
// and the surrounding text tokens are handled the same way.

import { LinkifyIt } from 'linkify-it'
import { TLDS } from './tlds'

const LINK_SCAN_RE = /www|@|:\/\//
const linkifier = new LinkifyIt()
linkifier.tlds(TLDS, false)
linkifier.set({ fuzzyLink: true, fuzzyEmail: true })

function isLinkOpen (value) {
  return /^<a[>\s]/i.test(value)
}

function isLinkClose (value) {
  return /^<\/a\s*>/i.test(value)
}

function parseTokens (state) {
  const blockTokens = state.tokens

  for (let j = 0; j < blockTokens.length; j++) {
    if (blockTokens[j].type !== 'inline') continue
    let tokens = blockTokens[j].children
    let htmlLinkLevel = 0

    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i]

      if (token.type === 'link_close') {
        i--
        while (tokens[i].level !== token.level && tokens[i].type !== 'link_open') i--
        continue
      }

      if (token.type === 'htmltag') {
        if (isLinkOpen(token.content) && htmlLinkLevel > 0) htmlLinkLevel--
        if (isLinkClose(token.content)) htmlLinkLevel++
      }
      if (htmlLinkLevel > 0) continue

      if (token.type !== 'text' || !LINK_SCAN_RE.test(token.content)) continue

      const text = token.content
      const matches = linkifier.match(text) || []
      if (!matches.length) continue

      const nodes = []
      let level = token.level
      let rest = text
      for (const match of matches) {
        if (!state.inline.validateLink(match.url)) continue
        const pos = rest.indexOf(match.text)
        if (pos) nodes.push({ type: 'text', content: rest.slice(0, pos), level })
        nodes.push({ type: 'link_open', href: match.url, title: '', level: level++ })
        nodes.push({ type: 'text', content: match.text, level })
        nodes.push({ type: 'link_close', level: --level })
        rest = rest.slice(pos + match.text.length)
      }
      if (rest.length) nodes.push({ type: 'text', content: rest, level })

      blockTokens[j].children = tokens = [].concat(tokens.slice(0, i), nodes, tokens.slice(i + 1))
    }
  }
}

export function linkify (md) {
  md.core.ruler.push('linkify', parseTokens)
}
