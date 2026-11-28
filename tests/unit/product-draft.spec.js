import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ProductFields from '../../src/components/ProductFields.vue'
import { buildPostMetadata, buildPostOperation } from '../../src/services/publish'
import {
  buildProductMetadata,
  defaultProductFields,
  hasProductFields,
  normalizeProductFields,
  normalizeProductTags,
  productPreview,
  readProductFieldsFromMetadata,
  validateProductFields
} from '../../src/services/productDraft'

function fields (overrides = {}) {
  return {
    enabled: true,
    price: '25',
    currency: 'HIVE:HBD',
    subscription: false,
    recurrenceHours: 730,
    status: 1,
    tags: ['hosting', 'linux'],
    image: ['https://images.hive.blog/hosting.png'],
    ...overrides
  }
}

const context = {
  title: 'Managed Hive hosting',
  description: 'Monthly managed hosting for Hive accounts.'
}

function valid (overrides = {}) {
  return validateProductFields(fields(overrides), context)
}

describe('product draft fields', () => {
  it('emits normalized fields from the panel controls', async () => {
    const wrapper = shallowMount(ProductFields, {
      props: {
        modelValue: defaultProductFields(),
        title: 'Managed Hive hosting',
        description: 'Hosting.'
      },
      global: {
        stubs: {
          'q-toggle': true,
          'q-input': true,
          'q-select': true,
          'q-icon': true
        }
      }
    })
    const emitNext = async (method, value) => {
      wrapper.vm[method](value)
      const events = wrapper.emitted('update:modelValue')
      await wrapper.setProps({ modelValue: events[events.length - 1][0] })
    }
    await emitNext('setEnabled', true)
    await emitNext('setPrice', '0.001')
    await emitNext('setSubscription', true)
    await emitNext('setRecurrence', 12)
    const events = wrapper.emitted('update:modelValue')
    expect(events[events.length - 1][0]).toMatchObject({
      enabled: true,
      price: '0.001',
      subscription: true,
      recurrenceHours: 12
    })
    expect(wrapper.emitted('validation')).toBeTruthy()
  })

  it('starts disabled with safe defaults', () => {
    expect(defaultProductFields()).toEqual({
      enabled: false,
      price: '',
      currency: 'HIVE:HBD',
      subscription: false,
      recurrenceHours: 730,
      status: 1,
      tags: [],
      image: []
    })
  })

  it('normalises fields and ignores unknown keys', () => {
    const value = normalizeProductFields({
      enabled: true,
      price: ' 0.001 ',
      currency: 'hive:hive',
      subscription: 1,
      subscription_recurrence: 48,
      status: 3,
      tags: ['#Hosting', 'linux', 'hosting'],
      image: ['https://images.hive.blog/a.png', 'http://insecure.example/b.png'],
      bogus: 'ignored'
    })
    expect(value).toEqual({
      enabled: true,
      price: '0.001',
      currency: 'HIVE:HIVE',
      subscription: true,
      recurrenceHours: 48,
      status: 3,
      tags: ['hosting', 'linux'],
      image: ['https://images.hive.blog/a.png']
    })
    expect(value.bogus).toBeUndefined()
    expect(hasProductFields(value)).toBe(true)
    expect(hasProductFields(defaultProductFields())).toBe(false)
  })
})

describe('product validation', () => {
  it('accepts a complete product and formats the price', () => {
    const result = valid({ price: '0.001' })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value.price).toBe('0.001')
    expect(valid({ price: '25' }).value.price).toBe('25.000')
  })

  it('requires title and description from the normal post fields', () => {
    expect(validateProductFields(fields(), { title: '', description: 'Body' }).errors[0])
      .toMatch(/title/i)
    expect(validateProductFields(fields(), { title: 'Title', description: '   ' }).errors[0])
      .toMatch(/description/i)
    expect(validateProductFields(defaultProductFields(), { title: '', description: '' }).ok).toBe(true)
  })

  it('rejects zero, negative and over-precise prices', () => {
    expect(valid({ price: '0' }).errors.join(' ')).toMatch(/greater than zero/)
    expect(valid({ price: '-5' }).errors.join(' ')).toMatch(/greater than zero/)
    expect(valid({ price: '1.2345' }).errors.join(' ')).toMatch(/3 decimal places/)
    expect(valid({ price: '' }).errors.join(' ')).toMatch(/Enter a product price/)
    expect(valid({ price: '1.234' }).ok).toBe(true)
  })

  it('only accepts the supported Hive currencies', () => {
    expect(valid({ currency: 'HIVE:HIVE' }).ok).toBe(true)
    expect(normalizeProductFields({ currency: 'BTC:BTC' }).currency).toBe('HIVE:HBD')
    expect(valid({ currency: 'BTC:BTC' }).errors.join(' ')).toMatch(/HBD or HIVE/)
  })

  it('requires at least 24 hours for a subscription', () => {
    expect(valid({ subscription: true, recurrenceHours: 24 }).ok).toBe(true)
    expect(valid({ subscription: true, recurrenceHours: 23 }).errors.join(' ')).toMatch(/at least 24/)
    expect(valid({ subscription: true, recurrenceHours: 48.5 }).errors.join(' ')).toMatch(/whole number/)
    expect(valid({ subscription: false, recurrenceHours: 1 }).ok).toBe(true)
  })

  it('caps product tags at six', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(normalizeProductTags(seven)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(valid({ tags: seven }).errors.join(' ')).toMatch(/at most 6/)
  })

  it('only accepts https images when one is provided', () => {
    expect(valid({ image: ['https://images.hive.blog/a.png'] }).ok).toBe(true)
    expect(valid({ image: [] }).ok).toBe(true)
    expect(valid({ image: ['http://insecure.example/a.png'] }).errors.join(' ')).toMatch(/https/)
  })

  it('rejects an unknown status', () => {
    expect(valid({ status: 4 }).errors.join(' ')).toMatch(/product status/)
    expect(valid({ status: 2 }).ok).toBe(true)
  })
})

