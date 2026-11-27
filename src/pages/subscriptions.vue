<template>
  <q-page class="subs-page">
    <div class="subs-shell">
      <nav class="subs-crumb" aria-label="Breadcrumb">
        <router-link to="/">Banksia</router-link>
        <span aria-hidden="true">/</span>
        <span>Subscriptions</span>
      </nav>

      <header class="subs-head">
        <p class="subs-kicker">Banksia Vault</p>
        <h1 class="subs-title">Subscriptions{{ subject ? ' — @' + subject : '' }}</h1>
        <p class="subs-muted">
          Memberships are direct HBD payments to the creator. This page reads
          public Hive history; it never holds funds and never sees a private key.
        </p>
      </header>

      <div v-if="!subject" class="subs-state">
        <q-icon name="login" size="28px" />
        <h2>Sign in to see your subscriptions</h2>
        <p>Use the sign-in button in the top bar, or open a read-only view from a creator's cancel link.</p>
        <q-btn outline no-caps color="primary" label="Browse blogs" to="/blogs" />
      </div>

      <div v-else-if="loading" class="subs-grid" role="status" aria-busy="true" aria-label="Loading subscriptions">
        <q-card v-for="n in 3" :key="n" flat bordered class="subs-card">
          <q-card-section>
            <q-skeleton type="rect" height="18px" width="45%" />
            <q-skeleton type="rect" height="12px" width="70%" class="q-mt-md" />
          </q-card-section>
        </q-card>
      </div>

      <div v-else-if="error" class="subs-state" role="alert">
        <h2>Subscriptions unavailable</h2>
        <p>{{ error }}</p>
        <q-btn outline no-caps color="primary" label="Try again" @click="load" />
      </div>

      <template v-else>
        <q-banner v-if="readonly" rounded class="subs-banner">
          <template #avatar><q-icon name="visibility" /></template>
          Read-only view of @{{ subject }}. Sign in as that account to cancel a payment or manage device keys.
        </q-banner>

        <q-banner v-if="notice" rounded class="subs-banner subs-banner--ok" aria-live="polite">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ notice }}
        </q-banner>
        <q-banner v-if="actionError" rounded class="subs-banner subs-banner--warning" role="alert">
          <template #avatar><q-icon name="error_outline" /></template>
          {{ actionError }}
        </q-banner>

        <section aria-labelledby="subs-memberships-title">
          <h2 id="subs-memberships-title" class="subs-section-title">Memberships</h2>

          <div v-if="!plans.length" class="subs-state subs-state--compact">
            <h3>No Vault memberships yet</h3>
            <p>A membership appears after a payment whose memo contains a Banksia Vault reader key.</p>
            <q-btn outline no-caps color="primary" label="Find a blog to support" to="/blogs" />
          </div>

          <ul v-else class="subs-list">
            <li v-for="plan in plans" :key="plan.product" class="subs-item">
              <q-card flat bordered class="subs-card">
                <q-card-section>
                  <div class="subs-item-head">
                    <div>
                      <h3 class="subs-item-title">
                        <router-link :to="'/@' + plan.author">{{ plan.title || '@' + plan.author + ' membership' }}</router-link>
                      </h3>
                      <p class="subs-muted">
                        @{{ plan.author }} · {{ plan.amount }} every {{ plan.recurrenceLabel || 'month' }}
                      </p>
                    </div>
                    <span class="subs-pill" :class="'subs-pill--' + plan.status">{{ plan.statusLabel }}</span>
                  </div>

                  <dl class="subs-facts">
                    <div><dt>Next payment</dt><dd>{{ plan.nextPayment ? shortDate(plan.nextPayment) : '—' }}</dd></div>
                    <div><dt>Access until</dt><dd>{{ plan.accessUntil ? shortDate(plan.accessUntil) : '—' }}</dd></div>
                    <div><dt>Payments left</dt><dd>{{ plan.remainingExecutions === null ? '—' : plan.remainingExecutions }}</dd></div>
                    <div><dt>Last payment</dt><dd>{{ plan.lastPayment ? shortDate(plan.lastPayment) : '—' }}</dd></div>
                  </dl>

                  <p v-if="plan.lastTxid" class="subs-tx">
                    Last transaction
                    <router-link :to="'/tx/' + plan.lastTxid">{{ plan.lastTxid }}</router-link>
                  </p>

                  <div class="subs-actions">
                    <q-btn
                      v-if="plan.status === 'active' && !readonly"
                      outline
                      no-caps
                      color="warning"
                      label="Cancel"
                      @click="confirmCancel(plan)"
                    />
                    <q-btn flat no-caps color="primary" label="Restore access" :to="'/@' + plan.author + '/' + plan.permlink" />
                  </div>
                </q-card-section>
              </q-card>
            </li>
          </ul>
        </section>

        <section aria-labelledby="subs-history-title">
          <h2 id="subs-history-title" class="subs-section-title">Payment history</h2>
          <q-card flat bordered class="subs-card">
            <q-card-section>
              <div class="subs-table-wrap" role="region" aria-label="Payment history" tabindex="0">
                <table class="subs-table">
                  <caption class="subs-visually-hidden">Vault payment history for @{{ subject }}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Creator</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Transaction</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="payment in payments" :key="payment.key">
                      <td>{{ shortDate(payment.timestamp) }}</td>
                      <td><router-link :to="'/@' + payment.author">@{{ payment.author }}</router-link></td>
                      <td>{{ payment.amount }}</td>
                      <td>
                        <router-link v-if="payment.txid" :to="'/tx/' + payment.txid">{{ shortTx(payment.txid) }}</router-link>
                        <span v-else>—</span>
                      </td>
                      <td>{{ payment.statusLabel }}</td>
                    </tr>
                    <tr v-if="!payments.length">
                      <td colspan="5" class="subs-empty">No Vault payments found in the last 1,000 history rows.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-card-section>
          </q-card>
        </section>

        <section aria-labelledby="subs-keys-title">
          <h2 id="subs-keys-title" class="subs-section-title">Reader keys and devices</h2>
          <q-card flat bordered class="subs-card">
            <q-card-section>
              <p class="subs-muted">
                Each device holds a P-256 reader key for a blog. The private key
                never leaves this browser and is never displayed here. Export an
                encrypted recovery file before changing devices.
              </p>
              <p v-if="readerKeyError" class="subs-error" role="alert">{{ readerKeyError }}</p>
              <div v-else-if="!readerKeys.length" class="subs-muted">No reader keys on this device yet.</div>
              <div v-else class="subs-table-wrap" role="region" aria-label="Reader keys on this device" tabindex="0">
                <table class="subs-table">
                  <caption class="subs-visually-hidden">Reader keys stored on this device</caption>
                  <thead>
                    <tr>
                      <th scope="col">Blog</th>
                      <th scope="col">Thumbprint</th>
                      <th scope="col">Created</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in readerKeys" :key="key.blog + key.rkt">
                      <td>@{{ key.blog || subject }}</td>
                      <td><code>{{ shortKey(key.rkt) }}</code></td>
                      <td>{{ key.created ? shortDate(key.created) : '—' }}</td>
                      <td>
                        <div class="subs-row-actions">
                          <q-btn flat dense no-caps size="sm" label="Export recovery" :disable="readonly" @click="exportRecovery(key)" />
                          <q-btn flat dense no-caps size="sm" color="warning" label="Forget this device key" :disable="readonly" @click="confirmForget(key)" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="subs-import">
                <label class="subs-import-label" for="subs-recovery-file">Import recovery</label>
                <input id="subs-recovery-file" type="file" accept="application/json,.json" :disabled="readonly" @change="pickRecoveryFile" />
                <q-btn outline no-caps color="primary" label="Import recovery" :disable="readonly || !recoveryFile" :loading="busy === 'import'" @click="importRecovery" />
              </div>
              <p class="subs-muted subs-muted--small">
                Losing a reader key requires the creator to re-issue a grant. Keep
                the recovery file somewhere safe.
              </p>
            </q-card-section>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.subs-page {
  background: var(--c-bg);
}

