<template>
  <q-dialog :model-value="modelValue" @update:model-value="onOpenChange">
    <q-card class="vault-subscribe">
      <q-card-section class="vault-subscribe__body">
        <p class="vault-subscribe__eyebrow">Membership</p>
        <h2 class="vault-subscribe__title">Subscribe to @{{ recipientLabel }}</h2>
        <p v-if="plan && plan.title" class="vault-subscribe__plan">{{ plan.title }}</p>

        <dl class="vault-subscribe__facts">
          <div>
            <dt>Amount</dt>
            <dd>{{ amountLabel }}<span v-if="!oneTime"> / month</span></dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd>@{{ recipientLabel }}</dd>
          </div>
          <div v-if="!oneTime">
            <dt>Renewal</dt>
            <dd>Every {{ recurrence }} hours (about 30 days)</dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>{{ oneTime ? 'One payment' : executions + ' monthly payments, then it stops' }}</dd>
          </div>
          <div v-if="!oneTime">
            <dt>Total</dt>
            <dd>Up to {{ totalLabel }}</dd>
          </div>
        </dl>

        <q-toggle
          v-model="oneTime"
          class="vault-subscribe__toggle"
          no-caps
          color="primary"
          label="Pay for one month instead"
          :disable="busy"
        />

        <p class="vault-subscribe__next-title">What happens next</p>
        <ol class="vault-subscribe__next">
          <li>Approve the HBD payment in your Hive wallet or Keychain.</li>
          <li>Return to this post. It unlocks when @{{ recipientLabel }} publishes your grant.</li>
          <li>If it is still locked, check again in a minute — the page polls for two minutes.</li>
        </ol>

        <label class="vault-subscribe__terms">
          <q-checkbox v-model="terms" color="primary" :disable="busy" />
          <span>
            I authorise {{ oneTime ? 'this payment' : 'these recurring HBD payments' }} to
            @{{ recipientLabel }}. I understand Hive payments are final, and I can cancel any
            time; access lasts until the paid period ends.
          </span>
        </label>

        <p class="vault-subscribe__micro">Cancel anytime · Powered by Hive</p>
        <p v-if="error" class="vault-subscribe__error" role="alert">{{ error }}</p>
      </q-card-section>

      <q-card-actions class="vault-subscribe__actions">
        <q-btn flat no-caps label="Cancel" :disable="busy" @click="close" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Approve payment"
          :loading="busy"
          :disable="!terms || !plan"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { useVaultStore } from 'src/stores/vault'
import {
  buildOneTimeTransferOperation,
  buildRecurrentTransferOperation,
  buildVaultMemo
} from 'src/services/vaultPayments'

