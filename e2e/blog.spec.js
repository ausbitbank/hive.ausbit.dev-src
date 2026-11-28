import { test, expect } from './fixtures'
import { loginAs, readQueue, runAxe } from './helpers'

// The production build registers a service worker on loopback. Its navigation
// fallback can answer the same-origin /api/blogs request before Playwright's
// route mock, so keep service workers out of these network-mocked tests.
test.use({ serviceWorkers: 'block' })

const ACCOUNT = {
  name: 'alice',
  created: '2025-01-01T00:00:00',
  reputation: '1234567890',
  post_count: 42,
  json_metadata: '',
  posting_json_metadata: JSON.stringify({
    profile: {
      name: 'Alice',
      about: 'Writer and photographer.',
      profile_image: 'https://images.hive.blog/u/alice/avatar'
    },
    'banksia.io': {
      blog: {
        version: 1,
        claimed: true,
        title: 'Alice writes',
        description: 'Notes from the garden.',
        theme: 'paper',
        directory: true
      }
    }
  })
}

function accountWithBlog (blog) {
  return {
    ...ACCOUNT,
    posting_json_metadata: JSON.stringify({
      profile: {
        name: 'Alice',
        about: 'Writer and photographer.',
        profile_image: 'https://images.hive.blog/u/alice/avatar'
      },
      'banksia.io': {
        blog: {
          version: 1,
          claimed: true,
          title: 'Alice writes',
          description: 'Notes from the garden.',
          theme: 'paper',
          ...blog
        }
      }
    })
  }
}

const PROFILE = {
  name: 'alice',
  metadata: {
    profile: {
      name: 'Alice',
      about: 'Writer and photographer.',
      profile_image: 'https://images.hive.blog/u/alice/avatar'
    }
  }
}

const POSTS = [
  {
    author: 'alice',
    permlink: 'a-post',
    title: 'A post',
    body: 'Hello from the garden.',
    created: '2026-11-20T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({ image: ['https://images.hive.blog/garden.png'] }),
    stats: { total_votes: 3 }
  },
  {
    author: 'alice',
    permlink: 'another-post',
    title: 'Another post',
    body: 'More notes from the garden.',
    created: '2026-11-19T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({ image: ['https://images.hive.blog/notes.png'] }),
    stats: { total_votes: 1 }
  }
]

const PRODUCTS = [
  {
    author: 'alice',
    permlink: 'managed-hosting',
    title: 'Managed Hive hosting',
    body: 'Managed hosting for a Hive project.',
    created: '2026-11-18T10:00:00',
    last_update: '2026-11-19T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 25,
      subscription: 0,
      status: 1,
      tags: ['hosting', 'linux'],
      image: ['https://images.hive.blog/hosting.png']
    }),
    stats: { total_votes: 2 }
  },
  {
    author: 'alice',
    permlink: 'consulting',
    title: 'Consulting call',
    body: 'A monthly consulting call.',
    created: '2026-11-17T10:00:00',
    depth: 0,
    json_metadata: JSON.stringify({
      content_type: 'product',
      version: 0.1,
      currency: 'HIVE:HBD',
      price: 50,
      subscription: 1,
      subscription_recurrence: 730,
      status: 1,
      tags: ['consulting']
    }),
    stats: { total_votes: 1 }
  }
]

const MEMBERSHIP_PRODUCT = {
  author: 'alice',
  permlink: 'membership',
  title: 'The Orchid Letter',
  body: 'Weekly orchid field notes and the full archive.',
  created: '2026-11-16T10:00:00',
  depth: 0,
  json_metadata: JSON.stringify({
    content_type: 'product',
    version: 0.1,
    currency: 'HIVE:HBD',
    price: 5,
    subscription: 1,
    subscription_recurrence: 730,
    status: 1,
    tags: ['membership', 'vault'],
    banksia_vault_product: {
      v: 1,
      plan: 'member',
      container: 'banksia-vault',
      archive: 'all',
      executions: 12,
      benefits: ['Weekly orchid notes', 'Full archive']
    }
  }),
  stats: { total_votes: 1 }
}

const GLOBAL_PROPS = {
  head_block_number: 1,
  head_block_id: '0000000000000000000000000000000000000000',
  time: '2026-11-27T00:00:00',
  current_witness: 'alice',
  total_vesting_fund_hive: '1.000 HIVE',
  total_vesting_shares: '1.000000 VESTS',
  hbd_interest_rate: 0
}

