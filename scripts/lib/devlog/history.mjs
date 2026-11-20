import { PUBLISHED_POSTS } from './config.mjs'
import { gitMaybe, readJson, slugify, sortBy, writeJson } from './util.mjs'

export function readPublishedPosts () {
  const posts = readJson(PUBLISHED_POSTS, [])
  return Array.isArray(posts) ? posts : []
}

export function latestPublishedPost () {
  return sortBy(readPublishedPosts(), post => post.publishedAt || '', 'desc')[0] || null
}

export function recordPublishedPost (args) {
  const slug = slugify(args.slug || args._[1] || '')
  const url = args.url || args._[2]
  if (!slug && !url) throw new Error('Pass --slug <slug> --url <hive-post-url>')
  const posts = readPublishedPosts()
  const existing = posts.find(post => post.slug === slug || (url && post.url === url))
  const entry = {
    slug: slug || existing?.slug || '',
    title: args.title || existing?.title || slug,
    url: url || existing?.url || '',
    publishedAt: args.date || existing?.publishedAt || new Date().toISOString().slice(0, 10),
    commit: args.commit || existing?.commit || gitMaybe(['rev-parse', '--short', 'HEAD'])
  }
  const next = existing ? posts.map(post => post === existing ? entry : post) : [...posts, entry]
  writeJson(PUBLISHED_POSTS, sortBy(next, post => post.publishedAt || '', 'desc'))
  console.log(`Recorded ${entry.url || entry.slug}`)
  return entry
}
