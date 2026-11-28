// Client-side 1200×630 social card generator for an account blog.
//
// The card is rendered in the browser and uploaded through the existing
// images.hive.blog flow, so the Worker never needs a font or image renderer and
// the generated URL is stored in the on-chain blog settings.

import { isHexColor } from '../themes/color'
import { getBlogTheme } from '../themes/blogThemes'

export const SOCIAL_CARD_WIDTH = 1200
export const SOCIAL_CARD_HEIGHT = 630

const FONTS = {
  paper: {
    label: '700 24px "Helvetica Neue", Arial, sans-serif',
    title: '700 88px Georgia, "Times New Roman", serif',
    body: '30px Georgia, "Times New Roman", serif',
    footer: '24px ui-monospace, SFMono-Regular, Menlo, monospace'
  },
  studio: {
    label: '700 24px Roboto, "Helvetica Neue", Arial, sans-serif',
    title: '700 88px Roboto, "Helvetica Neue", Arial, sans-serif',
    body: '30px Roboto, "Helvetica Neue", Arial, sans-serif',
    footer: '24px ui-monospace, SFMono-Regular, Menlo, monospace'
  },
  terminal: {
    label: '700 22px ui-monospace, SFMono-Regular, Menlo, monospace',
    title: '700 66px ui-monospace, SFMono-Regular, Menlo, monospace',
    body: '28px ui-monospace, SFMono-Regular, Menlo, monospace',
    footer: '24px ui-monospace, SFMono-Regular, Menlo, monospace'
  },
  journal: {
    label: '700 24px "Helvetica Neue", Arial, sans-serif',
    title: '700 88px Georgia, "Times New Roman", serif',
    body: '30px Georgia, "Times New Roman", serif',
    footer: '24px ui-monospace, SFMono-Regular, Menlo, monospace'
  },
  gallery: {
    label: '700 24px Roboto, "Helvetica Neue", Arial, sans-serif',
    title: '700 88px Roboto, "Helvetica Neue", Arial, sans-serif',
    body: '30px Roboto, "Helvetica Neue", Arial, sans-serif',
    footer: '24px ui-monospace, SFMono-Regular, Menlo, monospace'
  }
}

const TITLE_Y = 250
const FOOTER_Y = 560

export function buildBlogSocialCardModel ({
  title = '',
  account = '',
  description = '',
  theme = 'auto',
  accent = ''
} = {}) {
  const themeId = getBlogTheme(theme) ? theme : 'paper'
  const base = getBlogTheme(themeId)
  const name = String(account || '').trim().toLowerCase()
  const tokens = {
    ...base.tokens,
    ...(isHexColor(accent) ? { primary: String(accent).toLowerCase() } : {})
  }
  return {
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    themeId,
    background: tokens.bg,
    text: tokens.text,
    muted: tokens.muted,
    accent: tokens.primary,
    border: tokens.border,
    label: 'BANKSIA BLOG',
    title: String(title || '').trim() || (name ? '@' + name : 'A Hive blog'),
    account: name,
    description: String(description || '').trim(),
    footer: name ? name + '.banksia.io' : 'banksia.io',
    fonts: FONTS[themeId],
    titleSize: themeId === 'terminal' ? 66 : 88,
    titleLineHeight: themeId === 'terminal' ? 76 : 100
  }
}

/**
 * Wrap text into at most `maxLines` lines for a measured canvas context.
 * Returns an array of lines; the last line gets an ellipsis when text remains.
 */
export function wrapTextLines (text, maxWidth, maxLines, measure) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  if (!words.length || maxLines <= 0) return lines

  let index = 0
  while (index < words.length && lines.length < maxLines) {
    let line = ''
    while (index < words.length) {
      const word = words[index]
      const candidate = line ? line + ' ' + word : word
      if (line && measure(candidate) > maxWidth) break
      line = candidate
      index += 1
    }
    lines.push(line)
  }

  if (index < words.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && measure(last + '…') > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last.trimEnd() + '…'
  }
  return lines
}

/** Draw the card onto a 2D canvas context. Exported for previews and tests. */
export function drawBlogSocialCard (ctx, model) {
  const { width, height } = model

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = model.background
  ctx.fillRect(0, 0, width, height)

  // Soft accent disc, matching the static OG cards.
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = model.accent
  ctx.beginPath()
  ctx.arc(1050, 120, 140, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.textBaseline = 'alphabetic'

  // Label.
  ctx.font = model.fonts.label
  ctx.fillStyle = model.accent
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px'
  ctx.fillText(model.label, 90, 92)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  // Accent rule.
  ctx.fillStyle = model.accent
  ctx.fillRect(90, 205, 64, 6)

  // Title.
  ctx.font = model.fonts.title
  const titleLines = wrapTextLines(
    model.title,
    980,
    3,
    value => ctx.measureText(value).width
  )
  ctx.fillStyle = model.text
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 90, TITLE_Y + index * model.titleLineHeight)
  })

  // Description, with less room when the title uses three lines.
  const titleBottom = TITLE_Y + Math.max(0, titleLines.length - 1) * model.titleLineHeight
  ctx.font = model.fonts.body
  const descriptionLines = wrapTextLines(
    model.description,
    940,
    titleLines.length >= 3 ? 1 : 2,
    value => ctx.measureText(value).width
  )
  if (descriptionLines.length) {
    ctx.fillStyle = model.muted
    const descriptionY = Math.min(titleBottom + 58, FOOTER_Y - 110)
    descriptionLines.forEach((line, index) => {
      ctx.fillText(line, 90, descriptionY + index * 40)
    })
  }

  // Footer rule and address.
  ctx.fillStyle = model.border
  ctx.fillRect(90, FOOTER_Y - 42, 1020, 1)
  ctx.font = model.fonts.footer
  ctx.fillStyle = model.accent
  ctx.fillText(model.footer, 90, FOOTER_Y)
}

/** Render a PNG File ready for the existing images.hive.blog uploader. */
export function createBlogSocialCardFile (input) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('The social card can only be generated in a browser.'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = SOCIAL_CARD_WIDTH
    canvas.height = SOCIAL_CARD_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('This browser cannot render the social card.'))
      return
    }
    const model = buildBlogSocialCardModel(input)
    drawBlogSocialCard(ctx, model)
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Could not encode the social card.'))
        return
      }
      resolve(new File([blob], 'banksia-blog-social-card.png', { type: 'image/png' }))
    }, 'image/png')
  })
}
