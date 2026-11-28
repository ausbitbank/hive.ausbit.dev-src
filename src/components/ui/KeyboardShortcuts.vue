<template>
  <q-dialog v-model="open" aria-labelledby="shortcut-dialog-title">
    <q-card class="shortcuts-card">
      <q-card-section class="shortcuts-card__head">
        <div>
          <div class="home-eyebrow">Keyboard</div>
          <h2 id="shortcut-dialog-title" class="home-panel__title">Keyboard shortcuts</h2>
        </div>
        <q-btn flat round dense icon="close" aria-label="Close keyboard shortcuts" title="Close" @click="open = false" />
      </q-card-section>
      <q-separator />
      <div class="shortcuts-grid">
        <div v-for="shortcut in shortcuts" :key="shortcut.keys" class="shortcut-row">
          <kbd class="shortcut-keys">{{ shortcut.keys }}</kbd>
          <span>{{ shortcut.label }}</span>
        </div>
      </div>
      <q-card-section class="home-panel__footer">
        <span>Shortcuts are ignored while typing in a field.</span>
        <span>Press ? to reopen this list</span>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
const GO_TARGETS = {
  h: { label: 'Home', path: '/' },
  b: { label: 'Blocks', path: '/blocks' },
  w: { label: 'Witnesses', path: '/witnesses' },
  m: { label: 'Markets', path: '/markets' },
  p: { label: 'Proposals', path: '/proposals' },
  n: { label: 'API nodes', path: '/nodes' },
  s: { label: 'Network health', path: '/health' },
  c: { label: 'Write a post', path: '/compose' },
  l: { label: 'Lightning', path: '/lightning' }
}

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

export default {
  name: 'KeyboardShortcuts',
  data () {
    return {
      open: false,
      pendingG: 0,
      shortcuts: [
        { keys: 'Ctrl / ⌘ K', label: 'Open search and jump' },
        { keys: '/', label: 'Open search and jump' },
        { keys: 'f', label: 'Open the full search page' },
        { keys: 'g then h', label: 'Go home' },
        { keys: 'g then b', label: 'Go to blocks' },
        { keys: 'g then w', label: 'Go to witnesses' },
        { keys: 'g then m', label: 'Go to markets' },
        { keys: 'g then p', label: 'Go to proposals' },
        { keys: 'g then n', label: 'Go to API nodes' },
        { keys: 'g then s', label: 'Go to network health' },
        { keys: 'g then c', label: 'Write a post' },
        { keys: 'g then l', label: 'Go to Lightning' },
        { keys: 'Ctrl / ⌘ S', label: 'Save the current draft' },
        { keys: 'Ctrl / ⌘ ↵', label: 'Queue a post for signing' },
        { keys: 'Ctrl / ⌘ B', label: 'Bold (in the composer)' },
        { keys: 'Ctrl / ⌘ I', label: 'Italic (in the composer)' },
        { keys: 'Ctrl / ⌘ K', label: 'Insert a link (in the composer)' },
        { keys: '?', label: 'Show this shortcut list' }
      ]
    }
  },
  mounted () {
    window.addEventListener('keydown', this.onKeydown)
    window.addEventListener('hive:open-shortcuts', this.openShortcuts)
  },
  beforeUnmount () {
    window.removeEventListener('keydown', this.onKeydown)
    window.removeEventListener('hive:open-shortcuts', this.openShortcuts)
  },
  methods: {
    openShortcuts () {
      this.open = true
    },
    isTyping (event) {
      const target = event.target
      return target && (TYPING_TAGS.includes(target.tagName) || target.isContentEditable)
    },
    onKeydown (event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (this.isTyping(event)) return

      if (event.key === '?') {
        event.preventDefault()
        this.open = true
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        this.openPalette()
        return
      }
      if (event.key === 'f') {
        event.preventDefault()
        this.openSearch()
        return
      }
      if (event.key.toLowerCase() === 'g') {
        this.pendingG = Date.now()
        return
      }

      const key = event.key.toLowerCase()
      if (Date.now() - this.pendingG < 1200 && GO_TARGETS[key]) {
        event.preventDefault()
        this.pendingG = 0
        this.$router.push(GO_TARGETS[key].path).catch(() => {})
      }
    },
    openPalette () {
      window.dispatchEvent(new CustomEvent('hive:open-command-palette'))
    },
    openSearch () {
      this.$router.push('/search').catch(() => {})
    }
  }
}
</script>

<style scoped>
.shortcuts-card {
  width: 540px;
  max-width: 94vw;
  overflow: hidden;
  background: var(--c-surface-1);
}

.shortcuts-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.8rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 0.4rem 1rem;
  padding: 0.8rem 1rem;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.shortcut-keys {
  flex: none;
  min-width: 76px;
  padding: 0.12rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  color: var(--c-text);
  font-family: monospace;
  font-size: 0.68rem;
  text-align: center;
}
</style>
