// Pure helpers for the native markdown composer.
//
// Every function takes the current text plus the textarea selection and returns
// the next text and selection. Keeping this logic out of components makes the
// toolbar, keyboard shortcuts and tests share one implementation.

function clamp (value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

function selection (text, start, end) {
  const source = String(text ?? '')
  const from = clamp(start, 0, source.length)
  const to = clamp(end, from, source.length)
  return { source, from, to }
}

function result (text, start, end) {
  return { text, start, end }
}

/**
 * Wrap the selection (or an inserted placeholder) with a prefix and suffix.
 * The placeholder is selected afterwards so the author can type over it.
 */
export function wrapSelection (text, start, end, before, after, placeholder = '') {
  const { source, from, to } = selection(text, start, end)
  const selected = source.slice(from, to) || placeholder
  const next = source.slice(0, from) + before + selected + after + source.slice(to)
  return result(next, from + before.length, from + before.length + selected.length)
}

/** Prefix every selected line (or the current line) with a markdown marker. */
export function prefixLines (text, start, end, prefix) {
  const { source, from, to } = selection(text, start, end)
  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  let blockEnd = to > from ? to : source.indexOf('\n', from)
  if (blockEnd === -1) blockEnd = source.length
  const segment = source.slice(lineStart, blockEnd)
  const replacement = segment
    .split('\n')
    .map(line => prefix + line)
    .join('\n')
  const next = source.slice(0, lineStart) + replacement + source.slice(blockEnd)
  return result(next, lineStart, lineStart + replacement.length)
}

/** Indent or outdent the selected lines with two spaces per level. */
export function indentSelection (text, start, end, { outdent = false } = {}) {
  const { source, from, to } = selection(text, start, end)
  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  let blockEnd = to > from ? to : source.indexOf('\n', from)
  if (blockEnd === -1) blockEnd = source.length
  const segment = source.slice(lineStart, blockEnd)
  const replacement = segment
    .split('\n')
    .map(line => outdent ? line.replace(/^ {1,2}/, '') : '  ' + line)
    .join('\n')
  const next = source.slice(0, lineStart) + replacement + source.slice(blockEnd)
  return result(next, lineStart, lineStart + replacement.length)
}

/**
 * Continue a list when Enter is pressed. Returns null when the caret is not on
 * a list item, so the textarea keeps its normal newline behaviour.
 */
export function continueMarkdownList (text, start, end) {
  const { source, from, to } = selection(text, start, end)
  if (from !== to) return null
  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const lineEnd = source.indexOf('\n', from)
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/)
  if (!match) return null

  const indent = match[1]
  const baseMarker = match[3] ? '- [ ] ' : match[2]
  const content = line.slice(match[0].length)
  if (!content.trim()) {
    // An empty list item ends the list instead of creating another one.
    const next = source.slice(0, lineStart) + indent + source.slice(lineEnd === -1 ? source.length : lineEnd)
    return result(next, lineStart + indent.length, lineStart + indent.length)
  }

  const nextMarker = /^\d+\.$/.test(baseMarker)
    ? (Number(baseMarker.slice(0, -1)) + 1) + '. '
    : baseMarker.endsWith(' ') ? baseMarker : baseMarker + ' '
  const insertion = '\n' + indent + nextMarker
  const position = from
  const next = source.slice(0, position) + insertion + source.slice(position)
  return result(next, position + insertion.length, position + insertion.length)
}

/** Insert a block at the selection, padding it with blank lines when needed. */
export function insertBlock (text, start, end, block) {
  const { source, from, to } = selection(text, start, end)
  const before = source.slice(0, from)
  const after = source.slice(to)
  const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const trail = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  const inserted = lead + block + trail
  const next = before + inserted + after
  return result(next, from + lead.length, from + lead.length + block.length)
}

/** Insert `[text](url)` and select the text so it can be replaced immediately. */
export function insertLink (text, start, end, { label = 'link text', url = 'https://' } = {}) {
  const value = String(label || '').trim() || 'link text'
  const href = String(url || '').trim() || 'https://'
  return wrapSelection(text, start, end, '[', '](' + href + ')', value)
}

/** Insert `![alt](url)` and select the alt text. */
export function insertImage (text, start, end, { alt = 'image description', url = 'https://' } = {}) {
  const description = String(alt || '').trim()
  const href = String(url || '').trim() || 'https://'
  const prefix = '!['
  const suffix = '](' + href + ')'
  const { source, from, to } = selection(text, start, end)
  const inserted = prefix + description + suffix
  const next = source.slice(0, from) + inserted + source.slice(to)
  const selectFrom = from + prefix.length
  return result(next, selectFrom, selectFrom + description.length)
}

