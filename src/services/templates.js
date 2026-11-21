// Post templates for the composer.
//
// A template stores the reusable parts of a draft: title skeleton, body,
// community, tags, presentation metadata and reward defaults. It deliberately
// does not store the draft id, cross-post attribution or edit identity.

import { normalizeDraft } from './drafts'

export const TEMPLATE_STORAGE_PREFIX = 'composeTemplates:'
export const TEMPLATE_VERSION = 1
export const MAX_TEMPLATES = 30
export const MAX_TEMPLATE_NAME = 80
export const MAX_TEMPLATE_SUMMARY = 200

const ACCOUNT_RE = /^[a-z][a-z0-9.-]{2,15}$/

function clean (value, max) {
  return String(value ?? '').slice(0, max).trim()
}

function newId (now = Date.now()) {
  return 'template-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function contentFromDraft (draft, now = Date.now()) {
  const source = normalizeDraft(draft, now)
  return {
    title: source.title,
    body: source.body,
    community: source.community,
    tags: source.tags,
    description: source.description,
    coverImage: source.coverImage,
    beneficiaries: source.beneficiaries,
    rewards: source.rewards,
    aiTools: source.aiTools,
    countdown: source.countdown,
    portfolio: source.portfolio,
    collection: source.collection,
    authorDisplay: source.authorDisplay
  }
}

export function normalizeTemplate (raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = Number(source.createdAt)
  const updatedAt = Number(source.updatedAt)
  const content = contentFromDraft(source.draft || source, now)
  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim().slice(0, 80) : newId(now),
    owner: typeof source.owner === 'string' && ACCOUNT_RE.test(source.owner) ? source.owner : null,
    name: clean(source.name, MAX_TEMPLATE_NAME),
    summary: clean(source.summary, MAX_TEMPLATE_SUMMARY),
    draft: content,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now
  }
}

export function templateHasContent (template) {
  return Boolean(template && template.name && (template.draft?.title || template.draft?.body))
}

export function templateFromDraft (draft, { name, summary = '', owner = null } = {}, now = Date.now()) {
  return normalizeTemplate({
    owner: owner || draft?.owner || null,
    name,
    summary,
    draft,
    createdAt: now,
    updatedAt: now
  }, now)
}

/** Merge a template into a draft while keeping its id, owner and edit identity. */
export function applyTemplateToDraft (template, draft, now = Date.now()) {
  const base = normalizeDraft(draft, now)
  const content = contentFromDraft(template?.draft || {}, now)
  return normalizeDraft({
    ...base,
    ...content,
    id: base.id,
    owner: base.owner,
    editing: base.editing,
    crossPost: null,
    createdAt: base.createdAt,
    updatedAt: now
  }, now)
}

export function sortTemplates (templates) {
  return [...(Array.isArray(templates) ? templates : [])]
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
}

export function upsertTemplate (templates, template, now = Date.now()) {
  const normalized = normalizeTemplate({ ...template, updatedAt: now }, now)
  const list = Array.isArray(templates) ? templates : []
  const index = list.findIndex(item => item.id === normalized.id)
  const next = index === -1
    ? [normalized, ...list]
    : list.map(item => item.id === normalized.id ? normalized : item)
  return sortTemplates(next).slice(0, MAX_TEMPLATES)
}

export function removeTemplateById (templates, id) {
  return (Array.isArray(templates) ? templates : []).filter(item => item.id !== id)
}

function storageKey (owner) {
  const account = String(owner || '').trim().toLowerCase()
  return TEMPLATE_STORAGE_PREFIX + (ACCOUNT_RE.test(account) ? account : 'guest')
}

function storageGet (storage, key) {
  if (!storage) return null
  if (typeof storage.getItem === 'function') return storage.getItem(key)
  if (typeof storage.get === 'function') return storage.get(key)
  return null
}

function storageSet (storage, key, value) {
  if (!storage) return false
  try {
    if (typeof storage.set === 'function') {
      storage.set(key, value)
      return true
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, JSON.stringify(value))
      return true
    }
  } catch {
    return false
  }
  return false
}

function storageRemove (storage, key) {
  if (!storage) return
  try {
    if (typeof storage.remove === 'function') storage.remove(key)
    else if (typeof storage.removeItem === 'function') storage.removeItem(key)
  } catch {
    // Templates are a convenience; storage failure should not block editing.
  }
}

function parse (raw, now) {
  if (!raw) return []
  let list = []
  if (typeof raw === 'object') {
    list = Array.isArray(raw.items) ? raw.items : []
  } else {
    try {
      const parsed = JSON.parse(String(raw).replace(/^__q_objt\|/, ''))
      list = Array.isArray(parsed?.items) ? parsed.items : []
    } catch {
      // Keep the empty default.
    }
  }
  return list.map(item => normalizeTemplate(item, now)).filter(templateHasContent)
}

export function readTemplates (storage, owner = null, now = Date.now()) {
  return sortTemplates(parse(storageGet(storage, storageKey(owner)), now)).slice(0, MAX_TEMPLATES)
}

export function writeTemplates (storage, owner, templates, now = Date.now()) {
  const list = sortTemplates(
    (Array.isArray(templates) ? templates : [])
      .map(item => normalizeTemplate(item, now))
      .filter(templateHasContent)
  ).slice(0, MAX_TEMPLATES)
  if (!list.length) {
    storageRemove(storage, storageKey(owner))
    return true
  }
  return storageSet(storage, storageKey(owner), { version: TEMPLATE_VERSION, items: list })
}