async function mockHive (page, { account = ACCOUNT, profile = PROFILE, posts = POSTS, history = [], recurrent = [] } = {}) {
  // Obscura sends the bare host without a trailing slash; a `/**` glob does
  // not match that, so use an explicit regex for both shapes.
  await page.route(/^https:\/\/api\.hive\.blog(?:\/.*)?$/, async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    let body
    try {
      body = JSON.parse(request.postData() || '{}')
    } catch {
      return route.continue()
    }
    let result
    switch (body.method) {
      case 'condenser_api.get_accounts':
        result = [account]
        break
      case 'bridge.get_profile':
        result = profile
        break
      case 'bridge.get_account_posts':
        result = posts
        break
      case 'bridge.get_post': {
        const permlink = body.params && body.params.permlink
        result = posts.find(post => post.permlink === permlink) || posts[0] || null
        break
      }
      case 'condenser_api.get_content': {
        const permlink = Array.isArray(body.params) ? body.params[1] : ''
        result = posts.find(post => post.permlink === permlink) || posts[0] || null
        break
      }
      case 'condenser_api.get_dynamic_global_properties':
        result = GLOBAL_PROPS
        break
      case 'condenser_api.get_account_history':
        result = history
        break
      case 'condenser_api.find_recurrent_transfers':
        result = recurrent
        break
      default:
        result = null
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result })
    })
  })
}

async function axeAtBothWidths (page, label) {
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(400)
    const violations = await runAxe(page)
    expect(violations, label + ' at ' + viewport.width + 'px').toEqual([])
  }
}

test('/blogs landing is accessible', async ({ page }) => {
  await page.goto('/blogs', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blogs-title')).toBeVisible()
  await expect(page.locator('.blogs-theme')).toHaveCount(5)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A blog that is already yours.')
  await axeAtBothWidths(page, '/blogs')
})

test('blog settings are discoverable from the account menu', async ({ page }) => {
  await loginAs(page, 'ausbitbank')
  await page.goto('/blogs', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Account menu/ }).click()
  const link = page.getByRole('link', { name: 'Blog settings', exact: true })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/settings/blog?account=ausbitbank')
})

test('/settings/blog social card layout is accessible', async ({ page }) => {  await mockHive(page)
  await page.goto('/settings/blog?account=alice', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-settings__title')).toBeVisible()
  await expect(page.locator('.blog-settings__og')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate social card' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Page sections' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Custom CSS' })).toBeVisible()
  await axeAtBothWidths(page, '/settings/blog')
})

test('/blogs/directory lists opted-in blogs', async ({ page }) => {  await mockHive(page)
  await page.route('**/api/blogs', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ accounts: ['alice'], configured: true })
  }))

  await page.goto('/blogs/directory', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.directory-card')).toHaveCount(1)
  await expect(page.locator('.directory-card h2')).toHaveText('Alice writes')
  await expect(page.locator('.directory-card__handle')).toHaveText('@alice')
  await axeAtBothWidths(page, '/blogs/directory')
})

test('blog host renders a clean, accessible reading page', async ({ page }) => {
  await mockHive(page)
  // The Playwright config serves the built SPA on 4173; *.localhost resolves to
  // loopback in Chromium, and the router selects the blog route table from the
  // hostname exactly as it does in production.
  await page.goto('http://alice.localhost:4173/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-hero__title')).toHaveText('Alice writes')
  await expect(page.locator('.blog-card')).toHaveCount(2)
  await expect(page.locator('.blog-claim')).toHaveCount(0)
  await expect(page.locator('.site-footer')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alice writes')
  await axeAtBothWidths(page, 'blog host')
})

test('blog host honours layout, width, nav and reader mode', async ({ page }) => {
  const account = accountWithBlog({
    mode: 'dark',
    layout: 'magazine',
    width: 'narrow',
    typography: 'serif',
    hero: 'minimal',
    showTags: false,
    showReadingTime: false,
    nav: [{ label: 'Start here', href: '/about' }]
  })
  await mockHive(page, { account })
  await page.goto('http://alice.localhost:4173/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-hero__title')).toHaveText('Alice writes')
  await expect(page.locator('.blog-shell--narrow')).toHaveCount(1)
  await expect(page.locator('.blog-shell--dark')).toHaveCount(1)
  await expect(page.locator('.blog-hero__cover')).toHaveCount(0)
  await expect(page.locator('.blog-card--feature')).toHaveCount(1)
  await expect(page.locator('.blog-card__tags')).toHaveCount(0)
  await expect(page.getByText(/min read/)).toHaveCount(0)
  await expect(page.locator('.blog-nav').getByText('Start here')).toBeVisible()

  // A reader override changes the variant without changing the author's theme.
  await page.locator('.blog-mode__select').selectOption('light')
  await expect(page.locator('.blog-shell--light')).toHaveCount(1)
  await axeAtBothWidths(page, 'customised blog host')
})

