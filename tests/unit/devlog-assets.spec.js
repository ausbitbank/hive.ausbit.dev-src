import { describe, expect, it } from 'vitest'
import { imageUrl, localImagePath } from '../../scripts/lib/devlog/assets.mjs'

const FILE = 'docs/screenshots/devlog/2026-11-27-devlog/02-about.png'
const HOSTED = `https://files.banksia.io/${FILE}`

describe('devlog image URLs', () => {
  it('serves images from the asset host at their repository path', () => {
    expect(imageUrl(FILE)).toBe(HOSTED)
    expect(imageUrl(`/${FILE}`)).toBe(HOSTED)
    expect(localImagePath(HOSTED)).toBe(FILE)
  })

  it('maps drafts written against GitHub raw URLs, including the pre-rename repo', () => {
    expect(localImagePath(`https://raw.githubusercontent.com/ausbitbank/banksia.io/master/${FILE}`)).toBe(FILE)
    expect(localImagePath(`https://raw.githubusercontent.com/ausbitbank/hive.ausbit.dev-src/master/${FILE}`)).toBe(FILE)
    expect(localImagePath(`https://github.com/ausbitbank/banksia.io/raw/master/${FILE}`)).toBe(FILE)
  })

  it('ignores query strings and images the devlog does not own', () => {
    expect(localImagePath(`${HOSTED}?v=2`)).toBe(FILE)
    expect(localImagePath('https://images.hive.blog/DQmabc/photo.png')).toBe('')
    expect(localImagePath('/statics/og-banksia.png')).toBe('')
  })
})
