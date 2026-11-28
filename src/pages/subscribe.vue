<template>
  <q-page class="subscribe-page">
    <div class="subscribe-shell">
      <nav class="subscribe-crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <span>Membership</span>
      </nav>

      <q-card v-if="loading" flat bordered class="subscribe-card" aria-busy="true" aria-label="Loading membership">
        <q-card-section>
          <q-skeleton type="rect" height="28px" width="50%" />
          <q-skeleton type="rect" height="14px" class="q-mt-md" />
          <q-skeleton type="rect" height="14px" width="65%" class="q-mt-sm" />
        </q-card-section>
      </q-card>

      <q-card v-else-if="error" flat bordered class="subscribe-card">
        <q-card-section>
          <h1 class="subscribe-title">Membership unavailable</h1>
          <p class="subscribe-muted">{{ error }}</p>
          <div class="subscribe-actions">
            <q-btn v-if="blog" outline no-caps color="primary" :label="'Back to @' + blog" :to="'/@' + blog" />
            <q-btn flat no-caps label="Browse blogs" to="/blogs" />
          </div>
        </q-card-section>
      </q-card>

      <template v-else-if="plan">
        <header class="subscribe-head">
          <p class="subscribe-kicker">Membership</p>
          <div class="subscribe-author">
            <img :src="authorAvatar" alt="" class="subscribe-author__avatar" width="36" height="36" />
            <span>Supporting <strong>@{{ plan.author }}</strong></span>
          </div>
          <h1 class="subscribe-title">{{ plan.title || 'Membership' }}</h1>
          <p class="subscribe-muted subscribe-lede">{{ displayDescription }}</p>
        </header>

        <q-card flat bordered class="subscribe-card">
          <q-card-section>
            <div class="subscribe-plan">
              <div>
                <p class="subscribe-price">{{ plan.priceLabel }}</p>
                <p class="subscribe-muted">
                  Billed {{ recurrencePhrase }} · {{ plan.executions }} payments in total.
                </p>
              </div>
              <span class="subscribe-badge">Membership</span>
            </div>

            <p class="subscribe-includes">What you get</p>
            <ul class="subscribe-benefits">
              <li v-for="benefit in displayBenefits" :key="benefit">
                <q-icon name="check_circle" size="16px" aria-hidden="true" />
                <span>{{ benefit }}</span>
              </li>
            </ul>

            <div class="subscribe-next">
              <p class="subscribe-label">How it works</p>
              <ol class="subscribe-steps">
                <li>Approve the payment in your Hive wallet or signing queue.</li>
                <li>@{{ plan.author }} confirms it and issues your access.</li>
                <li>Your post unlocks here automatically when it arrives.</li>
              </ol>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="subscribe-card">
          <q-card-section>
            <h2 class="subscribe-subtitle">Choose how to pay</h2>

            <div class="subscribe-modes" role="radiogroup" aria-labelledby="subscribe-mode-label">
              <p id="subscribe-mode-label" class="subscribe-label">Payment</p>
              <label
                v-for="mode in paymentModes"
                :key="mode.value"
                class="subscribe-mode"
                :class="{ 'subscribe-mode--active': paymentMode === mode.value }"
              >
                <input
                  v-model="paymentMode"
                  type="radio"
                  name="vault-payment-mode"
                  :value="mode.value"
                />
                <span class="subscribe-mode__copy">
                  <strong>{{ mode.label }}</strong>
                  <span>{{ mode.caption }}</span>
                </span>
                <span class="subscribe-mode__price">{{ plan.priceLabel }}</span>
              </label>
            </div>

            <q-banner rounded class="subscribe-note">
              <template #avatar><q-icon name="info" /></template>
              You pay @{{ plan.author }} directly. Banksia takes no fee and never
              holds your money. Hive payments cannot be reversed.
            </q-banner>

            <q-banner v-if="!loggedInUser" rounded class="subscribe-note subscribe-note--warning">
              <template #avatar><q-icon name="login" /></template>
              Sign in from the top bar to continue.
            </q-banner>

            <q-banner v-if="keyError" rounded class="subscribe-note subscribe-note--warning">
              <template #avatar><q-icon name="key_off" /></template>
              {{ keyError }}
            </q-banner>

            <label class="subscribe-terms">
              <q-checkbox
                v-model="accepted"
                color="primary"
                aria-label="I understand the payment terms"
              />
              <span>{{ termsText }}</span>
            </label>

            <div class="subscribe-actions">
              <q-btn
                unelevated
                no-caps
                color="primary"
                :label="payButtonLabel"
                :disable="!canSubscribe || queued"
                @click="pay"
              />
              <q-btn flat no-caps :label="'About @' + plan.author + '’s membership'" :to="productPath" />
            </div>

            <p v-if="operationError" class="subscribe-error" role="alert">{{ operationError }}</p>

            <details class="subscribe-details">
              <summary>Payment details</summary>
              <dl>
                <div><dt>Paid to</dt><dd>@{{ plan.author }}</dd></div>
                <div><dt>Amount</dt><dd>{{ plan.priceLabel }}</dd></div>
                <div><dt>Schedule</dt><dd>{{ paymentMode === 'once' ? 'One payment' : plan.executions + ' payments, ' + recurrencePhrase }}</dd></div>
                <div v-if="memoPreview"><dt>Memo</dt><dd><code>{{ memoPreview }}</code></dd></div>
              </dl>
            </details>
          </q-card-section>
        </q-card>

        <q-card v-if="queued" flat bordered class="subscribe-card subscribe-status" aria-live="polite">
          <q-card-section>
            <h2 class="subscribe-subtitle">
              {{ granted ? 'You’re in — access granted' : 'Payment added to your signing queue' }}
            </h2>
            <p class="subscribe-muted">
              <template v-if="granted">
                Your membership is active. Return to the post; it will unlock automatically.
              </template>
              <template v-else>
                Approve the payment in your wallet or the signing queue (the clock icon at
                the top of the page). This page checks for up to two minutes.
              </template>
            </p>
            <p v-if="pollError" class="subscribe-error" role="alert">{{ pollError }}</p>
            <div class="subscribe-actions">
              <q-btn
                v-if="granted"
                unelevated
                no-caps
                color="primary"
                label="Back to the blog post"
                :to="returnPath"
              />
              <q-btn v-else flat no-caps label="Check again" :loading="checking" @click="checkBulletin" />
              <q-btn flat no-caps label="Manage subscriptions" to="/subscriptions" />
            </div>
          </q-card-section>
        </q-card>

        <p class="subscribe-restore">
          Already paid? <router-link to="/subscriptions">Restore access and manage this membership</router-link>.
        </p>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.subscribe-page {
  background: var(--c-bg);
}

