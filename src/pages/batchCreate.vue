<template>
  <q-page class="batch-page">
    <div class="batch-shell">
      <page-header
        eyebrow="Claim links"
        title="Batch create accounts"
        intro="Paste several claim links, review the public keys and usernames, then approve one Keychain transaction. This is the low-friction way to spend account tokens without giving any automation your active key."
      >
        <template #actions>
          <q-btn no-caps flat color="primary" icon="arrow_back" label="Back to create" to="/create" />
        </template>
      </page-header>

      <q-banner class="batch-banner batch-banner--warning" rounded>
        <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
        <strong>Batch signing requires Hive Keychain.</strong>
        <div class="batch-banner__copy">
          One transaction contains every selected account creation. Hive transactions are atomic:
          if one username is taken or one operation is invalid, the whole batch fails. Review names
          before signing. SmartLock/HiveAuth users can still use the individual claim page.
        </div>
      </q-banner>

      <q-card flat bordered class="batch-card">
        <q-card-section>
          <div class="batch-step">
            <span class="batch-step__num">1</span>
            <div>
              <h2 class="batch-step__title">Paste claim links</h2>
              <p class="batch-step__copy">One link per line. Each link contains only a username and public keys. Maximum {{ maxBatch }} per batch.</p>
            </div>
          </div>
          <q-input
            v-model="rawLinks"
            type="textarea"
            outlined
            autogrow
            input-style="min-height: 150px"
            label="Claim links"
            placeholder="https://banksia.io/create/claim#claim=...&#10;https://banksia.io/create/claim#claim=..."
          />
          <div class="batch-actions">
            <q-btn no-caps unelevated color="primary" icon="manage_search" label="Review claims" :loading="checking" @click="reviewClaims()" />
            <q-btn no-caps flat color="primary" icon="delete_sweep" label="Clear" @click="clearAll()" />
          </div>
        </q-card-section>

        <template v-if="parseErrors.length || claims.length">
          <q-separator />
          <q-card-section>
            <div class="batch-step">
              <span class="batch-step__num">2</span>
              <div>
                <h2 class="batch-step__title">Review</h2>
                <p class="batch-step__copy">
                  {{ creatableCount }} ready to create · {{ completedCount }} already created ·
                  {{ blockedCount }} blocked
                </p>
              </div>
            </div>

            <q-banner v-if="parseErrors.length" class="batch-banner batch-banner--error" rounded>
              <template #avatar><q-icon name="error" color="negative" aria-hidden="true" /></template>
              <strong>Some lines could not be read.</strong>
              <ul class="batch-error-list">
                <li v-for="error in parseErrors" :key="error">{{ error }}</li>
              </ul>
            </q-banner>

            <div v-if="claims.length" class="batch-table-wrap">
              <table class="batch-table">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Fingerprint</th>
                    <th scope="col">Status</th>
                    <th scope="col">Keys</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="claim in claims" :key="claim.payload.u">
                    <td><strong>@{{ claim.payload.u }}</strong></td>
                    <td><code>{{ claim.fingerprint || '…' }}</code></td>
                    <td>
                      <span class="batch-status" :class="'batch-status--' + claim.state">{{ statusLabel(claim) }}</span>
                    </td>
                    <td>
                      <q-btn dense flat round icon="key" :aria-label="'Show keys for @' + claim.payload.u" @click="showKeys(claim)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </q-card-section>
        </template>

        <template v-if="claims.length">
          <q-separator />
          <q-card-section>
            <div class="batch-step">
              <span class="batch-step__num">3</span>
              <div>
                <h2 class="batch-step__title">Sign one transaction</h2>
                <p v-if="loggedInUser" class="batch-step__copy">
                  Signed in as <strong>@{{ loggedInUser }}</strong>.
                  {{ pendingClaimed }} account token{{ pendingClaimed === 1 ? '' : 's' }} and
                  {{ liquidHiveLabel }} liquid HIVE available.
                </p>
                <p v-else class="batch-step__copy">Sign in with Hive Keychain to see your token and HIVE balances.</p>
              </div>
            </div>

            <div v-if="!loggedInUser" class="batch-signin">
              <div>
                <strong>Sign in with Hive Keychain to batch sign.</strong>
                <p>Use the account menu in the header. The batch page never receives your keys.</p>
              </div>
              <q-btn no-caps unelevated color="primary" icon="login" label="Sign in" @click="openLogin()" />
            </div>

            <template v-else>
              <q-banner v-if="loginType !== 'keychain'" class="batch-banner batch-banner--info" rounded>
                <template #avatar><q-icon name="info" color="primary" aria-hidden="true" /></template>
                Batch signing currently uses Hive Keychain. Your current login is
                <strong>{{ loginType || 'unknown' }}</strong>. Use an individual claim link instead,
                or switch to Keychain for the batch.
              </q-banner>

              <q-banner v-else-if="!creatableCount" class="batch-banner batch-banner--info" rounded>
                <template #avatar><q-icon name="check_circle" color="positive" aria-hidden="true" /></template>
                Every claim in this batch is already created or blocked. Nothing to sign.
              </q-banner>

              <template v-else>
                <q-banner class="batch-banner batch-banner--warning" rounded>
                  <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
                  You will become the recovery account for {{ creatableCount }} account{{ creatableCount === 1 ? '' : 's' }}.
                  The new owners keep their private keys.
                </q-banner>

                <div class="batch-actions">
                  <q-btn
                    no-caps
                    unelevated
                    color="primary"
                    icon="generating_tokens"
                    :label="'Create ' + creatableCount + ' with account tokens'"
                    :disable="pendingClaimed < creatableCount || signing"
                    :loading="signing"
                    @click="signBatch('token')"
                  />
                  <q-btn
                    no-caps
                    unelevated
                    color="orange"
                    icon="paid"
                    :label="'Create ' + creatableCount + ' for ' + batchHiveCost"
                    :disable="!hasEnoughHiveForBatch || signing"
                    :loading="signing"
                    @click="signBatch('hive')"
                  />
                </div>

                <p v-if="pendingClaimed < creatableCount" class="batch-hint">
                  You need {{ creatableCount }} account tokens or enough liquid HIVE. Claim tokens
                  from your account page if needed.
                </p>
              </template>

              <q-banner v-if="txId" class="batch-banner batch-banner--ok" rounded>
                <template #avatar><q-icon name="check_circle" color="positive" aria-hidden="true" /></template>
                <strong>Transaction sent.</strong>
                <div class="batch-banner__copy">
                  <code>{{ txId }}</code><br />
                  This page is checking the chain and will mark each account as created.
                </div>
              </q-banner>
            </template>
          </q-card-section>
        </template>
      </q-card>

      <p class="batch-footnote">
        The transaction is signed by you in Keychain; Banksia never stores or sees your active key.
        If a batch fails, remove the taken/invalid name and retry the remainder.
      </p>
    </div>

    <q-dialog v-model="keysDialog">
      <q-card class="batch-keys-card">
        <q-card-section>
          <div class="batch-eyebrow">Public keys</div>
          <h2 class="batch-step__title">@{{ keysClaim?.payload?.u }}</h2>
          <div v-if="keysClaim" class="batch-key-list">
            <div v-for="row in keysRows" :key="row.label" class="batch-key-row">
              <span>{{ row.label }}</span>
              <code>{{ row.value }}</code>
              <q-btn dense flat round icon="content_copy" :aria-label="'Copy ' + row.label" @click="copy(row.value, row.label)" />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { copyToClipboard } from 'quasar'
