import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { useHiveStore } from '../../src/stores/hive'
import CommentForm from '../../src/components/CommentForm.vue'

function mountEditForm (store, overrides = {}) {
  return shallowMount(CommentForm, {
    props: {
      parentAuthor: 'peak.snaps',
      parentPermlink: 'snap-container-1',
      mode: 'edit',
      initialBody: 'original body',
      author: 'alice',
      permlink: 'hive-snaps-abc123',
      jsonMetadata: '{"app":"peakd","tags":["snaps"]}',
      ...overrides
    },
    global: {
      plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
      mocks: { $q: { screen: { gt: { xs: true } }, notify: () => {} } }
    }
  })
}

describe('comment form', () => {
  it('keeps the original parent author when editing a Snap comment', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    store.user.username = 'alice'
    store.user.settings = { ...store.user.settings, beneficiary: [] }

    const wrapper = mountEditForm(store)
    wrapper.vm.body = 'updated body'
    await wrapper.vm.$nextTick()
    wrapper.vm.submit()

    expect(store.queue).toHaveLength(1)
    const operation = store.queue[0][2][1]
    expect(operation).toMatchObject({
      parent_author: 'peak.snaps',
      parent_permlink: 'snap-container-1',
      author: 'alice',
      permlink: 'hive-snaps-abc123',
      body: 'updated body',
      _edit: true
    })
  })
})