.subscribe-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.subscribe-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.subscribe-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.subscribe-head {
  margin-bottom: 1.1rem;
}

.subscribe-kicker {
  margin: 0 0 0.45rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.subscribe-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.subscribe-author strong {
  color: var(--c-text);
}

.subscribe-author__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
}

.subscribe-title {
  margin: 0;
  font-size: clamp(1.55rem, 3vw, 2.1rem);
  line-height: 1.18;
}

.subscribe-lede {
  max-width: 58ch;
}

.subscribe-subtitle {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
}

.subscribe-muted {
  margin: 0.4rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.subscribe-muted a {
  color: var(--c-link);
}

.subscribe-card {
  background: var(--c-surface);
  border-color: var(--c-border);
  margin-bottom: 1rem;
}

.subscribe-status {
  border-color: var(--c-positive);
}

.subscribe-plan {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.subscribe-price {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
}

.subscribe-badge {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.subscribe-includes {
  margin: 1.2rem 0 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.subscribe-benefits {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--c-text);
  font-size: 0.9rem;
  line-height: 1.5;
}

.subscribe-benefits li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.subscribe-benefits .q-icon {
  flex: none;
  margin-top: 0.12rem;
  color: var(--c-primary);
}

.subscribe-next {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--c-border-subtle);
}

.subscribe-label {
  margin: 0 0 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.subscribe-steps {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--c-text-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.subscribe-modes {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.subscribe-mode {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface-2);
  cursor: pointer;
}

.subscribe-mode--active {
  border-color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 8%, var(--c-surface));
}

.subscribe-mode input {
  flex: none;
  accent-color: var(--c-primary);
}

.subscribe-mode__copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  font-size: 0.86rem;
}

.subscribe-mode__copy strong {
  font-weight: 600;
}

.subscribe-mode__copy span {
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.subscribe-mode__price {
  margin-left: auto;
  flex: none;
  font-size: 0.86rem;
  font-weight: 600;
}

.subscribe-note {
  margin-top: 1rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.subscribe-note--warning {
  border-color: var(--c-warning);
}

.subscribe-terms {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  margin-top: 0.9rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.subscribe-terms a {
  color: var(--c-link);
}

.subscribe-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.subscribe-error {
  margin: 0.8rem 0 0;
  color: var(--c-warning);
  font-size: 0.84rem;
}

.subscribe-details {
  margin-top: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.subscribe-details summary {
  cursor: pointer;
  color: var(--c-link);
}

.subscribe-details dl {
  display: grid;
  gap: 0.4rem;
  margin: 0.7rem 0 0;
}

.subscribe-details dl > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.subscribe-details dt {
  flex: none;
}

.subscribe-details dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.subscribe-details code {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: var(--c-surface-2);
  color: var(--c-text);
  font-size: 0.74rem;
}

.subscribe-restore {
  margin-top: 1.2rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.subscribe-restore a {
  color: var(--c-link);
}

@media (max-width: 599px) {
  .subscribe-plan {
    flex-direction: column;
    gap: 0.4rem;
  }

  .subscribe-mode__price {
    display: none;
  }

  .subscribe-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchPostContent } from 'src/services/chainData'
import { isValidHiveAccountName } from 'src/services/blogHost'
import { parseProductRef } from 'src/services/shopOrders'
import { deriveVaultPlan, parseVaultProduct } from 'src/services/vaultProduct'
import {
  buildOneTimeTransferOperation,
  buildRecurrentTransferOperation,
  buildVaultMemo,
  vaultRecurrenceLabel,
  vaultRecurrencePhrase
} from 'src/services/vaultPayments'
import { base64UrlEncode, randomBytes, readerKeyThumbprint } from 'src/services/vaultCrypto'
import { bulletinFromReplies } from 'src/services/vaultBulletin'
import { hive } from 'src/services/hive'

const POLL_INTERVAL_MS = 8000
const POLL_WINDOW_MS = 2 * 60 * 1000
const PERMLINK_RE = /^[a-z0-9][a-z0-9._-]{0,255}$/
const RETURN_BASE = 'https://banksia.invalid'

// The reader-key module is owned by the reader agent. `import.meta.glob` keeps
// this page buildable before that file lands, and loads it automatically once
// it exists.
const READER_KEY_MODULES = import.meta.glob('../services/vaultReaderKey.js')
const UNLOCK_MODULES = import.meta.glob('../services/vaultUnlock.js')

async function loadOptionalModule (modules, path) {
  const loader = modules[path]
  return loader ? loader() : null
}

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

/**
 * Only allow a same-origin path back to the post the reader came from. Absolute
 * URLs, protocol-relative URLs and the subscribe page itself are rejected.
 */
export function safeReturnPath (value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || !text.startsWith('/') || text.startsWith('//')) return ''
  try {
    const url = new URL(text, RETURN_BASE)
    if (url.origin !== RETURN_BASE) return ''
    if (url.pathname === '/subscribe' || url.pathname.startsWith('/subscribe/')) return ''
    return url.pathname + url.search + url.hash
  } catch {
    return ''
  }
}

/**
 * Validate `/subscribe` query parameters.
 *
 * The blog account is the payment recipient. A product reference must belong to
 * that blog. Price, amount, recurrence and recipient query parameters are
 * deliberately ignored: the product post is the only source of truth.
 */
export function parseSubscribeQuery (query = {}) {
  const blog = normalizeAccount(query && query.blog)
  const returnTo = safeReturnPath(query && query.redirect)
  if (!isValidHiveAccountName(blog)) {
    return {
      ok: false,
      blog: '',
      product: null,
      label: '',
      returnTo,
      error: 'The blog account in the link is missing or invalid.'
    }
  }
  const raw = query && query.product !== undefined && query.product !== null && String(query.product).trim()
    ? String(query.product)
    : blog + '/membership'
  const ref = parseProductRef(raw)
  if (!ref || !PERMLINK_RE.test(ref.permlink)) {
    return {
      ok: false,
      blog,
      product: null,
      label: '',
      returnTo,
      error: 'The product reference in the link is invalid.'
    }
  }
  if (ref.author !== blog) {
    return {
      ok: false,
      blog,
      product: null,
      label: '',
      returnTo,
      error: 'The product does not belong to @' + blog + '.'
    }
  }
  return {
    ok: true,
    blog,
    product: ref,
    label: ref.author + '/' + ref.permlink,
    returnTo,
    error: ''
  }
}

/**
 * Derive the payment plan from the on-chain product post. Query and blog
 * settings never contribute an amount, currency or recurrence.
 */
export function subscribePlanFromPost (post, { blog } = {}) {
  const owner = normalizeAccount(blog)
  if (!isValidHiveAccountName(owner)) {
    return { ok: false, plan: null, error: 'The blog account is invalid.' }
  }
  const product = parseVaultProduct(post)
  if (!product) {
    return { ok: false, plan: null, error: 'That post is not a Vault membership product.' }
  }
  if (product.author !== owner) {
    return { ok: false, plan: null, error: 'The product does not belong to @' + owner + '.' }
  }
  if (product.status !== 1) {
    return { ok: false, plan: null, error: 'This membership is not currently available.' }
  }
  const derived = deriveVaultPlan(post, { fallback: { plan: product.plan } })
  if (!derived || derived.author !== owner) {
    return { ok: false, plan: null, error: 'The membership plan could not be read from the product post.' }
  }
  return {
    ok: true,
    plan: { ...derived, product: derived.author + '/' + derived.permlink },
    error: ''
  }
}

/** Build the memo and the exact active-key operation for a subscription. */
export function buildSubscribeOperation ({ user, plan, readerKey, sub, oneTime = false } = {}) {
  const from = normalizeAccount(user)
  if (!isValidHiveAccountName(from) || !plan || !plan.author) return null
  const product = plan.product || plan.author + '/' + plan.permlink
  const memo = buildVaultMemo({
    product,
    plan: plan.plan || 'member',
    readerKey,
    sub
  })
  if (!memo) return null
  const operation = oneTime
    ? buildOneTimeTransferOperation({
        from,
        to: plan.author,
        amount: plan.priceLabel || plan.amount,
        memo
      })
    : buildRecurrentTransferOperation({
        from,
        to: plan.author,
        amount: plan.priceLabel || plan.amount,
        recurrence: plan.recurrence,
        executions: plan.executions,
        memo
      })
  return operation ? { memo, operation } : null
}

export function newSubscriptionId () {
  return base64UrlEncode(randomBytes(16))
}

export default {
  name: 'SubscribePage',
  data () {
    return {
      loading: true,
      error: '',
      blog: '',
      productRef: '',
      returnTo: '',
      plan: null,
      readerKey: null,
      keyError: '',
      paymentMode: 'recurring',
      accepted: false,
      queued: false,
      granted: false,
      checking: false,
      pollError: '',
      pollTimer: null,
      pollDeadline: 0,
      operationError: '',
      operation: null
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    authorAvatar () {
      return this.plan ? 'https://images.hive.blog/u/' + this.plan.author + '/avatar' : ''
    },
    paymentModes () {
      if (!this.plan) return []
      const executions = this.plan.executions
      return [
        {
          label: 'Recurring membership',
          caption: this.plan.priceLabel + ' ' + this.recurrencePhrase + ' · ' + executions + ' payments, cancel anytime',
          value: 'recurring'
        },
        {
          label: this.oneOffLabel,
          caption: this.plan.priceLabel + ' once · access for ' + this.oneOffAccess,
          value: 'once'
        }
      ]
    },
    recurrenceLabel () {
      return this.plan ? vaultRecurrenceLabel(this.plan.recurrence) : 'period'
    },
    onePeriodUnit () {
      const label = this.recurrenceLabel
      return ['day', 'week', 'month', 'year'].includes(label) ? label : ''
    },
    oneOffLabel () {
      return this.onePeriodUnit ? 'One ' + this.onePeriodUnit : 'One payment'
    },
    oneOffAccess () {
      return this.onePeriodUnit ? 'one ' + this.onePeriodUnit : this.recurrenceLabel
    },
    recurrencePhrase () {
      return this.plan ? vaultRecurrencePhrase(this.plan.recurrence) : 'each period'
    },
    payButtonLabel () {
      if (!this.plan) return 'Continue'
      if (this.paymentMode === 'once') return 'Pay ' + this.plan.priceLabel + ' once'
      return 'Pay ' + this.plan.priceLabel + ' ' + this.recurrencePhrase
    },
    termsText () {
      if (!this.plan) return ''
      if (this.paymentMode === 'once') {
        return 'I understand this is a one-time payment of ' + this.plan.priceLabel +
          ' to @' + this.plan.author + '. Hive payments cannot be reversed.'
      }
      return 'I understand this is a recurring payment of ' + this.plan.priceLabel + ' ' +
        this.recurrencePhrase + ' to @' + this.plan.author + ' for ' + this.plan.executions +
        ' payments, and that I can cancel it from my wallet or my subscriptions page.'
    },
    displayDescription () {
      if (this.plan && this.plan.description) return this.plan.description
      return 'Support @' + (this.plan ? this.plan.author : '') + ' and read every members-only post on this blog.'
    },
    displayBenefits () {
      if (this.plan && Array.isArray(this.plan.benefits) && this.plan.benefits.length) return this.plan.benefits
      return [
        'Members-only posts published while your membership is active',
        'The members-only archive, including posts from before you joined',
        'Cancel any time; access lasts until the paid period ends',
        'Read on any device when you sign in with your Hive account'
      ]
    },
    productPath () {
      if (!this.plan) return this.blog ? '/@' + this.blog : '/blogs'
      return '/@' + this.plan.author + '/' + this.plan.permlink
    },
    returnPath () {
      return this.returnTo || this.productPath
    },
    canSubscribe () {
      return Boolean(this.loggedInUser && this.plan && this.readerKey && this.accepted && !this.queued)
    },
    memoPreview () {
      return this.operation ? this.operation[1].memo : ''
    }
  },
  watch: {
    loggedInUser (value, previous) {
      if (value === previous || !this.plan) return
      this.ensureKey()
    }
  },
  created () {
    this.updateMeta()
    this.load()
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    async load () {
      this.loading = true
      this.error = ''
      const parsed = parseSubscribeQuery(this.$route.query)
      this.blog = parsed.blog
      this.returnTo = parsed.returnTo || ''
      if (!parsed.ok) {
        this.error = parsed.error
        this.loading = false
        return
      }
      this.productRef = parsed.label
      try {
        const post = await fetchPostContent(parsed.product.author, parsed.product.permlink)
        const result = subscribePlanFromPost(post, { blog: parsed.blog })
        if (!result.ok) {
          this.error = result.error
          return
        }
        this.plan = result.plan
        this.syncQuery(parsed)
        await this.ensureKey()
      } catch (error) {
        this.error = error && error.message ? error.message : 'The product could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    async ensureKey () {
      this.keyError = ''
      try {
        const module = await loadOptionalModule(READER_KEY_MODULES, '../services/vaultReaderKey.js')
        if (!module || typeof module.ensureReaderKey !== 'function') {
          throw new Error('The reader key module is not available in this build.')
        }
        const key = await module.ensureReaderKey(this.blog, { account: this.loggedInUser })
        if (!key || !key.publicKeyB64) throw new Error('A reader key could not be created.')
        const rkt = key.rkt || await readerKeyThumbprint(key.publicKeyB64)
        this.readerKey = { publicKeyB64: key.publicKeyB64, privateKey: key.privateKey, rkt }
      } catch (error) {
        this.readerKey = null
        this.keyError = 'A reader key is required before paying. ' +
          (error && error.message ? error.message : 'This browser may not support WebCrypto.')
      }
    },
    syncQuery (parsed) {
      const current = this.$route.query || {}
      const redirect = parsed.returnTo || ''
      if (current.blog === parsed.blog && current.product === parsed.label &&
        (current.redirect || '') === redirect) return
      const query = { blog: parsed.blog, product: parsed.label }
      if (redirect) query.redirect = redirect
      this.$router.replace({ path: '/subscribe', query }).catch(() => {})
    },
    pay () {
      this.operationError = ''
      if (!this.canSubscribe) return
      const result = buildSubscribeOperation({
        user: this.loggedInUser,
        plan: this.plan,
        readerKey: this.readerKey.publicKeyB64,
        sub: newSubscriptionId(),
        oneTime: this.paymentMode === 'once'
      })
      if (!result) {
        this.operationError = 'The payment could not be prepared. Check your login and try again.'
        return
      }
      this.operation = result.operation
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', result.operation])
      this.queued = true
      this.startPolling()
    },
    startPolling () {
      this.stopPolling()
      this.granted = false
      this.pollError = ''
      this.pollDeadline = Date.now() + POLL_WINDOW_MS
      this.checkBulletin()
      this.pollTimer = setInterval(() => {
        if (Date.now() > this.pollDeadline) {
          this.stopPolling()
          this.pollError = 'Your access has not arrived yet. The payment may still be confirming; check again or open your subscriptions.'
          return
        }
        this.checkBulletin()
      }, POLL_INTERVAL_MS)
    },
    stopPolling () {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    async checkBulletin () {
      if (this.checking || !this.plan || !this.readerKey) return
      this.checking = true
      this.pollError = ''
      try {
        let bulletin = await this.resolveViaUnlockModule()
        if (!bulletin || !Array.isArray(bulletin.entries)) {
          const replies = await hive.api.callAsync('condenser_api.get_content_replies', [
            this.plan.author,
            this.plan.container
          ])
          bulletin = bulletinFromReplies(replies)
        }
        if (!bulletin || !Array.isArray(bulletin.entries)) return
        // Never mark a payment as granted from an unverified bulletin: a
        // third-party comment with a matching rkt and a future expiry is not
        // an entitlement. Require the creator's signature over the payload.
        if (String(bulletin.signer || '').toLowerCase() !== String(bulletin.blog || '').toLowerCase()) return
        const verified = await this.verifyViaUnlockModule(bulletin)
        if (!verified) {
          this.pollError = 'Your access could not be verified yet. This page will retry automatically.'
          return
        }
        const entry = bulletin.entries.find(item => item && item.rkt === this.readerKey.rkt)
        if (entry && Number.isFinite(Date.parse(entry.expires)) && Date.parse(entry.expires) > Date.now()) {
          this.granted = true
          this.stopPolling()
        }
      } catch {
        this.pollError = 'Your access could not be checked yet. This page will retry automatically.'
      } finally {
        this.checking = false
      }
    },
    async verifyViaUnlockModule (bulletin) {
      const module = await loadOptionalModule(UNLOCK_MODULES, '../services/vaultUnlock.js')
      if (!module || typeof module.verifyBulletin !== 'function') return false
      const result = await module.verifyBulletin({ bulletin, allowDelegation: true })
      return Boolean(result && result.ok)
    },
    async resolveViaUnlockModule () {
      try {
        const module = await loadOptionalModule(UNLOCK_MODULES, '../services/vaultUnlock.js')
        if (!module || typeof module.resolveBulletin !== 'function') return null
        const resolved = await module.resolveBulletin({
          blog: this.plan.author,
          settings: { container: this.plan.container },
          force: true,
          allowRelay: true
        })
        return resolved && resolved.bulletin ? resolved.bulletin : null
      } catch {
        return null
      }
    },
    updateMeta () {
      setPageMeta({
        title: 'Membership — Banksia',
        description: 'Join a Banksia blog membership with a direct HBD payment on Hive.',
        url: '/subscribe',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
