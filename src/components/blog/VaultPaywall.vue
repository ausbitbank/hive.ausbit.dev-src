<template>
  <section class="banksia-locked" :class="{ 'banksia-locked--busy': busy }" aria-labelledby="banksia-locked-title">
    <p class="banksia-locked__eyebrow">
      <span class="banksia-locked__lock" aria-hidden="true">🔒</span>
      Members-only
    </p>

    <h2 id="banksia-locked-title" class="banksia-locked__title">{{ heading }}</h2>
    <p class="banksia-locked__lede">{{ lede }}</p>

    <p v-if="priceLabel" class="banksia-locked__price">
      <strong>{{ priceLabel }}</strong>
      <span v-if="usdEstimate" class="banksia-locked__usd">≈ {{ usdEstimate }} USD</span>
      <span class="banksia-locked__cadence">per month</span>
    </p>

    <ul v-if="benefits.length" class="banksia-locked__benefits">
      <li v-for="benefit in benefits" :key="benefit">
        <span class="banksia-locked__tick" aria-hidden="true">✓</span>
        {{ benefit }}
      </li>
    </ul>

    <p v-if="message" class="banksia-locked__status" role="status" aria-live="polite">{{ message }}</p>

    <div class="banksia-locked__actions">
      <button
        type="button"
        class="banksia-locked__button banksia-locked__button--primary"
        :disabled="busy || !plan"
        @click="$emit('subscribe')"
      >
        {{ primaryLabel }}
      </button>
      <button
        type="button"
        class="banksia-locked__button"
        :disabled="busy"
        @click="$emit('restore')"
      >
        Already a member? Restore access
      </button>
      <button
        v-if="showRetry"
        type="button"
        class="banksia-locked__button banksia-locked__button--quiet"
        :disabled="busy"
        @click="$emit('retry')"
      >
        Check again
      </button>
    </div>

    <p v-if="!plan && status === 'error'" class="banksia-locked__notice">
      The membership plan could not be loaded. Refresh to try again.
    </p>

    <p v-if="apexUrl" class="banksia-locked__notice">
      This blog is read-only. <a :href="apexUrl">Read on Banksia</a> to unlock with your membership.
    </p>

    <p class="banksia-locked__micro">
      <span>Cancel anytime</span>
      <span aria-hidden="true">·</span>
      <span>Powered by Hive</span>
    </p>
  </section>
</template>

<script>
const DEFAULT_BENEFITS = [
  'Every members-only post on this blog',
  'The full members-only archive'
]

export default {
  name: 'VaultPaywall',
  props: {
    plan: { type: Object, default: null },
    blog: { type: String, default: '' },
    metadata: { type: Object, default: null },
    status: { type: String, default: 'locked' },
    message: { type: String, default: '' },
    readerAccount: { type: String, default: '' },
    apexUrl: { type: String, default: '' }
  },
  emits: ['subscribe', 'restore', 'retry'],
  computed: {
    paywall () {
      return this.metadata && this.metadata.paywall ? this.metadata.paywall : null
    },
    heading () {
      const title = this.paywall && this.paywall.title
      if (title) return title
      if (this.plan && this.plan.title) return this.plan.title
      return 'Members-only'
    },
    lede () {
      const body = this.paywall && this.paywall.body
      if (body) return body
      return 'Read the rest of this post and the full members-only archive.'
    },
    benefits () {
      const listed = this.paywall && Array.isArray(this.paywall.benefits) ? this.paywall.benefits : []
      const cleaned = listed.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
      return cleaned.length ? cleaned : DEFAULT_BENEFITS
    },
    priceLabel () {
      if (!this.plan) return ''
      return this.plan.priceLabel || this.plan.amount || ''
    },
    usdEstimate () {
      const label = this.priceLabel
      if (!label || !/HBD$/i.test(label)) return ''
      const value = Number(String(label).replace(/[^0-9.]/g, ''))
      if (!Number.isFinite(value) || value <= 0) return ''
      // HBD is designed to track the US dollar; this is a display estimate, not
      // a quote, and the payment is always the on-chain HBD amount.
      return '$' + value.toFixed(2)
    },
    busy () {
      return this.status === 'checking' || this.status === 'unlocking'
    },
    showRetry () {
      return this.status === 'payment-pending' || this.status === 'error' || this.status === 'expired'
    },
    primaryLabel () {
      if (this.status === 'expired') return 'Renew membership'
      if (this.busy) return 'Unlocking…'
      return 'Subscribe'
    }
  }
}
</script>

<style scoped>
.banksia-locked {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 1.4rem 0;
  padding: 1.4rem 1.35rem;
  border: 1px solid var(--c-border);
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
  color: var(--c-text);
  overflow-wrap: anywhere;
}

.banksia-locked__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.4rem;
  color: var(--c-text-muted);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.banksia-locked__lock {
  font-size: 0.95rem;
  line-height: 1;
}

.banksia-locked__title {
  margin: 0 0 0.45rem;
  font-family: var(--font-display, inherit);
  font-size: clamp(1.2rem, 3vw, 1.55rem);
  line-height: 1.25;
}

.banksia-locked__lede {
  margin: 0 0 0.9rem;
  color: var(--c-text-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.banksia-locked__price {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.9rem;
  font-size: 1.2rem;
}

.banksia-locked__usd,
.banksia-locked__cadence {
  color: var(--c-text-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.banksia-locked__benefits {
  display: grid;
  gap: 0.35rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  color: var(--c-text-soft);
  font-size: 0.88rem;
  line-height: 1.45;
}

.banksia-locked__benefits li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.banksia-locked__tick {
  flex: none;
  color: var(--c-primary);
  font-weight: 700;
}

.banksia-locked__status {
  margin: 0 0 0.9rem;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c-primary) 9%, transparent);
  color: var(--c-text);
  font-size: 0.85rem;
  line-height: 1.45;
}

.banksia-locked__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.banksia-locked__button {
  min-height: 42px;
  padding: 0.6rem 1rem;
  border: 1px solid var(--c-border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--c-text);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.banksia-locked__button--primary {
  border-color: var(--c-primary);
  background: var(--c-primary);
  color: var(--c-on-primary);
}

.banksia-locked__button--quiet {
  border-color: transparent;
  color: var(--c-link);
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.banksia-locked__button:hover:not(:disabled) {
  filter: brightness(1.05);
}

.banksia-locked__button:focus-visible {
  outline: 2px solid var(--c-link);
  outline-offset: 2px;
}

.banksia-locked__button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.banksia-locked__notice {
  margin: 0.8rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.banksia-locked__notice a {
  color: var(--c-link);
}

.banksia-locked__micro {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 1rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

@media (prefers-reduced-motion: reduce) {
  .banksia-locked__button {
    transition: none;
  }
}

@media (max-width: 420px) {
  .banksia-locked {
    padding: 1.1rem 1rem;
  }

  .banksia-locked__actions {
    gap: 0.45rem;
  }
}
</style>
