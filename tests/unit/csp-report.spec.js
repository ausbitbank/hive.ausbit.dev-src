import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCspReport } from '../../deploy/cloudflare/metadata-worker.mjs'

function post (body, type = 'application/csp-report') {
  return new Request('https://hive.ausbit.dev/csp-report', {
    method: 'POST',
    headers: { 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('CSP report endpoint', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts a legacy csp-report and logs a compact line', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await handleCspReport(post({
      'csp-report': {
        'document-uri': 'https://hive.ausbit.dev/@a/b',
        'violated-directive': 'script-src-attr',
        'blocked-uri': 'inline',
        'script-sample': 'alert(1)\nsecond line'
      }
    }))

    expect(response.status).toBe(204)
    expect(log).toHaveBeenCalledTimes(1)
    const line = JSON.parse(log.mock.calls[0][0])
    expect(line).toMatchObject({
      type: 'csp-report',
      directive: 'script-src-attr',
      blocked: 'inline',
      document: 'https://hive.ausbit.dev/@a/b',
      sample: 'alert(1) second line'
    })
  })

  it('accepts reports+json arrays', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await handleCspReport(post([
      { body: { documentURL: 'https://x/', effectiveDirective: 'img-src', blockedURL: 'https://e/' } }
    ], 'application/reports+json'))

    expect(response.status).toBe(204)
    expect(JSON.parse(log.mock.calls[0][0]).directive).toBe('img-src')
  })

  it('rejects the wrong method, content type, size and JSON', async () => {
    expect((await handleCspReport(new Request('https://x/csp-report'))).status).toBe(405)
    expect((await handleCspReport(new Request('https://x/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}'
    }))).status).toBe(415)
    expect((await handleCspReport(post('x'.repeat(9000)))).status).toBe(413)
    expect((await handleCspReport(post('{'))).status).toBe(400)
  })
})
