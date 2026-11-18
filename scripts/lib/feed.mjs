export const FEED_ACCOUNT = 'ausbitbank'
export const FEED_BASE = 'https://hive.ausbit.dev'

export function escapeXml (value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function stripHtml (value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isOwnPost (post, account = FEED_ACCOUNT) {
  return String(post?.author || '').toLowerCase() === String(account).toLowerCase()
}

// Some posts use a title that is empty or only punctuation (Hive allows a
// literal "."). Fall back to the permlink so feed readers never show a blank
// or meaningless item title.
export function feedTitle (post) {
  const title = String(post?.title || '').trim()
  const meaningful = /[\p{L}\p{N}]/u.test(title)
  if (meaningful) return title
  const permlink = String(post?.permlink || '').trim()
  return permlink || 'Hive post'
}

function itemXml (post, { base }) {
  const link = base + '/@' + post.author + '/' + post.permlink
  const date = new Date((post.created || '').replace(' ', 'T') + (post.created?.includes('T') ? '' : 'Z'))
  const published = Number.isFinite(date.getTime()) ? date.toUTCString() : new Date().toUTCString()
  const description = stripHtml(post.body || post.title || '').slice(0, 500)
  return `    <item>
      <title>${escapeXml(feedTitle(post))}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(published)}</pubDate>
      <author>@${escapeXml(post.author)}</author>
      <description>${escapeXml(description)}</description>
    </item>`
}

export function buildFeedXml ({ posts = [], base = FEED_BASE, account = FEED_ACCOUNT, now = new Date() } = {}) {
  const ownPosts = posts.filter(post => isOwnPost(post, account))
  const items = ownPosts.length > 0
    ? ownPosts.map(post => itemXml(post, { base })).join('\n')
    : `    <item>
      <title>hive.ausbit.dev</title>
      <link>${base}/</link>
      <guid isPermaLink="true">${base}/</guid>
      <pubDate>${now.toUTCString()}</pubDate>
      <description>Hive block explorer and toolkit.</description>
    </item>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>hive.ausbit.dev — project updates</title>
    <link>${base}/</link>
    <description>Project updates from @${account}: a Hive block explorer, wallet, governance and market toolkit.</description>
    <language>en-us</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}
