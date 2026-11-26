import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QBtn, QIcon, Quasar } from 'quasar'
import ProfileSkin from '../../src/components/theme/ProfileSkin.vue'

const mocks = vi.hoisted(() => ({ store: null }))

vi.mock('../../src/services/moderationStoreLoader', () => ({
  loadModerationStore: () => Promise.resolve(mocks.store)
}))

const SKIN = {
  schema: 'hive.ausbit.dev/theme@1',
  scope: 'profile',
  id: 'test-skin',
  name: 'Test Skin',
  mood: 'A test skin',
  description: 'A test skin.',
  author: 'ausbitbank',
  remixedFrom: null,
  tags: ['dark', 'test'],
  mode: 'dark',
  tokens: {
    bg: '#070a18',
    surface: '#10152b',
    surfaceAlt: '#161d38',
    text: '#eef2ff',
    muted: '#9aa8d6',
    border: '#2a3560',
    primary: '#5ce1e6',
    secondary: '#ff5cc8',
    accent: '#a78bfa',
    positive: '#4ade80',
    negative: '#fb7185',
    warning: '#fbbf24',
    info: '#60a5fa'
  },
  type: { body: 'sans', display: 'grotesk', mono: 'mono' },
  shape: { radius: 'soft', border: 'hairline', shadow: 'glow' },
  effects: { texture: 'grid', motion: 'none', ambient: 'none' },
  profile: {
    background: 'mesh',
    avatarFrame: 'ring',
    nameplate: 'gradient',
    card: 'glass',
    ticker: '',
    stickers: [],
    atmosphere: { source: 'cover', treatment: 'duotone', intensity: 'medium' },
    visual: { link: 'glow', button: 'pill', chip: 'stamp', divider: 'hex', image: 'rounded', gradient: 'diagonal' },
    banner: null
  }
}

const SafetyNoticeStub = {
  name: 'SkinSafetyNotice',
  props: {
    decision: { type: Object, required: true },
    preview: Boolean,
    hasModeration: Boolean,
    canFollowOverride: Boolean
  },
  emits: ['preview', 'show', 'enable-followed'],
  template: '<section class="skin-blocked">{{ decision.label }}</section>'
}

function allowedDecision () {
  return { allowed: true, code: 'allowed', label: '', detail: '', owners: [], overrides: [] }
}

function blockedDecision (code = 'personal-mute') {
  return {
    allowed: false,
    code,
    label: code === 'personal-mute'
      ? 'Skin hidden: you mute @alice'
      : 'Skin hidden: moderation lists could not be checked',
    detail: '',
    owners: [],
    overrides: ['show-author', 'manage']
  }
}

function appearance (overrides = {}) {
  return {
    skinCalm: false,
    isDark: true,
    highContrast: false,
    ignoredSkinAuthors: [],
    profileSkins: 'on',
    ignoreSkinAuthor: vi.fn(),
    setProfileSkins: vi.fn(),
    ...overrides
  }
}

function moderation (decision, overrides = {}) {
  return {
    context: { status: 'ready' },
    decisionForSkin: vi.fn(() => decision()),
    skinSettings: {
      blockMuted: true,
      blockNegativeReputation: true,
      followedMuteListOverride: true,
      followedReputationOverride: false
    },
    isFollowing: vi.fn(() => false),
    setScope: vi.fn(),
    ensureContext: vi.fn(() => Promise.resolve()),
    showSkinAuthor: vi.fn(),
    setSkinSetting: vi.fn(),
    clearSkinOverride: vi.fn(),
    ...overrides
  }
}

async function mountSkin ({ props = {}, decision = allowedDecision, appearance: appearanceOverrides, moderation: moderationOverrides } = {}) {
  const moderationStore = moderation(decision, moderationOverrides)
  mocks.store = moderationStore
  const wrapper = mount(ProfileSkin, {
    props: {
      previewTheme: SKIN,
      author: 'alice',
      context: 'profile',
      ...props
    },
    global: {
      plugins: [[Quasar, {}]],
      components: { QBtn, QIcon },
      mocks: {
        $appearance: appearance(appearanceOverrides),
        $hiveStore: { user: { username: 'viewer' } },
        $q: { notify: vi.fn() }
      },
      stubs: {
        Atmosphere: true,
        SkinSafetyNotice: SafetyNoticeStub
      }
    },
    slots: {
      default: '<div class="slot-content">Profile content</div>'
    }
  })
  await flushPromises()
  return { wrapper, moderationStore }
}