test('blog host renders owner sections, custom CSS and branding', async ({ page }) => {
  const account = accountWithBlog({
    blocks: [
      { type: 'text', visible: true, title: 'Welcome', body: 'Hello **world**.' },
      { type: 'archive', visible: true, layout: 'list' }
    ],
    css: '.blog-shell .blog-custom-section__text { color: rgb(1, 2, 3); }',
    logo: 'https://images.hive.blog/brand-logo.png',
    favicon: 'https://images.hive.blog/brand-favicon.png'
  })
  await mockHive(page, { account })
  await page.goto('http://alice.localhost:4173/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.blog-hero')).toHaveCount(0)
  await expect(page.locator('.blog-custom-section__text')).toContainText('Hello world.')
  await expect(page.locator('.blog-grid--list')).toHaveCount(1)
  await expect(page.locator('.blog-brand__avatar')).toHaveAttribute('src', /brand-logo\.png/)
  await expect.poll(async () => {
    return page.locator('.blog-custom-section__text').evaluate(el => getComputedStyle(el).color)
  }).toBe('rgb(1, 2, 3)')
  await expect.poll(async () => {
    return page.locator('link[rel~="icon"]').first().getAttribute('href')
  }).toContain('brand-favicon.png')
  await axeAtBothWidths(page, 'owner-customised blog host')
})