describe('product metadata', () => {
  it('builds only the Hive Open Market keys', () => {
    const metadata = buildProductMetadata(fields({
      price: '0.001',
      subscription: true,
      recurrenceHours: 730,
      status: 3
    }))
    expect(metadata).toEqual({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 0.001,
      subscription: 1,
      subscription_recurrence: 730,
      status: 3,
      tags: ['hosting', 'linux'],
      image: ['https://images.hive.blog/hosting.png']
    })
    expect(buildProductMetadata(defaultProductFields())).toEqual({})
    expect(buildProductMetadata(fields({ subscription: false }))).toMatchObject({
      subscription: 0,
      subscription_recurrence: 0
    })
  })

  it('round-trips through published metadata', () => {
    const metadata = buildProductMetadata(fields({ price: '15.500', status: 2 }))
    const read = readProductFieldsFromMetadata(metadata)
    expect(read.enabled).toBe(true)
    expect(read.price).toBe('15.5')
    expect(read.status).toBe(2)
    expect(buildProductMetadata(read)).toEqual(metadata)
    expect(readProductFieldsFromMetadata({ tags: ['blog'] })).toEqual(defaultProductFields())
  })

  it('previews the shop card content', () => {
    const preview = productPreview({
      ...fields({ price: '0.001', subscription: true, recurrenceHours: 730 }),
      title: 'Managed Hive hosting'
    })
    expect(preview).toMatchObject({
      title: 'Managed Hive hosting',
      priceLabel: '0.001 HBD',
      currency: 'HIVE:HBD',
      subscription: true,
      recurrenceHours: 730,
      statusLabel: 'Available',
      tags: ['hosting', 'linux'],
      image: 'https://images.hive.blog/hosting.png'
    })
  })

  it('merges product keys into buildPostMetadata only when enabled', () => {
    const draft = {
      title: 'Managed Hive hosting',
      body: 'Hosting.',
      tags: ['blog'],
      product: fields({ price: '0.001', subscription: true, recurrenceHours: 730 })
    }
    const metadata = buildPostMetadata(draft)
    expect(metadata).toMatchObject({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 0.001,
      subscription: 1,
      subscription_recurrence: 730,
      status: 1,
      tags: ['hosting', 'linux']
    })

    expect(buildPostMetadata({ ...draft, product: defaultProductFields() })).not.toHaveProperty('content_type')
    expect(buildPostMetadata({ title: 'Post', body: 'Body', tags: ['blog'] })).not.toHaveProperty('content_type')
  })

  it('uses the post image first and the product image as a fallback', () => {
    const draft = {
      title: 'Product',
      body: 'Body',
      tags: ['blog'],
      coverImage: 'https://images.hive.blog/cover.png',
      product: fields({ image: ['https://images.hive.blog/product.png'] })
    }
    expect(buildPostMetadata(draft).image).toEqual(['https://images.hive.blog/cover.png'])

    const fallback = buildPostMetadata({ ...draft, coverImage: '' })
    expect(fallback.image).toEqual(['https://images.hive.blog/product.png'])
  })

  it('removes product keys on edit when product mode is turned off', () => {
    const draft = {
      title: 'Managed Hive hosting',
      body: 'Hosting.',
      tags: ['blog'],
      product: defaultProductFields()
    }
    const operation = buildPostOperation({
      username: 'alice',
      draft,
      permlink: 'managed-hosting',
      parentPermlink: 'blog',
      commentOptions: false,
      previousMetadata: {
        app: 'peakd',
        content_type: 'product',
        version: 0.1,
        currency: 'HIVE:HBD',
        price: 25,
        subscription: 0,
        subscription_recurrence: 730,
        status: 1,
        tags: ['hosting']
      }
    })
    const metadata = JSON.parse(operation[1].json_metadata)
    expect(metadata.content_type).toBeUndefined()
    expect(metadata.version).toBeUndefined()
    expect(metadata.price).toBeUndefined()
    expect(metadata.status).toBeUndefined()
    expect(metadata.app).toBe('banksia.io')
  })
})
