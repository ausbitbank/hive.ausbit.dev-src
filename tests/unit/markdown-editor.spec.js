import { describe, expect, it } from 'vitest'
import {
  applyMarkdownAction,
  byteLength,
  insertImage,
  insertLink,
  insertTable,
  prefixLines,
  readingMinutes,
  shortcutMarkdownAction,
  tableTemplate,
  wordCount,
  wrapSelection
} from '../../src/utils/markdownEditor'

describe('markdown editing helpers', () => {
  it('wraps selections and selects inserted placeholders', () => {
    expect(wrapSelection('hello', 0, 5, '**', '**')).toEqual({ text: '**hello**', start: 2, end: 7 })
    expect(wrapSelection('', 0, 0, '`', '`', 'code')).toEqual({ text: '`code`', start: 1, end: 5 })
  })

  it('prefixes every selected line once', () => {
    const text = 'one\ntwo\nthree'
    const result = prefixLines(text, 4, 7, '- ')
    expect(result.text).toBe('one\n- two\nthree')
    expect(prefixLines(text, 4, 8, '- ').text).toBe('one\n- two\n- three')
    expect(prefixLines('single', 0, 0, '> ').text).toBe('> single')
  })

  it('inserts links and images with useful selection ranges', () => {
    const link = insertLink('', 0, 0, { label: 'Hive', url: 'https://hive.io' })
    expect(link.text).toBe('[Hive](https://hive.io)')
    expect(link.text.slice(link.start, link.end)).toBe('Hive')

    const image = insertImage('body', 4, 4, { alt: 'A diagram', url: 'https://example.com/a.png' })
    expect(image.text).toBe('body![A diagram](https://example.com/a.png)')
    expect(image.text.slice(image.start, image.end)).toBe('A diagram')
  })

  it('builds and inserts markdown tables', () => {
    const table = tableTemplate({ rows: 3, columns: 2 })
    expect(table.split('\n')).toHaveLength(4)
    expect(table).toContain('| Column 1 | Column 2 |')
    expect(table).toContain('| --- | --- |')
    expect(table).toContain('| Cell 2-1 | Cell 2-2 |')
    expect(insertTable('', 0, 0).text).toContain('| Column 1 |')
  })

  it('dispatches toolbar actions', () => {
    expect(applyMarkdownAction('text', 0, 4, { type: 'bold' }).text).toBe('**text**')
    expect(applyMarkdownAction('text', 0, 4, { type: 'heading' }).text).toBe('## text')
    expect(applyMarkdownAction('', 0, 0, { type: 'table' }).text).toContain('Column 1')
    expect(applyMarkdownAction('a', 0, 1, { type: 'divider' }).text).toContain('---')
    expect(applyMarkdownAction('a', 0, 1, { type: 'unknown' }).text).toBe('a')
  })

  it('counts words, reading time and UTF-8 bytes', () => {
    expect(wordCount('Hello **Hive** and [friends](https://hive.io)')).toBe(4)
    expect(wordCount('```\ncode block\n```')).toBe(0)
    expect(readingMinutes(Array.from({ length: 221 }, () => 'word').join(' '))).toBe(2)
    expect(byteLength('é')).toBe(2)
    expect(byteLength('hive')).toBe(4)
  })

  it('maps composer keyboard shortcuts', () => {
    expect(shortcutMarkdownAction({ key: 'b', ctrlKey: true })).toEqual({ type: 'bold' })
    expect(shortcutMarkdownAction({ key: 'I', metaKey: true })).toEqual({ type: 'italic' })
    expect(shortcutMarkdownAction({ key: 'k', ctrlKey: true })).toEqual({ type: 'link' })
    expect(shortcutMarkdownAction({ key: 'b' })).toBeNull()
    expect(shortcutMarkdownAction({ key: 's', ctrlKey: true })).toBeNull()
  })
})