test('portfolio renders curated images and a full-screen viewer', async ({ page }) => {
  const account = accountWithBlog({
    portfolio: {
      enabled: true,
      title: 'Selected work',
      description: 'A small gallery from the blog.',
      layout: 'grid',
      items: ['a-post', 'another-post']
    }
  })
  await mockHive(page, { account })
  await page.goto('http://alice.localhost:4173/portfolio', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.portfolio-title')).toHaveText('Selected work')
  await expect(page.locator('.portfolio-item')).toHaveCount(2)
  await page.locator('.portfolio-item__image').first().click()
  await expect(page.locator('.portfolio-lightbox')).toBeVisible()
  await page.getByRole('button', { name: 'Close image viewer' }).click()
  await expect(page.locator('.portfolio-lightbox')).not.toBeVisible()
  await axeAtBothWidths(page, 'portfolio')
})

test('shop lists Hive Open Market products', async ({ page }) => {
  const account = accountWithBlog({
    shop: { enabled: true, title: 'Shop', description: 'Buy directly from Alice.' }
  })
  await mockHive(page, { account, posts: PRODUCTS })
  await page.goto('http://alice.localhost:4173/shop', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.shop-title')).toHaveText('Shop')
  await expect(page.locator('.shop-item')).toHaveCount(2)
  await expect(page.locator('.shop-item__price').first()).toContainText('25.000 HBD')
  await expect(page.getByRole('link', { name: 'Buy on Banksia' }).first())
    .toHaveAttribute('href', /\/pay\?product=alice%2Fmanaged-hosting/)
  await axeAtBothWidths(page, 'shop')
})

test('shop search and tag filters narrow the catalogue', async ({ page }) => {
  const account = accountWithBlog({
    shop: { enabled: true, title: 'Shop', description: 'Buy directly from Alice.' }
  })
  await mockHive(page, { account, posts: PRODUCTS })
  await page.goto('http://alice.localhost:4173/shop', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.shop-item')).toHaveCount(2)

  await page.locator('#shop-search').fill('consulting')
  await expect(page.locator('.shop-item')).toHaveCount(1)
  await expect(page.locator('.shop-item__title')).toContainText('Consulting call')

  await page.locator('#shop-search').fill('')
  await page.getByRole('button', { name: /#hosting/ }).click()
  await expect(page.locator('.shop-item')).toHaveCount(1)
  await expect(page.locator('.shop-item__title')).toContainText('Managed Hive hosting')
  await axeAtBothWidths(page, 'shop filters')
})

test('product detail renders price, gallery and Product JSON-LD', async ({ page }) => {
  const account = accountWithBlog({
    shop: { enabled: true, title: 'Shop', description: 'Buy directly from Alice.' }
  })
  await mockHive(page, { account, posts: PRODUCTS })
  await page.goto('http://alice.localhost:4173/shop/managed-hosting', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.product-title')).toHaveText('Managed Hive hosting')
  await expect(page.locator('.product-price')).toHaveText('25.000 HBD')
  await expect(page.locator('.product-seller')).toContainText('@alice')
  await expect(page.locator('.product-seller-card')).toContainText('On Hive')
  await expect(page.locator('.product-seller-card')).toContainText('25.8')
  await expect(page.locator('.product-seller-card')).toContainText('42')
  await expect(page.locator('.product-edited')).toContainText('Seller edited this product')
  await expect(page.locator('.product-body')).toContainText('Managed hosting for a Hive project.')
  await expect(page.getByRole('link', { name: 'Buy on Banksia' }))
    .toHaveAttribute('href', /\/pay\?product=alice%2Fmanaged-hosting/)
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible()

  const jsonLd = await page.locator('#page-json-ld').textContent()
  expect(JSON.parse(jsonLd)).toMatchObject({
    '@type': 'Product',
    name: 'Managed Hive hosting',
    offers: {
      '@type': 'Offer',
      price: '25.000',
      priceCurrency: 'HBD',
      availability: 'https://schema.org/InStock'
    }
  })
  await axeAtBothWidths(page, 'product detail')
})

test('shop routes Vault membership products to Subscribe', async ({ page }) => {
  const account = accountWithBlog({
    shop: { enabled: true, title: 'Shop', description: 'Buy directly from Alice.' }
  })
  await mockHive(page, { account, posts: [MEMBERSHIP_PRODUCT] })
  await page.goto('http://alice.localhost:4173/shop', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.shop-item')).toHaveCount(1)
  await expect(page.locator('.shop-item__membership')).toHaveText('Membership')
  await expect(page.getByRole('link', { name: 'Subscribe (membership)' }))
    .toHaveAttribute('href', 'https://banksia.io/subscribe?blog=alice&product=alice%2Fmembership')
  await axeAtBothWidths(page, 'shop membership')
})

test('membership detail explains account access and skips the cart', async ({ page }) => {
  const account = accountWithBlog({
    shop: { enabled: true, title: 'Shop', description: 'Buy directly from Alice.' }
  })
  await mockHive(page, { account, posts: [MEMBERSHIP_PRODUCT] })
  await page.goto('http://alice.localhost:4173/shop/membership', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.product-title')).toHaveText('The Orchid Letter')
  await expect(page.locator('.product-membership')).toContainText('Hive account')
  await expect(page.locator('.product-membership')).toContainText('Weekly orchid notes')
  await expect(page.getByRole('link', { name: 'Become a member' }))
    .toHaveAttribute('href', 'https://banksia.io/subscribe?blog=alice&product=alice%2Fmembership')
  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0)
  await axeAtBothWidths(page, 'membership detail')
})

test('legacy pay and cart checkout refuse a Vault membership', async ({ page }) => {
  await loginAs(page, 'ausbitbank')
  await mockHive(page, { posts: [MEMBERSHIP_PRODUCT] })

  await page.goto('/pay?product=alice/membership&quantity=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.pay-title')).toHaveText('The Orchid Letter')
  await expect(page.getByText('Subscribe on the membership page so your reader key', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Queue subscription' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Open membership page' }))
    .toHaveAttribute('href', '/subscribe?blog=alice&product=alice%2Fmembership')

  await page.goto('/checkout?items=alice%2Fmembership:1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.checkout-errors')).toContainText('Banksia Vault membership')
  await expect(page.locator('.checkout-line')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Queue/ })).toBeDisabled()
  await axeAtBothWidths(page, 'membership checkout guard')
})

test('cart imports a product link and groups it by seller', async ({ page }) => {
  await mockHive(page, { posts: PRODUCTS })
  await page.goto('/cart?items=alice%2Fmanaged-hosting:2', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cart-title')).toHaveText('Cart')
  await expect(page.locator('.cart-line__title')).toContainText('Managed Hive hosting')
  await expect(page.locator('.cart-line__subtotal')).toContainText('50.000 HBD')
  await expect(page.locator('.cart-seller')).toContainText('@alice')
  await axeAtBothWidths(page, 'cart')
})

test('checkout re-fetches products and queues one transfer per line', async ({ page }) => {
  await loginAs(page, 'ausbitbank')
  await mockHive(page, { posts: PRODUCTS })
  await page.goto('/checkout?items=alice%2Fmanaged-hosting:2', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.checkout-line__title')).toHaveText('Managed Hive hosting')
  await expect(page.locator('.checkout-line')).toHaveCount(1)
  const preview = JSON.parse(await page.locator('.checkout-op').textContent())
  expect(preview[0]).toBe('transfer')
  expect(preview[1].amount).toBe('50.000 HBD')
  expect(preview[1].memo).toBe('{"product":"alice/managed-hosting","quantity":2}')
  await axeAtBothWidths(page, 'checkout')
  await page.getByRole('button', { name: 'Queue 1 payment' }).click()
  await expect(page.locator('.checkout-banner--ok')).toBeVisible()
  const queue = await readQueue(page)
  expect(queue.items[0]).toEqual([
    'ausbitbank',
    'active',
    ['transfer', {
      to: 'alice',
      from: 'ausbitbank',
      amount: '50.000 HBD',
      memo: '{"product":"alice/managed-hosting","quantity":2}'
    }]
  ])
})

test('orders lists purchases and queues a subscription cancellation', async ({ page }) => {
  await loginAs(page, 'ausbitbank')
  const history = [
    [1, {
      trx_id: 'buy-trx',
      timestamp: '2026-11-26T10:00:00',
      op: ['transfer', {
        from: 'ausbitbank',
        to: 'alice',
        amount: '25.000 HBD',
        memo: '{"product":"alice/managed-hosting","quantity":1}'
      }]
    }],
    [2, {
      trx_id: 'sale-trx',
      timestamp: '2026-11-25T10:00:00',
      op: ['transfer', {
        from: 'bob',
        to: 'ausbitbank',
        amount: '5.000 HBD',
        memo: '{"product":"ausbitbank/consulting","quantity":1}'
      }]
    }]
  ]
  const recurrent = [{
    id: 501,
    trigger_date: '2026-12-27T10:00:00',
    from: 'ausbitbank',
    to: 'alice',
    amount: '50.000 HBD',
    memo: '{"product":"alice/consulting","quantity":1}',
    recurrence: 730,
    remaining_executions: 11,
    pair_id: 0
  }]
  await mockHive(page, { history, recurrent, posts: PRODUCTS })
  await page.goto('/orders', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.orders-title')).toHaveText('Orders')
  await expect(page.locator('.orders-item')).toHaveCount(1)
  await expect(page.locator('.orders-item__title')).toContainText('Managed Hive hosting')
  await expect(page.locator('.orders-tab__count').first()).toHaveText('1')

  await page.getByRole('tab', { name: /Sales/ }).click()
  await expect(page.locator('.orders-item__title')).toContainText('Consulting call')

  await page.getByRole('tab', { name: /Subscriptions/ }).click()
  await expect(page.locator('.orders-item__title')).toContainText('Consulting call')
  await expect(page.getByRole('button', { name: /Queue cancellation/ })).toBeVisible()
  await axeAtBothWidths(page, 'orders')

  await page.getByRole('button', { name: /Queue cancellation/ }).click()
  await expect(page.locator('.orders-banner--ok')).toBeVisible()
  const queue = await readQueue(page)
  expect(queue.items[0]).toEqual([
    'ausbitbank',
    'active',
    ['recurrent_transfer', {
      to: 'alice',
      from: 'ausbitbank',
      amount: '0.000 HBD',
      memo: '{"product":"alice/consulting","quantity":1}',
      recurrence: 730,
      executions: 2,
      extensions: []
    }]
  ])
})

test('pay page reviews a product and queues a direct transfer', async ({ page }) => {
  await loginAs(page, 'ausbitbank')
  await mockHive(page, { posts: PRODUCTS })
  await page.goto('/pay?product=alice/managed-hosting&quantity=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.pay-title')).toHaveText('Managed Hive hosting')
  await expect(page.locator('.pay-price')).toContainText('25.000 HBD')
  await axeAtBothWidths(page, 'pay')
  await page.getByRole('button', { name: 'Queue payment' }).click()
  await expect(page.locator('.pay-banner--ok')).toBeVisible()
  const queue = await readQueue(page)
  expect(queue.items[0]).toEqual([
    'ausbitbank',
    'active',
    ['transfer', {
      to: 'alice',
      from: 'ausbitbank',
      amount: '25.000 HBD',
      memo: '{"product":"alice/managed-hosting","quantity":1}'
    }]
  ])
})
