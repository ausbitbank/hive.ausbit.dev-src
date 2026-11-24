import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { QIcon, Quasar } from 'quasar'
import ResultList from '../../src/components/search/ResultList.vue'

const moderation = display => ({
  display,
  primary: { layer: 'reputation', label: 'Negative reputation' },
  overrides: ['show-item']
})

function mountList (rows) {
  return mount(ResultList, {
    props: { rows },
    attachTo: document.body,
    global: {
      plugins: [[Quasar, {}]],
      components: { QIcon }
    }
  })
}

describe('search ResultList moderation rows', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('offers one sibling Show anyway action for a collapsed row', () => {
    const wrapper = mountList([{
      key: 'post-alice-one',
      title: 'A collapsed post',
      description: 'Hidden snippet',
      icon: 'article',
      moderation: moderation('collapse')
    }])

    const row = wrapper.get('.result-row')
    expect(row.findAll('button')).toHaveLength(2)
    expect(wrapper.findAll('button button')).toHaveLength(0)
    expect(row.text()).toContain('Show anyway')
    expect(row.get('.result-row__show').attributes('aria-label')).toBe('Show A collapsed post anyway')
    expect(row.find('.result-row__description').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps labelled rows readable and only offers the action when something is hidden', () => {
    const wrapper = mountList([
      {
        key: 'post-bob-one',
        title: 'A labelled post',
        description: 'Readable snippet',
        moderation: moderation('label')
      },
      {
        key: 'post-carol-one',
        title: 'A shown post',
        description: 'Shown snippet',
        moderation: moderation('show')
      }
    ])

    const rows = wrapper.findAll('.result-row')
    expect(rows[0].find('.result-row__description').exists()).toBe(true)
    expect(rows[0].find('.result-row__show').exists()).toBe(false)
    expect(rows[0].find('.result-row__moderation').exists()).toBe(true)
    expect(rows[1].find('.result-row__show').exists()).toBe(false)
    expect(rows[1].find('.result-row__moderation').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits the row and restores focus to its open button', async () => {
    const row = {
      key: 'post-dave-one',
      title: 'A hidden post',
      description: 'Hidden snippet',
      moderation: moderation('hide')
    }
    const wrapper = mountList([row])
    const action = wrapper.get('.result-row__show')
    await action.trigger('click')

    expect(wrapper.emitted('show')).toHaveLength(1)
    expect(wrapper.emitted('show')[0][0]).toEqual(row)
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('.result-row__open').element)
    wrapper.unmount()
  })
})
