import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { useHiveStore } from '../../src/stores/hive'
import PropsEditor from '../../src/components/propsEditor.vue'

function mountEditor ({ json = '', type = 'postingMeta', account = {} } = {}) {
  setActivePinia(createPinia())
  const store = reactive(useHiveStore())
  store.user.username = 'banksia-io'
  const wrapper = shallowMount(PropsEditor, {
    props: {
      json,
      username: 'banksia-io',
      type,
      account: {
        name: 'banksia-io',
        posting: { weight_threshold: 1, account_auths: [], key_auths: [] },
        memo_key: 'STM111',
        ...account
      }
    },
    global: {
      plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
      mocks: { $q: { notify: () => {}, screen: {} } },
      directives: { 'close-popup': {} },
      stubs: {
        jsonViewer: { template: '<div />' },
        'json-viewer': { template: '<div />' },
        ImageUploadButton: { template: '<div />' },
        'image-upload-button': { template: '<div />' },
        'q-input': true,
        'q-btn': true,
        'q-chip': true,
        'q-icon': true,
        'q-img': true,
        'q-dialog': true,
        'q-card': true
      }
    }
  })
  return { store, wrapper }
}

describe('props editor', () => {
  it('renders a brand-new account with empty metadata instead of crashing', () => {
    const { wrapper } = mountEditor({ json: '' })
    expect(wrapper.vm.newjson).toBe('{}')
    expect(wrapper.vm.parsed.ok).toBe(true)
    expect(wrapper.vm.dirty).toBe(false)
  })

  it('sets profile and cover images on an empty account and queues posting metadata', () => {
    const { store, wrapper } = mountEditor({ json: '' })
    wrapper.vm.applyProfileField('profile_image', 'https://images.hive.blog/a.png')
    wrapper.vm.setImageFromUpload('cover_image', [{ url: 'https://images.hive.blog/cover.png' }])

    expect(wrapper.vm.parsed.value.profile).toEqual({
      profile_image: 'https://images.hive.blog/a.png',
      cover_image: 'https://images.hive.blog/cover.png'
    })
    expect(wrapper.vm.dirty).toBe(true)
    expect(wrapper.vm.profileImage).toBe('https://images.hive.blog/a.png')

    wrapper.vm.submitChanges()

    expect(store.queue).toHaveLength(1)
    const [owner, keyType, operation] = store.queue[0]
    expect(owner).toBe('banksia-io')
    expect(keyType).toBe('posting')
    expect(operation[0]).toBe('account_update2')
    expect(operation[1].json_metadata).toBe('')
    expect(JSON.parse(operation[1].posting_json_metadata).profile.cover_image)
      .toBe('https://images.hive.blog/cover.png')
    expect(wrapper.vm.edited).toBe(true)
    expect(wrapper.vm.dirty).toBe(false)
  })

  it('removes an image URL and keeps the rest of the profile', () => {
    const { wrapper } = mountEditor({
      json: JSON.stringify({ profile: { name: 'Banksia', cover_image: 'https://images.hive.blog/c.png' } })
    })
    wrapper.vm.applyProfileField('cover_image', '')
    expect(wrapper.vm.parsed.value.profile).toEqual({ name: 'Banksia' })
  })

  it('updates legacy metadata with the active key', () => {
    const { store, wrapper } = mountEditor({
      json: JSON.stringify({ profile: { name: 'Banksia' } }),
      type: 'jsonMeta'
    })
    wrapper.vm.applyProfileField('about', 'An open-source Hive explorer.')
    wrapper.vm.submitChanges()

    expect(store.queue).toHaveLength(1)
    const [owner, keyType, operation] = store.queue[0]
    expect(owner).toBe('banksia-io')
    expect(keyType).toBe('active')
    expect(operation[0]).toBe('account_update')
    expect(JSON.parse(operation[1].json_metadata).profile.about)
      .toBe('An open-source Hive explorer.')
  })

  it('refuses to submit invalid JSON', () => {
    const { store, wrapper } = mountEditor({ json: '{oops' })
    expect(wrapper.vm.parsed.ok).toBe(false)
    wrapper.vm.submitChanges()
    expect(store.queue).toHaveLength(0)
    expect(wrapper.vm.error).toBe(true)
    expect(wrapper.vm.log).toMatch(/valid JSON/i)
  })

  it('refuses a legacy update when the account is missing required fields', () => {
    const { store, wrapper } = mountEditor({
      json: '{}',
      type: 'jsonMeta',
      account: { posting: null, memo_key: null }
    })
    wrapper.vm.applyProfileField('name', 'Banksia')
    wrapper.vm.submitChanges()
    expect(store.queue).toHaveLength(0)
    expect(wrapper.vm.error).toBe(true)
  })

  it('discards draft changes back to the loaded metadata', () => {
    const original = JSON.stringify({ profile: { name: 'Banksia' } })
    const { wrapper } = mountEditor({ json: original })
    wrapper.vm.applyProfileField('name', 'Changed')
    expect(wrapper.vm.parsed.value.profile.name).toBe('Changed')
    wrapper.vm.discardChanges()
    expect(wrapper.vm.parsed.value.profile.name).toBe('Banksia')
    expect(wrapper.vm.dirty).toBe(false)
  })
})