describe('ProfileSkin safety gate', () => {
  it('renders the explanation and keeps the page content when a skin is blocked', async () => {
    const { wrapper } = await mountSkin({ decision: () => blockedDecision() })
    expect(wrapper.find('.skin-scope').exists()).toBe(false)
    expect(wrapper.find('.skin-blocked').exists()).toBe(true)
    expect(wrapper.text()).toContain('Skin hidden: you mute @alice')
    expect(wrapper.find('.slot-content').exists()).toBe(true)
  })

  it('lets a Studio preview render after an explicit preview override', async () => {
    const { wrapper } = await mountSkin({ decision: () => blockedDecision('context-unavailable') })
    expect(wrapper.find('.skin-scope').exists()).toBe(false)

    const notice = wrapper.findComponent(SafetyNoticeStub)
    expect(notice.exists()).toBe(true)
    notice.vm.$emit('preview')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.skin-scope').exists()).toBe(true)
  })

  it('asks the store to show a blocked author and notifies', async () => {
    const account = {
      name: 'alice',
      reputation: 60,
      posting_json_metadata: JSON.stringify({ 'hive.ausbit.dev': { theme: SKIN } })
    }
    const { wrapper, moderationStore } = await mountSkin({
      props: { previewTheme: null, account, author: 'alice' },
      decision: () => blockedDecision()
    })
    const notice = wrapper.findComponent(SafetyNoticeStub)
    expect(notice.exists()).toBe(true)
    notice.vm.$emit('show')
    await wrapper.vm.$nextTick()
    expect(moderationStore.showSkinAuthor).toHaveBeenCalledWith('alice')
  })

  it('renders a clean skin and links the owning account', async () => {
    const account = {
      name: 'alice',
      reputation: 60,
      posting_json_metadata: JSON.stringify({ 'hive.ausbit.dev': { theme: SKIN } })
    }
    const { wrapper } = await mountSkin({
      props: { previewTheme: null, account, author: 'alice' }
    })
    expect(wrapper.find('.skin-scope').exists()).toBe(true)
    expect(wrapper.text()).toContain('Skin by')
    expect(wrapper.text()).toContain('@alice')
  })

  it('warns when the theme credits a different account but keeps the owner authoritative', async () => {
    const account = {
      name: 'alice',
      reputation: 60,
      posting_json_metadata: JSON.stringify({ 'hive.ausbit.dev': { theme: SKIN } })
    }
    const { wrapper } = await mountSkin({
      props: { previewTheme: null, account, author: 'alice' }
    })
    expect(wrapper.find('.skin-badge__note--warning').text()).toContain('@ausbitbank')
    expect(wrapper.text()).toContain('@alice')
  })

  it('stays silent when the viewer explicitly ignored this skin', async () => {
    const account = {
      name: 'alice',
      reputation: 60,
      posting_json_metadata: JSON.stringify({ 'hive.ausbit.dev': { theme: SKIN } })
    }
    const { wrapper } = await mountSkin({
      props: { previewTheme: null, account, author: 'alice' },
      appearance: { ignoredSkinAuthors: ['alice'] }
    })
    expect(wrapper.find('.skin-scope').exists()).toBe(false)
    expect(wrapper.find('.skin-blocked').exists()).toBe(false)
    expect(wrapper.find('.slot-content').exists()).toBe(true)
  })

  it('keeps an explicit preview override while the same skin is edited', async () => {
    const { wrapper } = await mountSkin({ decision: () => blockedDecision('context-unavailable') })
    expect(wrapper.find('.skin-scope').exists()).toBe(false)

    wrapper.findComponent(SafetyNoticeStub).vm.$emit('preview')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.skin-scope').exists()).toBe(true)

    // The Studio validates into a fresh object on every keystroke. That must
    // not count as previewing a different skin.
    await wrapper.setProps({ previewTheme: { ...SKIN, mood: 'Edited mood' } })
    expect(wrapper.find('.skin-scope').exists()).toBe(true)

    // A genuinely different skin asks for the override again.
    await wrapper.setProps({ previewTheme: { ...SKIN, id: 'another-skin' } })
    expect(wrapper.find('.skin-scope').exists()).toBe(false)
    expect(wrapper.find('.skin-blocked').exists()).toBe(true)
  })

  it('can force the variant shown in the preview', async () => {
    const lightTokens = { ...SKIN.tokens, bg: '#faf7f2', surface: '#ffffff', text: '#1a1a1a', muted: '#4a4a4a' }
    const skin = {
      ...SKIN,
      variants: {
        dark: { tokens: { ...SKIN.tokens, bg: '#010203' } },
        light: { tokens: lightTokens }
      }
    }
    const { wrapper } = await mountSkin({ props: { previewTheme: skin, previewMode: 'light' } })
    expect(wrapper.find('.skin-scope').attributes('style')).toContain('--c-bg: #faf7f2')

    await wrapper.setProps({ previewMode: 'dark' })
    expect(wrapper.find('.skin-scope').attributes('style')).toContain('--c-bg: #010203')
  })
})