.subs-shell {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.subs-crumb {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.subs-crumb a {
  color: var(--c-link);
  text-decoration: none;
}

.subs-head {
  margin-bottom: 1.2rem;
}

.subs-kicker {
  margin: 0 0 0.25rem;
  color: var(--c-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.subs-title {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
  line-height: 1.2;
}

.subs-muted {
  margin: 0.4rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.subs-muted--small {
  font-size: 0.78rem;
}

.subs-state {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
  padding: 1.2rem;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
}

.subs-state--compact {
  margin-bottom: 0.8rem;
}

.subs-state h2,
.subs-state h3 {
  margin: 0;
  font-size: 1.05rem;
}

.subs-state p {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 0.86rem;
}

.subs-banner {
  margin-bottom: 1rem;
  background: var(--c-surface-2);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  font-size: 0.84rem;
}

.subs-banner--ok {
  border-color: var(--c-positive);
}

.subs-banner--warning {
  border-color: var(--c-warning);
}

.subs-section-title {
  margin: 1.6rem 0 0.6rem;
  font-size: 1.1rem;
}

.subs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.7rem;
}

.subs-card {
  background: var(--c-surface);
  border-color: var(--c-border);
}

.subs-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.subs-item-title {
  margin: 0;
  font-size: 1rem;
}

.subs-item-title a {
  color: var(--c-link);
  text-decoration: none;
}

.subs-pill {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  font-size: 0.72rem;
  white-space: nowrap;
}

.subs-pill--active {
  border-color: var(--c-positive);
  color: var(--c-positive);
}

.subs-pill--expired,
.subs-pill--canceled {
  border-color: var(--c-warning);
  color: var(--c-warning);
}

.subs-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.7rem;
  margin: 0.9rem 0 0;
}

.subs-facts dt {
  color: var(--c-text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.subs-facts dd {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
}

.subs-tx {
  margin: 0.7rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.subs-tx a {
  color: var(--c-link);
}

.subs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.subs-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.subs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.subs-table th,
.subs-table td {
  padding: 0.5rem 0.55rem;
  border-bottom: 1px solid var(--c-border-subtle);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.subs-table th {
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.subs-table code {
  padding: 0.05rem 0.2rem;
  border-radius: 4px;
  background: var(--c-surface-2);
}

.subs-table a {
  color: var(--c-link);
}

.subs-empty {
  padding: 1rem 0.5rem;
  color: var(--c-text-muted);
  white-space: normal;
}

.subs-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
}

.subs-import {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.subs-import-label {
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.subs-import input[type='file'] {
  max-width: 230px;
  color: var(--c-text-muted);
  font-size: 0.78rem;
}

.subs-error {
  margin: 0.6rem 0 0;
  color: var(--c-warning);
  font-size: 0.82rem;
}

.subs-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 599px) {
  .subs-shell {
    padding: 1rem 0.75rem 3rem;
  }

  .subs-item-head {
    flex-direction: column;
    gap: 0.4rem;
  }
}
</style>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccountHistory } from 'src/services/chainData'
import { hive } from 'src/services/hive'
import { isValidHiveAccountName } from 'src/services/blogHost'
import { formatOrderDate, formatRecurrence } from 'src/services/shopOrders'
import {
  buildCancelOperation,
  nextPaymentDate,
  parseVaultAmount,
  parseVaultMemo
} from 'src/services/vaultPayments'

const DAY_MS = 24 * 60 * 60 * 1000
const ONE_TIME_WINDOW_MS = 31 * DAY_MS
const OPERATIONS = new Set(['transfer', 'fill_recurrent_transfer', 'recurrent_transfer'])

const READER_KEY_MODULES = import.meta.glob('../services/vaultReaderKey.js')

function normalizeAccount (value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function timestampMs (value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isFinite(time) ? time : 0
}

function recordOf (row) {
  if (!Array.isArray(row) || row.length < 2 || !row[1] || typeof row[1] !== 'object') return null
  const record = row[1]
  if (!Array.isArray(record.op) || record.op.length < 2) return null
  return { op: record.op, timestamp: record.timestamp || '', txid: record.trx_id || '', index: row[0] }
}

function productLabel (memo) {
  return memo && memo.product ? memo.product.author + '/' + memo.product.permlink : ''
}

/**
 * Reader-side plan rows from public history plus the open recurrent transfers.
 */
export function readerPlans (history, openTransfers, account, now = Date.now()) {
  const subject = normalizeAccount(account)
  const plans = new Map()
  const open = new Map()
  for (const row of Array.isArray(openTransfers) ? openTransfers : []) {
    if (!row || typeof row !== 'object') continue
    if (normalizeAccount(row.from) !== subject) continue
    const memo = parseVaultMemo(row.memo)
    const label = productLabel(memo)
    if (!label) continue
    const list = open.get(label) || []
    list.push(row)
    open.set(label, list)
  }

  const ordered = (Array.isArray(history) ? history : [])
    .map(recordOf)
    .filter(Boolean)
    .sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp))

  for (const record of ordered) {
    const [name, body] = record.op
    if (!OPERATIONS.has(name) || !body || typeof body !== 'object') continue
    if (normalizeAccount(body.from) !== subject) continue
    const memo = parseVaultMemo(body.memo)
    const label = productLabel(memo)
    if (!label) continue
    const amount = parseVaultAmount(body.amount)
    if (!amount) continue
    const time = timestampMs(record.timestamp)
    const current = plans.get(label) || {
      product: label,
      author: memo.product.author,
      permlink: memo.product.permlink,
      sub: memo.banksia.sub,
      memo: body.memo,
      amount: body.amount,
      recurrence: 0,
      lastPayment: '',
      lastPaymentMs: 0,
      lastTxid: '',
      canceledAt: 0,
      oneTime: false
    }
    if (name === 'recurrent_transfer') {
      current.memo = body.memo
      current.recurrence = Number(body.recurrence) || current.recurrence
      if (amount.number === 0) current.canceledAt = Math.max(current.canceledAt, time)
    } else {
      current.memo = body.memo
      current.amount = amount.label
      current.oneTime = name === 'transfer'
      if (time >= current.lastPaymentMs) {
        current.lastPaymentMs = time
        current.lastPayment = record.timestamp
        current.lastTxid = record.txid
      }
    }
    plans.set(label, current)
  }

  const rows = []
  for (const plan of plans.values()) {
    const candidates = open.get(plan.product) || []
    const openRow = candidates.find(row =>
      normalizeAccount(row.to) === plan.author &&
      parseVaultAmount(row.amount) &&
      parseVaultAmount(row.amount).label === plan.amount
    ) || candidates[0]
    if (openRow) {
      plan.recurrence = Number(openRow.recurrence) || plan.recurrence
      plan.memo = openRow.memo || plan.memo
      plan.amount = openRow.amount || plan.amount
    }
    const recurrence = plan.recurrence || 730
    const next = openRow && typeof openRow.trigger_date === 'string' && openRow.trigger_date
      ? openRow.trigger_date
      : (plan.lastPaymentMs ? nextPaymentDate(plan.lastPayment, recurrence) : '')
    const accessMs = plan.lastPaymentMs
      ? plan.lastPaymentMs + (plan.oneTime ? ONE_TIME_WINDOW_MS : recurrence * 60 * 60 * 1000)
      : 0
    const active = Boolean(openRow) || accessMs > now
    let status = active ? 'active' : 'expired'
    if (plan.canceledAt && plan.canceledAt >= plan.lastPaymentMs) status = 'canceled'
    rows.push({
      ...plan,
      recurrence,
      recurrenceLabel: formatRecurrence(recurrence),
      nextPayment: status === 'active' ? next : '',
      accessUntil: accessMs ? new Date(accessMs).toISOString() : '',
      remainingExecutions: openRow && Number.isFinite(Number(openRow.remaining_executions))
        ? Math.max(0, Math.trunc(Number(openRow.remaining_executions)))
        : null,
      status,
      statusLabel: status === 'active' ? 'Active' : status === 'canceled' ? 'Canceled' : 'Expired'
    })
  }
  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    return b.lastPaymentMs - a.lastPaymentMs
  })
}

/** Reader-side payment rows for the history table. */
export function readerPayments (history, account) {
  const subject = normalizeAccount(account)
  const payments = []
  for (const row of Array.isArray(history) ? history : []) {
    const record = recordOf(row)
    if (!record) continue
    const [name, body] = record.op
    if (!OPERATIONS.has(name) || !body || typeof body !== 'object') continue
    if (normalizeAccount(body.from) !== subject) continue
    const memo = parseVaultMemo(body.memo)
    const label = productLabel(memo)
    const amount = parseVaultAmount(body.amount)
    if (!label || !amount) continue
    let statusLabel = 'Paid'
    if (name === 'recurrent_transfer') statusLabel = amount.number === 0 ? 'Canceled' : 'Plan started'
    payments.push({
      key: (record.txid || String(record.index)) + ':' + payments.length,
      timestamp: record.timestamp,
      author: memo.product.author,
      product: label,
      amount: amount.label,
      txid: record.txid,
      statusLabel
    })
  }
  return payments.sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp))
}

function download (filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default {
  name: 'SubscriptionsPage',
  data () {
    return {
      subject: '',
      readonly: false,
      loading: true,
      error: '',
      plans: [],
      payments: [],
      readerKeys: [],
      readerKeyError: '',
      recoveryFile: null,
      busy: '',
      notice: '',
      actionError: ''
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    }
  },
  created () {
    this.subject = this.resolveSubject()
    this.readonly = Boolean(this.subject && this.loggedInUser !== this.subject)
    this.updateMeta()
    if (!this.subject) {
      this.loading = false
      return
    }
    this.load()
    this.loadReaderKeys()
  },
  methods: {
    resolveSubject () {
      const requested = normalizeAccount(this.$route.query.account)
      if (requested && isValidHiveAccountName(requested)) return requested
      return normalizeAccount(this.loggedInUser)
    },
    async load () {
      this.loading = true
      this.error = ''
      this.actionError = ''
      try {
        const [history, openTransfers] = await Promise.all([
          fetchAccountHistory(this.subject, { limit: 1000, force: true }),
          this.fetchOpenTransfers()
        ])
        this.plans = readerPlans(history, openTransfers, this.subject, Date.now())
        this.payments = readerPayments(history, this.subject)
      } catch (error) {
        this.error = error && error.message ? error.message : 'The subscription history could not be loaded.'
      } finally {
        this.loading = false
      }
    },
    async fetchOpenTransfers () {
      try {
        const result = await hive.api.callAsync('condenser_api.find_recurrent_transfers', [this.subject])
        return Array.isArray(result)
          ? result
          : (result && Array.isArray(result.transfers) ? result.transfers : [])
      } catch {
        return []
      }
    },
    confirmCancel (plan) {
      if (this.readonly) return
      this.$q.dialog({
        title: 'Cancel @' + plan.author + ' membership?',
        message: 'This queues a zero-amount recurrent_transfer that cancels the matching plan. ' +
          'The exact HF28 matching rule must be verified on Hive testnet before this ships. ' +
          'Access continues until the current grant expires on ' +
          (plan.accessUntil ? this.shortDate(plan.accessUntil) : 'the end of the paid period') + '.',
        cancel: true,
        persistent: true,
        ok: { label: 'Queue cancel', color: 'warning', unelevated: true, noCaps: true }
      }).onOk(() => this.queueCancel(plan))
    },
    queueCancel (plan) {
      this.actionError = ''
      const operation = buildCancelOperation({
        from: this.subject,
        to: plan.author,
        amount: '0.000 HBD',
        recurrence: plan.recurrence || 730,
        executions: 2,
        memo: plan.memo
      })
      if (!operation) {
        this.actionError = 'The cancel operation could not be built. Check the original payment memo.'
        return
      }
      this.$hiveStore.addToQueue([this.subject, 'active', operation])
      this.notice = 'Cancel queued. Approve it in your wallet; access continues until the current grant expires.'
    },
    async loadReaderKeys () {
      this.readerKeyError = ''
      try {
        const modules = READER_KEY_MODULES
        const path = '../services/vaultReaderKey.js'
        const loader = modules[path]
        if (!loader) {
          this.readerKeyError = 'Reader key management is not available in this build.'
          return
        }
        const module = await loader()
        this.readerKeyModule = module
        if (typeof module.listReaderKeys !== 'function') {
          this.readerKeyError = 'Reader key management is not available in this build.'
          return
        }
        const list = await module.listReaderKeys()
        this.readerKeys = (Array.isArray(list) ? list : [])
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            blog: normalizeAccount(item.blog || item.blogAccount),
            rkt: typeof item.rkt === 'string' ? item.rkt : '',
            created: typeof item.created === 'string' ? item.created : (item.createdAt || ''),
            label: typeof item.label === 'string' ? item.label : ''
          }))
          .filter(item => item.blog || item.rkt)
      } catch {
        this.readerKeyError = 'Reader keys could not be listed on this device.'
      }
    },
    promptPassphrase (title, message) {
      return new Promise(resolve => {
        this.$q.dialog({
          title,
          message,
          prompt: { model: '', type: 'password' },
          cancel: true,
          persistent: true
        }).onOk(value => resolve(value)).onCancel(() => resolve(''))
      })
    },
    async exportRecovery (key) {
      this.actionError = ''
      const module = this.readerKeyModule
      const fn = module && (module.exportReaderKeyRecovery || module.exportReaderRecovery || module.exportRecovery)
      if (typeof fn !== 'function') {
        this.actionError = 'Recovery export is not available in this build.'
        return
      }
      const passphrase = await this.promptPassphrase('Export reader recovery', 'Choose a passphrase for the encrypted recovery file.')
      if (!passphrase) return
      this.busy = 'export'
      try {
        const blog = key.blog || this.subject
        const data = await fn(blog, passphrase, { account: this.subject })
        download('banksia-vault-recovery-' + blog + '.json', JSON.stringify(data, null, 2))
        this.notice = 'Encrypted reader recovery downloaded.'
      } catch (error) {
        this.actionError = error && error.message ? error.message : 'The recovery file could not be exported.'
      } finally {
        this.busy = ''
      }
    },
    pickRecoveryFile (event) {
      const files = event && event.target && event.target.files
      this.recoveryFile = files && files[0] ? files[0] : null
    },
    async importRecovery () {
      this.actionError = ''
      if (!this.recoveryFile) return
      const module = this.readerKeyModule
      const fn = module && (module.importReaderKeyRecovery || module.importReaderRecovery || module.importRecovery)
      if (typeof fn !== 'function') {
        this.actionError = 'Recovery import is not available in this build.'
        return
      }
      const passphrase = await this.promptPassphrase('Import reader recovery', 'Enter the passphrase for the encrypted recovery file.')
      if (!passphrase) return
      this.busy = 'import'
      try {
        const text = await this.recoveryFile.text()
        const blog = this.subject
        await fn(blog, text, passphrase)
        this.recoveryFile = null
        this.notice = 'Reader recovery imported.'
        await this.loadReaderKeys()
      } catch (error) {
        this.actionError = error && error.message ? error.message : 'The recovery file could not be imported.'
      } finally {
        this.busy = ''
      }
    },
    confirmForget (key) {
      if (this.readonly) return
      this.$q.dialog({
        title: 'Forget this device key?',
        message: 'The private key for @' + (key.blog || this.subject) + ' will be removed from this browser. ' +
          'Restore it from a recovery file or ask the creator to re-issue a grant.',
        cancel: true,
        persistent: true,
        ok: { label: 'Forget key', color: 'warning', unelevated: true, noCaps: true }
      }).onOk(() => this.forgetKey(key))
    },
    async forgetKey (key) {
      this.actionError = ''
      const module = this.readerKeyModule
      const fn = module && (module.forgetReaderKey || module.forgetDeviceKey || module.removeReaderKey)
      if (typeof fn !== 'function') {
        this.actionError = 'Forgetting a device key is not available in this build.'
        return
      }
      try {
        await fn(key.blog || this.subject)
        this.notice = 'Reader key removed from this device.'
        await this.loadReaderKeys()
      } catch (error) {
        this.actionError = error && error.message ? error.message : 'The device key could not be removed.'
      }
    },
    shortKey (value) {
      if (!value) return 'unknown'
      return value.length > 10 ? value.slice(0, 6) + '…' + value.slice(-4) : value
    },
    shortTx (value) {
      return value.length > 14 ? value.slice(0, 8) + '…' + value.slice(-4) : value
    },
    shortDate (value) {
      const text = formatOrderDate(value)
      return text || '—'
    },
    updateMeta () {
      setPageMeta({
        title: 'Subscriptions — Banksia Vault',
        description: 'Manage Banksia Vault memberships, payments and reader keys.',
        url: '/subscriptions',
        type: 'website',
        noindex: true
      })
    }
  }
}
</script>