import { keychain } from '@hiveio/keychain'
import { setPageMeta } from 'src/utils/pageMeta'
import {
  authoritiesFromPayload,
  claimFingerprint,
  claimFromLink
} from 'src/services/accountClaim'
import { buildAccountCreationMetadata } from 'src/services/accountOnboarding'
import { pollWhileVisible } from 'src/services/polling'
import PageHeader from 'components/ui/PageHeader.vue'

const MAX_BATCH = 10
const POLL_INTERVAL_MS = 5000
const POLL_ATTEMPTS = 36

export default {
  name: 'batchCreatePage',
  components: { PageHeader },
  data () {
    return {
      rawLinks: '',
      claims: [],
      parseErrors: [],
      checking: false,
      signing: false,
      txId: '',
      keysDialog: false,
      keysClaim: null,
      poller: null,
      pollCount: 0,
      polling: false,
      chainProperties: null,
      maxBatch: MAX_BATCH
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    loginType () {
      return this.$hiveStore.user.loginType
    },
    account () {
      return this.$hiveStore.accounts[this.loggedInUser] || null
    },
    pendingClaimed () {
      return Number(this.account?.pending_claimed_accounts || 0)
    },
    liquidHiveBalance () {
      const balance = this.account?.balance
      if (typeof balance !== 'string') return 0
      const amount = parseFloat(balance.split(' ')[0])
      return Number.isFinite(amount) ? amount : 0
    },
    liquidHiveLabel () {
      return this.account?.balance || '—'
    },
    accountCreationFee () {
      return this.formatAccountCreationFee(this.chainProperties?.account_creation_fee)
    },
    accountCreationFeeAmount () {
      const amount = parseFloat(this.accountCreationFee.split(' ')[0])
      return Number.isFinite(amount) && amount > 0 ? amount : 3
    },
    creatableClaims () {
      return this.claims.filter(claim => claim.state === 'ready')
    },
    creatableCount () {
      return this.creatableClaims.length
    },
    completedCount () {
      return this.claims.filter(claim => claim.state === 'created').length
    },
    blockedCount () {
      return this.claims.filter(claim => claim.state === 'blocked').length
    },
    batchHiveCost () {
      return (this.creatableCount * this.accountCreationFeeAmount).toFixed(3) + ' HIVE'
    },
    hasEnoughHiveForBatch () {
      return this.liquidHiveBalance >= this.creatableCount * this.accountCreationFeeAmount
    },
    keysRows () {
      if (!this.keysClaim) return []
      return [
        { label: 'Owner', value: this.keysClaim.payload.o },
        { label: 'Active', value: this.keysClaim.payload.a },
        { label: 'Posting', value: this.keysClaim.payload.p },
        { label: 'Memo', value: this.keysClaim.payload.m }
      ]
    }
  },
  watch: {
    loggedInUser () {
      this.initAccount()
    }
  },
  mounted () {
    setPageMeta({
      title: 'Batch create Hive accounts — Banksia',
      description: 'Review public-key-only claim links and create several Hive accounts in one Keychain-approved transaction.',
      url: '/create/batch',
      noindex: true
    })
    this.getChainProperties()
    this.initAccount()
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    async reviewClaims () {
      this.stopPolling()
      this.txId = ''
      this.parseErrors = []
      this.claims = []

      const lines = String(this.rawLinks || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

      if (!lines.length) {
        this.parseErrors.push('Paste at least one claim link.')
        return
      }
      if (lines.length > MAX_BATCH) {
        this.parseErrors.push('Only ' + MAX_BATCH + ' claim links can be signed in one batch.')
        return
      }

      const seen = new Set()
      for (const [index, line] of lines.entries()) {
        try {
          const payload = claimFromLink(line)
          if (!payload) {
            this.parseErrors.push('Line ' + (index + 1) + ': no claim payload found.')
            continue
          }
          if (seen.has(payload.u)) {
            this.parseErrors.push('Line ' + (index + 1) + ': @' + payload.u + ' is duplicated.')
            continue
          }
          seen.add(payload.u)
          this.claims.push({
            payload,
            fingerprint: await claimFingerprint(payload),
            state: 'ready',
            existing: null
          })
        } catch (error) {
          this.parseErrors.push('Line ' + (index + 1) + ': ' + (error?.message || 'invalid claim link.'))
        }
      }

      if (this.claims.length) await this.checkClaimAccounts()
    },
    async checkClaimAccounts () {
      if (!this.claims.length) return
      this.checking = true
      try {
        const accounts = await this.$hive.api.getAccountsAsync(this.claims.map(claim => claim.payload.u))
        const byName = new Map(accounts.map(account => [account.name, account]))
        for (const claim of this.claims) {
          const existing = byName.get(claim.payload.u)
          claim.existing = existing || null
          if (!existing) {
            claim.state = 'ready'
          } else if (this.accountMatchesPayload(existing, claim.payload)) {
            claim.state = 'created'
          } else {
            claim.state = 'blocked'
          }
        }
      } catch {
        this.$q.notify({
          message: 'Could not check the usernames. Try again.',
          color: 'negative',
          icon: 'error',
          position: 'top'
        })
      } finally {
        this.checking = false
      }
    },
    accountMatchesPayload (account, payload) {
      const firstKey = authority => authority?.key_auths?.[0]?.[0] || ''
      return firstKey(account?.owner) === payload.o &&
        firstKey(account?.active) === payload.a &&
        firstKey(account?.posting) === payload.p &&
        (account?.memo_key || '') === payload.m
    },
    statusLabel (claim) {
      if (claim.state === 'created') return 'Already created'
      if (claim.state === 'blocked') return 'Name taken with different keys'
      return 'Ready'
    },
    showKeys (claim) {
      this.keysClaim = claim
      this.keysDialog = true
    },
    clearAll () {
      this.stopPolling()
      this.rawLinks = ''
      this.claims = []
      this.parseErrors = []
      this.txId = ''
    },
    initAccount () {
      if (this.loggedInUser) this.$hiveStore.getAccount(this.loggedInUser)
    },
    getChainProperties () {
      this.$hive.api.callAsync('condenser_api.get_chain_properties', [])
        .then(props => { if (props) this.chainProperties = props })
        .catch(() => {})
    },
    formatAccountCreationFee (fee) {
      if (typeof fee === 'string') {
        const trimmed = fee.trim()
        if (/^\d+(\.\d+)?\s+HIVE$/.test(trimmed)) return trimmed
      }
      if (fee && typeof fee === 'object' && fee.amount !== undefined) {
        const precision = Number.isInteger(fee.precision) ? fee.precision : 3
        const amount = Number(fee.amount) / Math.pow(10, precision)
        if (Number.isFinite(amount) && amount >= 0) return amount.toFixed(precision) + ' HIVE'
      }
      return '3.000 HIVE'
    },
    baseOperation (claim) {
      return {
        new_account_name: claim.payload.u,
        ...authoritiesFromPayload(claim.payload),
        json_metadata: buildAccountCreationMetadata({
          sponsor: this.loggedInUser,
          via: 'claim-batch',
          nonce: claim.payload.n
        }),
        extensions: []
      }
    },
    async signBatch (mode) {
      if (!this.loggedInUser || this.loginType !== 'keychain') {
        this.$q.notify({
          message: 'Batch signing requires Hive Keychain.',
          color: 'orange',
          icon: 'info',
          position: 'top'
        })
        return
      }
      const claims = this.creatableClaims
      if (!claims.length) return
      if (mode === 'token' && this.pendingClaimed < claims.length) return
      if (mode === 'hive' && !this.hasEnoughHiveForBatch) return

      const cost = mode === 'token'
        ? claims.length + ' account token' + (claims.length === 1 ? '' : 's')
        : (claims.length * this.accountCreationFeeAmount).toFixed(3) + ' HIVE'

      const confirmed = await new Promise(resolve => {
        this.$q.dialog({
          title: 'Create ' + claims.length + ' account' + (claims.length === 1 ? '' : 's') + '?',
          message: 'This will spend ' + cost + ' and make you the recovery account for ' +
            claims.map(claim => '@' + claim.payload.u).join(', ') + '.',
          cancel: true,
          persistent: true,
          ok: { label: 'Sign in Keychain', color: 'primary', unelevated: true }
        }).onOk(() => resolve(true)).onCancel(() => resolve(false))
      })
      if (!confirmed) return

      const operations = claims.map(claim => {
        if (mode === 'token') {
          return ['create_claimed_account', {
            creator: this.loggedInUser,
            ...this.baseOperation(claim)
          }]
        }
        return ['account_create', {
          fee: this.accountCreationFee,
          creator: this.loggedInUser,
          ...this.baseOperation(claim)
        }]
      })

      this.signing = true
      try {
        const result = await keychain(window, 'requestBroadcast', this.loggedInUser, operations, 'active')
        if (!result?.success) {
          const reason = result?.cancel
            ? 'Cancelled in Keychain.'
            : result?.message || result?.msg || result?.error || 'Keychain did not approve the batch.'
          throw new Error(reason)
        }
        this.txId = result.result?.id || result.tx_id || result.txId || ''
        this.$q.notify({
          message: 'Batch transaction sent.',
          color: 'green',
          icon: 'check_circle',
          position: 'top',
          timeout: 5000
        })
        this.startPolling()
      } catch (error) {
        this.$q.notify({
          message: error?.message || 'Could not sign the batch.',
          color: 'negative',
          icon: 'error',
          position: 'top',
          timeout: 7000
        })
      } finally {
        this.signing = false
      }
    },
    startPolling () {
      this.stopPolling()
      this.pollCount = 0
      this.poller = pollWhileVisible(async () => {
        if (this.polling) return
        this.polling = true
        try {
          this.pollCount += 1
          await this.checkClaimAccounts()
          this.initAccount()
          if (this.completedCount + this.blockedCount === this.claims.length || this.pollCount >= POLL_ATTEMPTS) {
            this.stopPolling()
          }
        } finally {
          this.polling = false
        }
      }, POLL_INTERVAL_MS, { immediate: false })
      this.poller.start()
    },
    stopPolling () {
      this.poller?.stop()
      this.poller = null
    },
    openLogin () {
      window.dispatchEvent(new CustomEvent('banksia:open-login'))
    },
    copy (value, label) {
      copyToClipboard(String(value || ''))
      this.$q.notify({ message: label + ' copied.', color: 'primary', icon: 'content_copy', position: 'top', timeout: 1600 })
    }
  }
}
</script>

<style scoped>
.batch-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.batch-shell {
  width: min(980px, 100%);
  margin: 0 auto;
}

.batch-card {
  background: var(--c-card);
}

.batch-banner {
  margin: var(--space-3) 0;
  color: var(--c-text);
}

.batch-banner--warning {
  background: color-mix(in srgb, var(--c-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
}

.batch-banner--error {
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-negative) 35%, transparent);
}

.batch-banner--info {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-primary) 35%, transparent);
}

