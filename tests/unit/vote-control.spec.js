import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { useHiveStore } from '../../src/stores/hive'
import Vote from '../../src/components/vote.vue'

// Minimal Quasar stand-ins: these tests assert on the vote control's state
// machine, not on Quasar rendering.
const QBtn = defineComponent({
  name: 'QBtn',
  props: { label: { type: [String, Number], default: '' }, disable: { type: Boolean, default: false } },
  emits: ['click'],
  setup (props, { emit, slots }) {
    return () => h('button', {
      class: 'q-btn-stub',
      disabled: props.disable,
      onClick: event => emit('click', event)
    }, [slots.default ? slots.default() : String(props.label ?? '')])
  }
})
const Stub = defineComponent({ name: 'Stub', setup: (_, { slots }) => () => h('span', slots.default ? slots.default() : []) })
const Spinner = defineComponent({ name: 'QSpinnerTail', setup: () => () => h('span', { class: 'q-spinner-stub' }) })

function mountVote (store, votes = []) {
  // The component reads settings and username straight off the store, so keep
  // the shape identical to the real store.
  store.user.username = 'alice'
  store.user.settings = { ...store.user.settings, voteWeightPost: 100 }
  return mount(Vote, {
    props: { votes, author: 'bob', permlink: 'hello-world' },
    global: {
      plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
      components: { QBtn, QIcon: Stub, QSpinnerTail: Spinner }
    }
  })
}

async function openComposerAndVote (wrapper) {
  await wrapper.find('.vote-control__btn--up').trigger('click')
  await nextTick()
  await wrapper.find('.vote-control__confirm').trigger('click')
  await nextTick()
}

describe('vote control', () => {
  it('queues the vote and shows a pending state until the queue confirms it', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)

    expect(store.queue).toHaveLength(1)
    expect(wrapper.find('.vote-control__sent').exists()).toBe(true)
    expect(wrapper.find('.vote-control__sent--pending').exists()).toBe(true)
    expect(wrapper.find('.vote-control__sent-label').text()).toBe('Sending')
    expect(wrapper.find('.q-spinner-stub').exists()).toBe(true)

    // Auto-send broadcasts, then marks the item sent.
    store.setQueueStatus(0, 'broadcasting')
    await nextTick()
    expect(wrapper.find('.vote-control__sent--pending').exists()).toBe(true)

    store.setQueueStatus(0, 'sent')
    store.setQueueTxId(0, 'tx1234')
    await nextTick()

    expect(wrapper.find('.vote-control__sent--pending').exists()).toBe(false)
    expect(wrapper.find('.vote-control__sent--up').exists()).toBe(true)
    expect(wrapper.find('.vote-control__sent-label').text()).toBe('Voted')
    // The spinner must stop once the vote is confirmed.
    expect(wrapper.find('.q-spinner-stub').exists()).toBe(false)
    expect(wrapper.find('.vote-control__sent-dismiss').exists()).toBe(true)
  })

  it('stops spinning when the sent item is cleared from the queue', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)
    expect(wrapper.find('.q-spinner-stub').exists()).toBe(true)

    // The queue panel drops completed items after sending.
    store.clearCompletedQueue()
    store.queue.splice(0, store.queue.length)
    await nextTick()

    expect(wrapper.find('.q-spinner-stub').exists()).toBe(false)
    expect(wrapper.find('.vote-control__sent--up').exists()).toBe(true)
  })

  it('offers a retry instead of spinning forever when the vote fails', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)
    store.setQueueStatus(0, 'failed', 'Broadcast failed.')
    await nextTick()

    expect(wrapper.find('.q-spinner-stub').exists()).toBe(false)
    expect(wrapper.find('.vote-control__sent--failed').exists()).toBe(true)
    expect(wrapper.find('.vote-control__sent-label').text()).toBe('Vote failed')

    await wrapper.find('.vote-control__sent-retry').trigger('click')
    await nextTick()
    expect(store.queueMeta[0].status).toBe('pending')
    expect(wrapper.find('.q-spinner-stub').exists()).toBe(true)
  })

  it('always offers both upvote and downvote buttons', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    // No existing votes: the downvote must still be available.
    expect(wrapper.find('.vote-control__btn--up').exists()).toBe(true)
    expect(wrapper.find('.vote-control__btn--down').exists()).toBe(true)

    await wrapper.find('.vote-control__btn--down').trigger('click')
    await nextTick()
    expect(wrapper.find('.vote-control__composer').classes()).toContain('vote-control__composer--down')

    // Confirm: the queued vote is a negative weight.
    await wrapper.find('.vote-control__confirm').trigger('click')
    await nextTick()
    expect(store.queue[0][2][1].weight).toBe(-10000)
  })

  it('lets a voter change their vote after voting', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)
    store.setQueueStatus(0, 'sent')
    await nextTick()
    await wrapper.find('.vote-control__sent-dismiss').trigger('click')
    await nextTick()

    // The queued vote is now "mine", so the buttons stay clickable and open
    // the composer again rather than being disabled forever.
    const up = wrapper.find('.vote-control__btn--up')
    expect(up.element.disabled).toBe(false)
    await up.trigger('click')
    await nextTick()
    expect(wrapper.find('.vote-control__composer').exists()).toBe(true)
  })

  it('keeps the vote marked as cast after the status chip is dismissed', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)
    store.setQueueStatus(0, 'sent')
    await nextTick()
    await wrapper.find('.vote-control__sent-dismiss').trigger('click')
    await nextTick()

    // Post data may still lag behind the chain read; the control must not flip
    // back to the unvoted state in the meantime.
    const up = wrapper.find('.vote-control__btn--up')
    expect(up.classes()).toContain('is-active')
    expect(up.attributes('title')).toContain('adjust')
  })

  it('does not mark a failed vote as cast', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await openComposerAndVote(wrapper)
    store.setQueueStatus(0, 'failed', 'Broadcast failed.')
    await nextTick()
    await wrapper.find('.vote-control__sent-dismiss').trigger('click')
    await nextTick()

    expect(wrapper.find('.vote-control__btn--up').classes()).not.toContain('is-active')
  })

  it('starts a downvote from the downvote button and queues a negative weight', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await wrapper.find('.vote-control__btn--down').trigger('click')
    await nextTick()
    expect(wrapper.find('.vote-control__composer').classes()).toContain('vote-control__composer--down')
    expect(wrapper.find('.vote-control__composer-value').text()).toBe('100%')

    await wrapper.find('.vote-control__confirm').trigger('click')
    await nextTick()
    expect(store.queue[0][2][1].weight).toBe(-10000)
  })

  it('can be cancelled back to the buttons', async () => {
    setActivePinia(createPinia())
    const store = reactive(useHiveStore())
    const wrapper = mountVote(store)

    await wrapper.find('.vote-control__btn--down').trigger('click')
    await nextTick()
    await wrapper.find('.vote-control__cancel').trigger('click')
    await nextTick()

    expect(wrapper.find('.vote-control__composer').exists()).toBe(false)
    expect(store.queue).toHaveLength(0)
    expect(wrapper.find('.vote-control__btn--down').exists()).toBe(true)
  })
})
