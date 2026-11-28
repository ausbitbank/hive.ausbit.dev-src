import { describe, expect, it } from 'vitest'
import { parseSearchRoute } from '../../src/services/search'

describe('search route parser', () => {
  it('parses blocks, transactions, accounts, tags and proposals', () => {
    expect(parseSearchRoute('12345678')).toMatchObject({ path: '/b/12345678', kind: 'block' })
    expect(parseSearchRoute('block 12345678')).toMatchObject({ path: '/b/12345678' })
    expect(parseSearchRoute('block #12345678')).toMatchObject({ path: '/b/12345678' })

    const id = '7ad5edd0997430be8eaa48ead159b2cfb8f5b606'
    expect(parseSearchRoute(id)).toMatchObject({ path: '/tx/' + id, kind: 'tx' })
    expect(parseSearchRoute('tx ' + id)).toMatchObject({ path: '/tx/' + id })

    expect(parseSearchRoute('@ausbitbank')).toMatchObject({ path: '/@ausbitbank', kind: 'account' })
    expect(parseSearchRoute('ausbitbank')).toMatchObject({ path: '/@ausbitbank', kind: 'account' })
    expect(parseSearchRoute('@ausbitbank/posts')).toMatchObject({ path: '/@ausbitbank/posts', kind: 'account' })
    expect(parseSearchRoute('@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer')).toMatchObject({
      path: '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer',
      kind: 'post'
    })
    expect(parseSearchRoute('https://peakd.com/@ausbitbank/wallet')).toMatchObject({
      path: '/@ausbitbank/wallet',
      kind: 'wallet'
    })

    expect(parseSearchRoute('#photography')).toMatchObject({ path: '/trending/photography', kind: 'tag' })
    expect(parseSearchRoute('hive-153850')).toMatchObject({ path: '/trending/hive-153850' })
    expect(parseSearchRoute('proposal 373')).toMatchObject({ path: '/proposals/373', kind: 'proposal' })
  })

  it('parses supported front-end URLs', () => {
    expect(parseSearchRoute('https://hive.ausbit.dev/b/12345678')).toMatchObject({ path: '/b/12345678' })
    expect(parseSearchRoute('https://hive.blog/@ausbitbank/post-name')).toMatchObject({ path: '/@ausbitbank/post-name' })
    expect(parseSearchRoute('https://ecency.com/trending/photography')).toMatchObject({ path: '/trending/photography' })
  })

  it('parses Lightning invoices and addresses into a payment link', () => {
    const invoice = 'lnbc1000u1p' + 'a'.repeat(40)
    expect(parseSearchRoute(invoice)).toMatchObject({
      kind: 'lightning',
      lightning: 'invoice',
      path: '/lightning?pay=' + encodeURIComponent(invoice)
    })
    expect(parseSearchRoute('lightning:' + invoice)).toMatchObject({
      kind: 'lightning',
      lightning: 'invoice'
    })
    expect(parseSearchRoute('alice@getalby.com')).toMatchObject({
      kind: 'lightning',
      lightning: 'address',
      path: '/lightning?pay=alice%40getalby.com'
    })
    expect(parseSearchRoute('@ausbitbank/pos')).toMatchObject({
      path: '/@ausbitbank/pos',
      kind: 'account'
    })
  })

  it('rejects empty and unsupported input', () => {
    expect(parseSearchRoute('')).toBe(null)
    expect(parseSearchRoute('https://example.com/thing')).toBe(null)
    expect(parseSearchRoute('https://hive.ausbit.dev/promoted/photography')).toBe(null)
    expect(parseSearchRoute('//example.com')).toBe(null)
    expect(parseSearchRoute('not a real search query!!')).toBe(null)
  })
})