function randomSubscriptionId () {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID().replaceAll('-', '')
    }
  } catch {
    // Fall through to random bytes.
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export default {
  name: 'VaultSubscribeDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    plan: { type: Object, default: null },
    blog: { type: String, default: '' },
    readerAccount: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'queued'],
  data () {
    return {
      terms: false,
      oneTime: false,
      busy: false,
      error: ''
    }
  },
  computed: {
    recipientLabel () {
      return String((this.plan && this.plan.author) || this.blog || '').trim().replace(/^@/, '').toLowerCase()
    },
    productRef () {
      if (!this.plan) return ''
      if (typeof this.plan.product === 'string' && this.plan.product.includes('/')) return this.plan.product
      if (this.plan.author && this.plan.permlink) return this.plan.author + '/' + this.plan.permlink
      return ''
    },
    amountLabel () {
      if (!this.plan) return ''
      return this.plan.priceLabel || this.plan.amount || ''
    },
    recurrence () {
      const value = Number(this.plan && this.plan.recurrence)
      return Number.isInteger(value) && value >= 24 ? value : 730
    },
    executions () {
      const value = Number(this.plan && this.plan.executions)
      return Number.isInteger(value) && value >= 2 ? value : 12
    },
    totalLabel () {
      const amount = Number(String(this.amountLabel).replace(/[^0-9.]/g, ''))
      if (!Number.isFinite(amount) || amount <= 0) return ''
      return (amount * this.executions).toFixed(3) + ' HBD'
    },
    accountName () {
      return String(this.readerAccount || (this.$hiveStore && this.$hiveStore.user && this.$hiveStore.user.username) || '')
        .trim()
        .replace(/^@/, '')
        .toLowerCase()
    }
  },
  watch: {
    modelValue (open) {
      if (open) {
        this.error = ''
        this.busy = false
      }
    }
  },
  methods: {
    onOpenChange (value) {
      this.$emit('update:modelValue', value)
    },
    close () {
      if (this.busy) return
      this.$emit('update:modelValue', false)
    },
    async confirm () {
      if (this.busy) return
      this.error = ''
      if (!this.terms) {
        this.error = 'Please accept the payment terms first.'
        return
      }
      if (!this.plan || !this.productRef) {
        this.error = 'The membership plan is not available. Refresh and try again.'
        return
      }
      if (!this.accountName) {
        this.error = 'Connect your Hive account to subscribe.'
        return
      }

      this.busy = true
      try {
        const blog = String(this.blog || this.plan.author || '').trim().replace(/^@/, '').toLowerCase()
        const store = useVaultStore()
        // The reader key is generated once per origin and reused for every
        // subscription here. Its private half never leaves the browser.
        const record = await store.ensureReaderKey(blog, { account: this.accountName })

        const memo = buildVaultMemo({
          product: this.productRef,
          plan: this.plan.plan || 'member',
          readerKey: record.publicKeyB64,
          sub: randomSubscriptionId()
        })
        if (!memo) throw new Error('The membership payment could not be prepared.')

        const operation = this.oneTime
          ? buildOneTimeTransferOperation({
              from: this.accountName,
              to: this.recipientLabel,
              amount: this.amountLabel,
              memo
            })
          : buildRecurrentTransferOperation({
              from: this.accountName,
              to: this.recipientLabel,
              amount: this.amountLabel,
              recurrence: this.recurrence,
              executions: this.executions,
              memo
            })
        if (!operation) throw new Error('The membership payment details are invalid.')

        // Queue only. The active key is used by the existing signing stack,
        // never here, and this component never broadcasts.
        this.$hiveStore.addToQueue([this.accountName, 'active', operation])
        if (this.$q && typeof this.$q.notify === 'function') {
          this.$q.notify({
            type: 'positive',
            message: 'Payment queued — approve it in your wallet, then return here to unlock.',
            timeout: 6000
          })
        }
        this.$emit('queued', record.publicKeyB64)
        this.terms = false
        this.$emit('update:modelValue', false)
      } catch (error) {
        this.error = error && error.message
          ? error.message
          : 'The membership payment could not be queued.'
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style scoped>
.vault-subscribe {
  width: min(540px, 94vw);
  max-width: 94vw;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--skin-radius-card, 12px);
  background: var(--c-surface);
  color: var(--c-text);
}

.vault-subscribe__body {
  padding: 1.3rem 1.35rem 0.6rem;
  overflow-wrap: anywhere;
}

.vault-subscribe__eyebrow {
  margin: 0 0 0.35rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.vault-subscribe__title {
  margin: 0 0 0.3rem;
  font-size: clamp(1.2rem, 3.4vw, 1.5rem);
  line-height: 1.25;
}

.vault-subscribe__plan {
  margin: 0 0 0.9rem;
  color: var(--c-text-muted);
  font-size: 0.88rem;
}

.vault-subscribe__facts {
  display: grid;
  gap: 0.4rem;
  margin: 0 0 0.9rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
  font-size: 0.85rem;
}

.vault-subscribe__facts > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 0.6rem;
}

.vault-subscribe__facts dt {
  color: var(--c-text-muted);
}

.vault-subscribe__facts dd {
  margin: 0;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.vault-subscribe__toggle {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
}

.vault-subscribe__next-title {
  margin: 0.4rem 0 0.35rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.vault-subscribe__next {
  margin: 0 0 0.9rem;
  padding-left: 1.1rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.vault-subscribe__terms {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin-bottom: 0.7rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
  cursor: pointer;
}

.vault-subscribe__micro {
  margin: 0 0 0.5rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.vault-subscribe__error {
  margin: 0.3rem 0 0.4rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  color: var(--c-negative);
  font-size: 0.82rem;
  line-height: 1.45;
}

.vault-subscribe__actions {
  justify-content: flex-end;
  gap: 0.4rem;
  padding: 0.5rem 1rem 1rem;
}

@media (max-width: 420px) {
  .vault-subscribe__body {
    padding: 1.1rem 1rem 0.5rem;
  }

  .vault-subscribe__facts > div {
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .vault-subscribe__actions {
    padding: 0.4rem 0.8rem 0.9rem;
  }
}
</style>
