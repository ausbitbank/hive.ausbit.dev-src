<template>
  <section
    class="banksia-locked"
    :class="{ 'banksia-locked--busy': busy }"
    aria-labelledby="banksia-locked-title"
    :aria-busy="busy ? 'true' : 'false'"
  >
    <p class="banksia-locked__eyebrow">
      <span class="banksia-locked__lock" aria-hidden="true">🔒</span>
      Members-only
    </p>

    <div v-if="authorName" class="banksia-locked__author">
      <img :src="authorAvatar" alt="" class="banksia-locked__avatar" width="32" height="32" />
      <span>By <strong>@{{ authorName }}</strong></span>
    </div>

    <h2 id="banksia-locked-title" class="banksia-locked__title">{{ heading }}</h2>
    <p class="banksia-locked__lede">{{ lede }}</p>

    <div class="banksia-locked__offer">
      <p v-if="priceLabel" class="banksia-locked__price">
        <strong>{{ priceLabel }}</strong>
        <span v-if="usdEstimate" class="banksia-locked__usd">≈ {{ usdEstimate }} USD</span>
        <span class="banksia-locked__cadence">{{ cadenceLabel }}</span>
      </p>

      <p class="banksia-locked__benefits-title">Membership includes</p>
      <ul v-if="benefits.length" class="banksia-locked__benefits">
        <li v-for="benefit in benefits" :key="benefit">
          <span class="banksia-locked__tick" aria-hidden="true">✓</span>
          {{ benefit }}
        </li>
      </ul>
    </div>

    <p v-if="message" class="banksia-locked__status" role="status" aria-live="polite">{{ message }}</p>

    <div class="banksia-locked__actions">
      <a
        v-if="apexUrl"
        :href="apexUrl"
        class="banksia-locked__button banksia-locked__button--primary"
      >
        {{ apexLabel }}
      </a>
      <template v-else>
        <button
          type="button"
          class="banksia-locked__button banksia-locked__button--primary"
          :disabled="busy || !plan"
          @click="$emit('subscribe')"
        >
          {{ primaryLabel }}
        </button>
        <div class="banksia-locked__helper">
          <span>Already a member?</span>
          <button
            type="button"
            class="banksia-locked__button banksia-locked__button--link"
            :disabled="busy"
            @click="$emit('restore')"
          >
            Restore access
          </button>
          <template v-if="readerAccount">
            <span aria-hidden="true">·</span>
            <button
              type="button"
              class="banksia-locked__button banksia-locked__button--link"
              :disabled="busy || !plan"
              @click="$emit('use-device')"
            >
              Use this device
            </button>
          </template>
        </div>
        <button
          v-if="showRetry"
          type="button"
          class="banksia-locked__button banksia-locked__button--quiet"
          :disabled="busy"
          @click="$emit('retry')"
        >
          Check again
        </button>
      </template>
    </div>

    <p v-if="!plan && status === 'error' && !apexUrl" class="banksia-locked__notice">
      The membership plan could not be loaded. Refresh to try again.
    </p>

    <p v-if="apexUrl" class="banksia-locked__notice">
      This blog is read-only. Your membership unlocks this post on Banksia.
    </p>

    <p class="banksia-locked__micro">
      <span v-if="priceLabel">Cancel anytime</span>
      <span v-if="priceLabel" aria-hidden="true">·</span>
      <span>Secure keys stay on your device</span>
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

