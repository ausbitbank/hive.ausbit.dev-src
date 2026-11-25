import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { QBtn, QIcon, Quasar } from 'quasar'
import ModerationNotice from '../../src/components/moderation/ModerationNotice.vue'

const decision = {
  display: 'collapse',
  primary: {
    layer: 'personal-mute',
    label: 'Muted by you',
    detail: 'You added @alice to your Hive mute list.',
    evidence: {},
    overrideKey: null
  },
  reasons: [{
    layer: 'personal-mute',
    label: 'Muted by you',
    detail: 'You added @alice to your Hive mute list.',
    evidence: {}
  }],
  author: 'alice',
  itemKey: 'alice/post',
  conflict: null,
  overrides: ['show-item', 'always-show-author', 'always-hide-author', 'manage'],
  unknownContext: false
}

function mountNotice (props = {}) {
  return mount(ModerationNotice, {
    props: { decision, compact: true, ...props },
    global: {
      plugins: [[Quasar, {}]],
      components: { QBtn, QIcon }
    }
  })
}

describe('ModerationNotice', () => {
  it('shows the short reason and a Show anyway action', () => {
    const wrapper = mountNotice()
    expect(wrapper.text()).toContain('Muted by you')
    expect(wrapper.text()).toContain('Show anyway')
  })

  it('expands reasons and emits the chosen override', async () => {
    const wrapper = mountNotice()
    await wrapper.findAll('button').find(button => button.text() === 'Why?').trigger('click')
    expect(wrapper.text()).toContain('You added @alice')
    expect(wrapper.text()).toContain('Always show @alice')

    await wrapper.findAll('button').find(button => button.text() === 'Show anyway').trigger('click')
    expect(wrapper.emitted('show')).toHaveLength(1)
  })

  it('shows the one-time Balanced explanation and dismisses it', async () => {
    const wrapper = mountNotice({ showDisclosure: true })
    expect(wrapper.text()).toContain('Balanced mode labels or collapses')
    await wrapper.findAll('button').find(button => button.text() === 'Got it').trigger('click')
    expect(wrapper.emitted('dismiss-disclosure')).toHaveLength(1)
  })

  it('does not offer Show anyway for a labelled item', () => {
    const wrapper = mountNotice({
      decision: { ...decision, display: 'label', overrides: ['manage'] }
    })
    expect(wrapper.text()).not.toContain('Show anyway')
  })

  it('lists known downvoters and emits the chosen local exclusion', async () => {
    const wrapper = mountNotice({
      decision: {
        ...decision,
        downvoters: [
          { voter: 'bob', ignored: false },
          { voter: 'carol', ignored: true }
        ]
      }
    })
    await wrapper.findAll('button').find(button => button.text() === 'Why?').trigger('click')
    expect(wrapper.text()).toContain('Ignore @bob')
    expect(wrapper.text()).toContain('Unignore @carol')

    await wrapper.findAll('button').find(button => button.text() === 'Ignore @bob').trigger('click')
    expect(wrapper.emitted('ignore-voter')).toEqual([['bob']])
  })
})
