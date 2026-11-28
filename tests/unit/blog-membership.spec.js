import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import BlogMembershipCallout from '../../src/components/blog/BlogMembershipCallout.vue'
import BlogPostCard from '../../src/components/blog/BlogPostCard.vue'
import { useBlogStore } from '../../src/stores/blog'

const ROUTER_STUB = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : \'\'"><slot /></a>'
}

function mountCallout (settings) {
  return mount(BlogMembershipCallout, {
    props: {
      settings,
      blog: 'alice',
      subscribeUrl: 'https://banksia.io/subscribe?blog=alice&product=alice%2Fmembership',
      productPath: '/shop/membership'
    },
    global: {
      stubs: { 'q-icon': true, RouterLink: ROUTER_STUB }
    }
  })
}

describe('blog membership discovery', () => {
  it('advertises the offer, price cadence and a direct subscribe link', () => {
    const wrapper = mountCallout({
      price: '5.000 HBD',
      recurrence: 730,
      productTitle: 'The Orchid Letter',
      productDescription: 'Weekly field notes and the full archive.',
      benefits: ['Weekly notes', 'Full archive']
    })

    expect(wrapper.get('#blog-membership-title').text()).toBe('The Orchid Letter')
    expect(wrapper.text()).toContain('Weekly field notes and the full archive.')
    expect(wrapper.text()).toContain('5.000 HBD')
    expect(wrapper.text()).toContain('per month')
    expect(wrapper.text()).toContain('Weekly notes')
    expect(wrapper.get('a.blog-membership__button').attributes('href'))
      .toBe('https://banksia.io/subscribe?blog=alice&product=alice%2Fmembership')
    expect(wrapper.get('a.blog-membership__link').attributes('href')).toBe('/shop/membership')
  })

  it('stays out of the way when the blog has no priced offer', () => {
    const wrapper = mountCallout({ price: '' })
    expect(wrapper.find('.blog-membership').exists()).toBe(false)
  })

  it('marks members-only posts in the archive so readers can discover them', () => {
    setActivePinia(createPinia())
    useBlogStore().accountName = 'alice'

    const wrapper = mount(BlogPostCard, {
      props: {
        post: {
          author: 'alice',
          permlink: 'members-post',
          title: 'The orchid notes',
          body: 'A public teaser.',
          created: '2026-11-20T10:00:00',
          json_metadata: JSON.stringify({ banksia_vault: { v: 1, mode: 'section' } })
        }
      },
      global: {
        stubs: { 'q-icon': true, RouterLink: ROUTER_STUB }
      }
    })

    expect(wrapper.get('.blog-card__members').text()).toContain('Members')
  })

  it('does not label an ordinary public post as members-only', () => {
    setActivePinia(createPinia())
    useBlogStore().accountName = 'alice'

    const wrapper = mount(BlogPostCard, {
      props: {
        post: {
          author: 'alice',
          permlink: 'public-post',
          title: 'A public note',
          body: 'Everyone can read this.',
          created: '2026-11-20T10:00:00',
          json_metadata: '{}'
        }
      },
      global: {
        stubs: { 'q-icon': true, RouterLink: ROUTER_STUB }
      }
    })

    expect(wrapper.find('.blog-card__members').exists()).toBe(false)
  })
})