function recurrencePhrase (hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return 'per month'
  if (value === 24) return 'per day'
  if (value === 48) return 'every 2 days'
  if (value === 168) return 'per week'
  if (value === 720 || value === 730 || value === 744) return 'per month'
  if (value === 8760) return 'per year'
  if (value % 24 === 0) return 'every ' + (value / 24) + ' days'
  return 'every ' + value + ' hours'
}

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
  emits: ['subscribe', 'use-device', 'restore', 'retry'],
  computed: {
    paywall () {
      return this.metadata && this.metadata.paywall ? this.metadata.paywall : null
    },
    authorName () {
      if (this.plan && this.plan.author) return this.plan.author
      return String(this.blog || '').trim().replace(/^@/, '')
    },
    authorAvatar () {
      return this.authorName
        ? 'https://images.hive.blog/u/' + this.authorName + '/avatar'
        : ''
    },
    heading () {
      const title = this.paywall && this.paywall.title
      if (title) return title
      if (this.plan && this.plan.title) return this.plan.title
      return 'Read the rest of this post'
    },
    lede () {
      const body = this.paywall && this.paywall.body
      if (body) return body
      if (this.authorName) {
        return 'Support @' + this.authorName + ' and read every members-only post, including the full archive.'
      }
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
    cadenceLabel () {
      if (!this.plan) return 'per period'
      return recurrencePhrase(this.plan.recurrence)
    },
    busy () {
      return this.status === 'checking' || this.status === 'unlocking'
    },
    showRetry () {
      return this.status === 'payment-pending' || this.status === 'error' || this.status === 'expired'
    },
    apexLabel () {
      return this.status === 'expired' ? 'Renew on Banksia' : 'Read on Banksia'
    },
    primaryLabel () {
      if (this.status === 'expired') return 'Renew membership'
      if (this.status === 'device-pending') return 'Subscribe instead'
      if (this.busy) return 'Unlocking…'
      if (this.plan && this.priceLabel) {
        return 'Join for ' + this.priceLabel + ' ' + this.cadenceLabel
      }
      return 'Join membership'
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
  padding: 1.5rem 1.45rem;
  border: 1px solid color-mix(in srgb, var(--c-primary) 24%, var(--c-border));
  border-radius: var(--skin-radius-card, 12px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--c-primary) 7%, var(--c-surface)), var(--c-surface) 62%);
  color: var(--c-text);
  overflow-wrap: anywhere;
}

.banksia-locked__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.banksia-locked__lock {
  font-size: 0.95rem;
  line-height: 1;
}

.banksia-locked__author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.7rem;
  color: var(--c-text-muted);
  font-size: 0.84rem;
}

.banksia-locked__author strong {
  color: var(--c-text);
  font-weight: 600;
}

.banksia-locked__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
}

.banksia-locked__title {
  margin: 0 0 0.45rem;
  font-family: var(--font-display, inherit);
  font-size: clamp(1.25rem, 3vw, 1.6rem);
  line-height: 1.25;
}

.banksia-locked__lede {
  margin: 0 0 1rem;
  color: var(--c-text-muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.banksia-locked__offer {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--c-border);
  border-radius: calc(var(--skin-radius-card, 12px) - 4px);
  background: color-mix(in srgb, var(--c-surface) 82%, transparent);
}

.banksia-locked__price {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.7rem;
  font-size: 1.35rem;
}

.banksia-locked__usd,
.banksia-locked__cadence {
  color: var(--c-text-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.banksia-locked__benefits-title {
  margin: 0 0 0.4rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.banksia-locked__benefits {
  display: grid;
  gap: 0.35rem;
  margin: 0;
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
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
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

/* Blog post styles set a broad `a` colour; raise the primary button above them
   so the label always contrasts with the filled background. */
.banksia-locked .banksia-locked__actions .banksia-locked__button--primary {
  color: var(--c-on-primary);
  text-decoration: none;
}

.banksia-locked__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.65rem 1rem;
  border: 1px solid var(--c-border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--c-text);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
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
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.banksia-locked__button--link {
  min-height: auto;
  padding: 0.15rem 0.2rem;
  border-color: transparent;
  color: var(--c-link);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.banksia-locked__helper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.15rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.banksia-locked__helper .banksia-locked__button {
  font-size: 0.8rem;
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
    padding: 1.15rem 1rem;
  }

  .banksia-locked__offer {
    padding: 0.8rem;
  }

  .banksia-locked__actions {
    gap: 0.45rem;
  }
}
</style>