export function serializeTemplateExport (templates, { now = Date.now() } = {}) {
  return JSON.stringify({
    app: 'hive.ausbit.dev',
    type: 'hive-templates',
    version: TEMPLATE_VERSION,
    exportedAt: new Date(now).toISOString(),
    templates: (Array.isArray(templates) ? templates : []).map(item => normalizeTemplate(item, now))
  }, null, 2)
}

export function parseTemplateExport (text, { now = Date.now(), owner = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { templates: [], error: 'The file is empty.' }
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { templates: [], error: 'This file is not valid JSON.' }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed && parsed.templates)
      ? parsed.templates
      : []
  const templates = list
    .map(item => normalizeTemplate({ ...item, owner: item.owner || owner || null }, now))
    .filter(templateHasContent)
  if (!templates.length) return { templates: [], error: 'No templates with a name and content were found.' }
  return { templates, error: '' }
}

/** Merge imported templates without overwriting newer local copies. */
export function mergeTemplates (existing, imported, { owner = null, now = Date.now() } = {}) {
  let templates = Array.isArray(existing) ? [...existing] : []
  let added = 0
  let updated = 0
  let skipped = 0
  for (const raw of Array.isArray(imported) ? imported : []) {
    const template = normalizeTemplate({ ...raw, owner: raw.owner || owner || null }, now)
    if (!templateHasContent(template)) {
      skipped += 1
      continue
    }
    const index = templates.findIndex(item => item.id === template.id)
    if (index === -1) {
      templates.push(template)
      added += 1
    } else if (template.updatedAt >= Number(templates[index].updatedAt)) {
      templates[index] = template
      updated += 1
    } else {
      skipped += 1
    }
  }
  templates = sortTemplates(templates).slice(0, MAX_TEMPLATES)
  return { templates, added, updated, skipped }
}

/** Starter templates always available, before the account's own templates. */
export const STARTER_TEMPLATES = [
  {
    id: 'starter-dev-update',
    name: 'Development update',
    summary: 'What changed, why it matters, and what comes next.',
    draft: {
      title: 'Building …',
      body: [
        'A short opening that names the user-visible change.',
        '',
        '## What changed',
        '',
        '- One clear change.',
        '- Another clear change.',
        '',
        '## Why it matters',
        '',
        'Explain the user impact without jargon.',
        '',
        '## Under the hood',
        '',
        'The technical detail for readers who want it.',
        '',
        '## What comes next',
        '',
        '- Next step.',
        '',
        'Thanks to everyone who tested, reported or reviewed this work.'
      ].join('\n'),
      tags: ['dev', 'hive'],
      community: 'hive-139531',
      description: '',
      portfolio: false,
      collection: false
    }
  },
  {
    id: 'starter-photo-post',
    name: 'Photo story',
    summary: 'Lead with an image, then tell the story behind it.',
    draft: {
      title: 'A photo story',
      body: [
        '![Describe the image](https://)',
        '',
        'Where was this taken, and what caught your eye?',
        '',
        '## The story',
        '',
        'A few short paragraphs about the place, the people or the process.',
        '',
        '## Gear and settings',
        '',
        'Camera, lens, settings or editing notes if they help.',
        '',
        'Thanks for looking.'
      ].join('\n'),
      tags: ['photography', 'hive'],
      community: '',
      description: '',
      portfolio: true,
      collection: false
    }
  },
  {
    id: 'starter-tutorial',
    name: 'Tutorial',
    summary: 'A goal, prerequisites, numbered steps and a result.',
    draft: {
      title: 'How to …',
      body: [
        'What the reader will be able to do at the end.',
        '',
        '## What you need',
        '',
        '- Prerequisite one.',
        '- Prerequisite two.',
        '',
        '## Step 1',
        '',
        'Explain the first step.',
        '',
        '## Step 2',
        '',
        'Explain the second step.',
        '',
        '## Result',
        '',
        'Show or describe the finished result.',
        '',
        'If something did not work, say what you tried and what helped.'
      ].join('\n'),
      tags: ['tutorial', 'hive'],
      community: '',
      description: '',
      portfolio: false,
      collection: false
    }
  },
  {
    id: 'starter-weekly-roundup',
    name: 'Weekly roundup',
    summary: 'A dated list of updates, links and things worth sharing.',
    draft: {
      title: 'Weekly roundup: …',
      body: [
        'A short introduction to the week.',
        '',
        '## What I worked on',
        '',
        '- Item one.',
        '- Item two.',
        '',
        '## Worth reading',
        '',
        '- [Post title](https://) — why it is worth reading.',
        '',
        '## Next week',
        '',
        '- What is next.',
        '',
        'See you next week.'
      ].join('\n'),
      tags: ['hive', 'blog'],
      community: '',
      description: '',
      portfolio: false,
      collection: false
    }
  },
  {
    id: 'starter-project-update',
    name: 'Project update',
    summary: 'Shipped work, open issues and how people can help.',
    draft: {
      title: 'Project update: …',
      body: [
        'A one-paragraph summary of where the project stands.',
        '',
        '## Shipped',
        '',
        '- What is now live.',
        '',
        '## In progress',
        '',
        '- What is being worked on.',
        '',
        '## How to help',
        '',
        '- Try it and report issues.',
        '- Share it with someone who would find it useful.',
        '',
        'Links and credits.'
      ].join('\n'),
      tags: ['hive', 'dev'],
      community: '',
      description: '',
      portfolio: false,
      collection: false
    }
  }
]