.batch-banner--ok {
  background: color-mix(in srgb, var(--c-positive) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-positive) 35%, transparent);
}

.batch-banner__copy {
  margin-top: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.batch-error-list {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.batch-step {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.batch-step__num {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-primary) 16%, transparent);
  color: var(--c-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.batch-step__title {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 600;
}

.batch-step__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.batch-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
}

.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.batch-table th,
.batch-table td {
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid var(--c-border-subtle);
  text-align: left;
}

.batch-table th {
  color: var(--c-text-faint);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.batch-table tr:last-child td {
  border-bottom: 0;
}

.batch-table code {
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.batch-status {
  display: inline-flex;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.7rem;
}

.batch-status--ready {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 12%, transparent);
}

.batch-status--created {
  color: var(--c-positive);
  background: color-mix(in srgb, var(--c-positive) 12%, transparent);
}

.batch-status--blocked {
  color: var(--c-negative);
  background: color-mix(in srgb, var(--c-negative) 12%, transparent);
}

.batch-signin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.batch-signin p {
  margin: 0.2rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.batch-hint {
  margin: var(--space-2) 0 0;
  color: var(--c-text-faint);
  font-size: 0.75rem;
  line-height: 1.5;
}

.batch-footnote {
  margin: var(--space-4) 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
  line-height: 1.5;
}

.batch-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.batch-keys-card {
  width: min(620px, 92vw);
  background: var(--c-dialog);
}

.batch-key-list {
  margin-top: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.batch-key-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--c-border-subtle);
}

.batch-key-row:last-child {
  border-bottom: 0;
}

.batch-key-row span {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.batch-key-row code {
  overflow: hidden;
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .batch-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .batch-key-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .batch-key-row span {
    grid-column: 1 / -1;
  }
}
</style>
