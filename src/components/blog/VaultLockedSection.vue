<template>
  <section v-if="isUnlocked" class="banksia-unlocked" aria-live="polite">
    <p class="banksia-unlocked__announce" role="status">Members-only content unlocked.</p>

    <div class="banksia-unlocked__meta">
      <span class="banksia-unlocked__badge">Member</span>
      <span v-if="watermark" class="banksia-unlocked__watermark">{{ watermark }}</span>
    </div>

    <render :input="plaintext" class="postbody banksia-unlocked__body" />

    <p v-if="watermark" class="banksia-unlocked__watermark banksia-unlocked__watermark--foot">
      {{ watermark }}
    </p>
  </section>

  <VaultPaywall
    v-else
    :plan="plan"
    :blog="blog"
    :metadata="metadata"
    :status="state.status"
    :message="state.message"
    :reader-account="readerAccount"
    :apex-url="apexUrl"
    @subscribe="$emit('subscribe')"
    @use-device="$emit('use-device')"
    @restore="$emit('restore')"
    @retry="$emit('retry')"
  />
</template>

<script>
import Render from 'components/render.vue'
import VaultPaywall from './VaultPaywall.vue'
import { watermarkLabel } from 'src/services/vaultUnlock'

export default {
  name: 'VaultLockedSection',
  components: { Render, VaultPaywall },
  props: {
    metadata: { type: Object, default: null },
    plaintext: { type: String, default: '' },
    state: {
      type: Object,
      default: () => ({ status: 'locked', message: '' })
    },
    plan: { type: Object, default: null },
    blog: { type: String, default: '' },
    readerAccount: { type: String, default: '' },
    apexUrl: { type: String, default: '' }
  },
  emits: ['subscribe', 'use-device', 'restore', 'retry'],
  computed: {
    isUnlocked () {
      return Boolean(this.state && this.state.status === 'unlocked' && this.plaintext)
    },
    watermark () {
      if (!this.isUnlocked) return ''
      const label = this.state.reader && this.state.reader.label
      if (label) return label
      return watermarkLabel(this.readerAccount, this.state.period)
    }
  }
}
</script>

<style scoped>
.banksia-unlocked {
  margin: 1.4rem 0;
}

.banksia-unlocked__announce {
  margin: 0 0 0.7rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--c-primary) 9%, transparent);
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.banksia-unlocked__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.banksia-unlocked__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.16rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 40%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  color: var(--c-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.banksia-unlocked__watermark {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.banksia-unlocked__watermark--foot {
  margin: 1.2rem 0 0;
  padding-top: 0.6rem;
  border-top: 1px solid var(--c-border);
}

.banksia-unlocked__body {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 420px) {
  .banksia-unlocked__meta {
    gap: 0.35rem;
  }
}
</style>
