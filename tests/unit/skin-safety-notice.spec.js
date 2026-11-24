import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { QBtn, QIcon, Quasar } from 'quasar'
import SkinSafetyNotice from '../../src/components/theme/SkinSafetyNotice.vue'

const decision = {
  allowed: false,
  code: 'personal-mute',
  label: 'Skin hidden: you mute @alice',
  detail: 'You can show it anyway.',
  owners: [],
  overrides: ['show-author', 'manage']
}

function mountNotice (props = {}) {
  return mount(SkinSafetyNotice, {
    props: {
      decision,
      hasModeration: true,
      canFollowOverride: true,
      ...props
    },
    global: {
      plugins: [[Quasar, {}]],
      components: { QBtn, QIcon }
    }
  })
}

describe('SkinSafetyNotice', () => {
  it('explains the reason and offers the override actions', () => {
    const wrapper = mountNotice()
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Profile skin hidden')
    expect(wrapper.text()).toContain('Skin hidden: you mute @alice')
    expect(wrapper.text()).toContain('Show this skin anyway')
    expect(wrapper.text()).toContain('Always show skins from accounts I follow')
    expect(wrapper.text()).toContain('Manage skin safety')
  })

  it('emits the chosen override', async () => {
    const wrapper = mountNotice()
    const show = wrapper.findAll('button').find(button => button.text() === 'Show this skin anyway')
    await show.trigger('click')
    expect(wrapper.emitted('show')).toHaveLength(1)

    const follow = wrapper.findAll('button').find(button => button.text().includes('Always show skins'))
    await follow.trigger('click')
    expect(wrapper.emitted('enable-followed')).toHaveLength(1)
  })

  it('uses a preview action in the Studio and hides Show when no store loaded', async () => {
    const preview = mountNotice({ preview: true, hasModeration: false })
    expect(preview.text()).toContain('Preview anyway')
    expect(preview.text()).not.toContain('Show this skin anyway')
    const button = preview.findAll('button').find(item => item.text() === 'Preview anyway')
    await button.trigger('click')
    expect(preview.emitted('preview')).toHaveLength(1)
  })
})