/** Build a markdown table template with the requested size. */
export function tableTemplate ({ rows = 3, columns = 3 } = {}) {
  const cols = clamp(columns, 1, 8)
  const bodyRows = Math.max(1, clamp(rows, 2, 20) - 1)
  const header = '| ' + Array.from({ length: cols }, (_, index) => 'Column ' + (index + 1)).join(' | ') + ' |'
  const divider = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |'
  const body = Array.from({ length: bodyRows }, (_, row) =>
    '| ' + Array.from({ length: cols }, (_, col) => 'Cell ' + (row + 1) + '-' + (col + 1)).join(' | ') + ' |'
  )
  return [header, divider, ...body].join('\n')
}

export function insertTable (text, start, end, options = {}) {
  return insertBlock(text, start, end, tableTemplate(options))
}

/** Count words without treating markdown punctuation as words. */
export function wordCount (text) {
  const cleaned = String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ')
    .trim()
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0
}

/** Approximate reading time at 220 words per minute. */
export function readingMinutes (text) {
  const words = wordCount(text)
  return words ? Math.max(1, Math.ceil(words / 220)) : 0
}

/** UTF-8 byte length, used for the Hive 65,535-byte body limit. */
export function byteLength (text) {
  const value = String(text ?? '')
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length
  return encodeURIComponent(value).replace(/%[A-F\d]{2}/g, 'x').length
}

/**
 * Headings in a Markdown document, for the composer outline.
 *
 * ATX headings up to six levels are recognised with up to three leading
 * spaces. Fenced code blocks (``` or ~~~) are skipped so pasted code cannot
 * pollute the outline. Each entry carries the source offset and line so the
 * editor can jump straight to it.
 */
export function markdownHeadings (text) {
  const source = String(text ?? '')
  const lines = source.split('\n')
  const headings = []
  let offset = 0
  let fence = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    const fenceMatch = /^(```|~~~)/.exec(trimmed)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
      offset += line.length + 1
      continue
    }
    if (!fence) {
      const match = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
      if (match) {
        const label = match[2].trim()
        if (label) {
          headings.push({
            level: match[1].length,
            text: label,
            line: index,
            index: offset + line.indexOf('#')
          })
        }
      }
    }
    offset += line.length + 1
  }

  return headings
}

/**
 * Apply a toolbar/shortcut action to the current text and selection.
 * Unknown actions return the input unchanged.
 */
export function applyMarkdownAction (text, start, end, action = {}) {
  const type = action.type
  switch (type) {
    case 'bold':
      return wrapSelection(text, start, end, '**', '**', 'bold text')
    case 'italic':
      return wrapSelection(text, start, end, '*', '*', 'italic text')
    case 'underline':
      return wrapSelection(text, start, end, '<u>', '</u>', 'underlined text')
    case 'strikethrough':
      return wrapSelection(text, start, end, '~~', '~~', 'struck text')
    case 'heading':
      return prefixLines(text, start, end, '## ')
    case 'heading1':
      return prefixLines(text, start, end, '# ')
    case 'heading2':
      return prefixLines(text, start, end, '## ')
    case 'heading3':
      return prefixLines(text, start, end, '### ')
    case 'quote':
      return prefixLines(text, start, end, '> ')
    case 'bulletList':
      return prefixLines(text, start, end, '- ')
    case 'numberList':
      return prefixLines(text, start, end, '1. ')
    case 'taskList':
      return prefixLines(text, start, end, '- [ ] ')
    case 'inlineCode':
      return wrapSelection(text, start, end, '`', '`', 'code')
    case 'codeBlock':
      return insertBlock(text, start, end, '```\ncode\n```')
    case 'link':
      return insertLink(text, start, end, action)
    case 'image':
      return insertImage(text, start, end, action)
    case 'center':
      return wrapSelection(text, start, end, '<center>', '</center>', action.placeholder || '![image description](https://)')
    case 'embed':
    case 'raw':
      return insertBlock(text, start, end, String(action.markdown || action.text || ''))
    case 'indent':
      return indentSelection(text, start, end, { outdent: false })
    case 'outdent':
      return indentSelection(text, start, end, { outdent: true })
    case 'table':
      return insertTable(text, start, end, action)
    case 'divider':
      return insertBlock(text, start, end, '---')
    default:
      return result(String(text ?? ''), clamp(start, 0, String(text ?? '').length), clamp(end, 0, String(text ?? '').length))
  }
}

/** Keyboard shortcuts that map directly to a markdown action. */
export function shortcutMarkdownAction (event) {
  if (!event || !(event.metaKey || event.ctrlKey)) return null
  const key = String(event.key || '').toLowerCase()
  if (event.altKey) {
    switch (key) {
      case '1': return { type: 'heading1' }
      case '2': return { type: 'heading2' }
      case '3': return { type: 'heading3' }
      default: return null
    }
  }
  if (event.shiftKey && key === 'x') return { type: 'strikethrough' }
  switch (key) {
    case 'b':
      return { type: 'bold' }
    case 'i':
      return { type: 'italic' }
    case 'u':
      return { type: 'underline' }
    case 'k':
      return { type: 'link' }
    default:
      return null
  }
}
