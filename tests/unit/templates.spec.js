import { describe, expect, it } from 'vitest'
import {
  applyTemplateToDraft,
  MAX_TEMPLATES,
  readTemplates,
  removeTemplateById,
  STARTER_TEMPLATES,
  templateFromDraft,
  templateHasContent,
  upsertTemplate,
  writeTemplates
} from '../../src/services/templates'
import { createDraft } from '../../src/services/drafts'

function memoryStorage () {
  const map = new Map()
  return {
    map,
    get (key) { return map.get(key) ?? null },
    set (key, value) { map.set(key, value) },
    remove (key) { map.delete(key) }
  }
}

describe('template model', () => {
  it('ships starter templates with usable bodies', () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(4)
    for (const template of STARTER_TEMPLATES) {
      expect(template.name).toBeTruthy()
      expect(template.draft.body).toBeTruthy()
      expect(template.summary).toBeTruthy()
    }
  })

  it('captures reusable draft fields without edit identity or cross-posts', () => {
    const draft = createDraft({
      id: 'draft-1',
      owner: 'alice',
      title: 'A post',
      body: 'Body',
      community: 'hive-174578',
      tags: ['hive'],
      description: 'Summary',
      aiTools: { research: true },
      countdown: '2030-01-01T00:00:00.000Z',
      portfolio: true,
      collection: true,
      authorDisplay: 'Jane',
      crossPost: { author: 'bob', permlink: 'original' },
      editing: { author: 'alice', permlink: 'existing' }
    }, 1000)

    const template = templateFromDraft(draft, { name: 'Dev update', owner: 'alice' }, 2000)
    expect(template.name).toBe('Dev update')
    expect(template.draft.title).toBe('A post')
    expect(template.draft.community).toBe('hive-174578')
    expect(template.draft.aiTools.research).toBe(true)
    expect(template.draft.portfolio).toBe(true)
    expect(template.draft.collection).toBe(true)
    expect(template.draft.authorDisplay).toBe('Jane')
    expect(template.draft.editing).toBeUndefined()
    expect(template.draft.crossPost).toBeUndefined()
  })

  it('applies a template while keeping the draft identity and edit target', () => {
    const draft = createDraft({
      id: 'draft-1',
      owner: 'alice',
      title: 'Old',
      body: 'Old body',
      editing: { author: 'alice', permlink: 'existing-permlink', parentPermlink: 'hive-1' }
    }, 1000)
    const template = {
      name: 'New',
      draft: {
        title: 'New title',
        body: 'New body',
        tags: ['dev'],
        community: 'hive-139531'
      }
    }
    const next = applyTemplateToDraft(template, draft, 2000)
    expect(next.id).toBe('draft-1')
    expect(next.owner).toBe('alice')
    expect(next.editing.permlink).toBe('existing-permlink')
    expect(next.title).toBe('New title')
    expect(next.body).toBe('New body')
    expect(next.community).toBe('hive-139531')
    expect(next.tags).toEqual(['dev'])
  })
})

describe('template storage', () => {
  it('stores templates per account and removes them', () => {
    const storage = memoryStorage()
    const template = templateFromDraft(createDraft({ title: 'T', body: 'B' }, 1000), { name: 'Saved' }, 1000)
    writeTemplates(storage, 'alice', [template], 1000)
    expect(readTemplates(storage, 'alice')).toHaveLength(1)
    expect(readTemplates(storage, 'bob')).toEqual([])
    expect(removeTemplateById([template], template.id)).toEqual([])
  })

  it('caps the stored list and rejects empty templates', () => {
    const storage = memoryStorage()
    const list = Array.from({ length: MAX_TEMPLATES + 3 }, (_, index) => ({
      id: 't' + index,
      name: 'Template ' + index,
      draft: { title: 'T', body: 'B' },
      updatedAt: index
    }))
    writeTemplates(storage, 'alice', list, 1000)
    expect(readTemplates(storage, 'alice')).toHaveLength(MAX_TEMPLATES)
    expect(templateHasContent({ name: 'Empty', draft: {} })).toBe(false)
  })

  it('upserts an existing template instead of duplicating it', () => {
    const initial = templateFromDraft(createDraft({ title: 'T', body: 'B' }, 1000), { name: 'First' }, 1000)
    const list = upsertTemplate([initial], { ...initial, name: 'Second' }, 2000)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Second')
  })
})
