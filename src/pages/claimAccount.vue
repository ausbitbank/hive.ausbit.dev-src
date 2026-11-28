<template>
  <q-page class="claim-page">
    <div class="claim-shell">
      <page-header
        eyebrow="Claim an account"
        :title="payload ? 'Create @' + payload.u : 'Open a claim link'"
        intro="A claim link asks you to create a Hive account for someone else using public keys they generated themselves. The new owner keeps the private keys; you pay the account token or the HIVE fee."
      >
        <template #actions>
          <q-btn no-caps flat color="primary" icon="arrow_back" label="Back to join" to="/join" />
        </template>
      </page-header>

      <q-banner v-if="checkError" class="claim-banner claim-banner--error" rounded>
      <q-icon name="warning" aria-hidden="true" />
      {{ checkError }}
    </q-banner>

    <q-banner v-if="payloadError" class="claim-banner claim-banner--error" rounded>
        <template #avatar><q-icon name="error" color="negative" aria-hidden="true" /></template>
        {{ payloadError }}
      </q-banner>

      <q-card v-if="!payload" flat bordered class="claim-card">
        <q-card-section>
          <div class="claim-eyebrow">No claim payload in this URL</div>
          <h2 class="claim-title">Paste the claim link</h2>
          <p class="claim-copy">
            Ask the new user to copy their claim link from the “Create your keys” page. It starts
            with <code>/create/claim#claim=</code> and contains only public keys.
          </p>
          <q-input
            v-model="pastedLink"
            outlined
            dense
            autogrow
            label="Claim link"
            placeholder="https://banksia.io/create/claim#claim=..."
            @keyup.enter="applyPastedLink()"
          />
          <div class="claim-actions">
            <q-btn no-caps unelevated color="primary" icon="link" label="Open claim" :disable="!pastedLink.trim()" @click="applyPastedLink()" />
          </div>
        </q-card-section>
      </q-card>

      <template v-else>
        <q-card flat bordered class="claim-card">
          <q-card-section>
            <div class="claim-summary">
              <div class="claim-summary__main">
                <div class="claim-eyebrow">New account</div>
                <h2 class="claim-username">@{{ payload.u }}</h2>
                <div class="claim-meta">
                  <span>Key fingerprint <code>{{ fingerprint || '…' }}</code></span>
                  <span>{{ createdLabel }}</span>
                </div>
              </div>
              <q-badge :color="accountExists ? (keysMatch ? 'green' : 'red') : 'primary'" class="claim-status-badge">
                {{ accountExists ? (keysMatch ? 'Account exists' : 'Key mismatch') : 'Awaiting creation' }}
              </q-badge>
            </div>

            <q-expansion-item class="claim-keys" dense switch-toggle-side icon="key" label="Public keys in this claim">
              <div class="claim-key-list">
                <div v-for="row in publicKeyRows" :key="row.label" class="claim-key-row">
                  <span>{{ row.label }}</span>
                  <code>{{ row.value }}</code>
                  <q-btn dense flat round icon="content_copy" :aria-label="'Copy ' + row.label" @click="copy(row.value, row.label)" />
                </div>
              </div>
            </q-expansion-item>

            <q-banner class="claim-banner claim-banner--warning" rounded>
              <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
              <strong>You are the sponsor.</strong>
              <div class="claim-banner__copy">
                Creating this account spends one of your account tokens or burns {{ accountCreationFee }}.
                You become the recovery account for @{{ payload.u }}. The new owner controls the
                private keys and nobody can reset them.
              </div>
            </q-banner>
          </q-card-section>

          <q-separator />

          <q-card-section v-if="accountExists">
            <div v-if="keysMatch" class="claim-result claim-result--ok">
              <q-icon name="check_circle" size="22px" aria-hidden="true" />
              <div>
                <strong>This account already exists and the keys match.</strong>
                <p>The claim has been completed. Ask @{{ payload.u }} to import their keys into SmartLock or Hive Keychain.</p>
                <q-btn no-caps outline color="primary" :to="'/@' + payload.u" :label="'View @' + payload.u" />
              </div>
            </div>
            <div v-else class="claim-result claim-result--bad">
              <q-icon name="report" size="22px" aria-hidden="true" />
              <div>
                <strong>The account exists, but these are not the keys in this claim.</strong>
                <p>Someone created the username with different keys. Do not spend a token or HIVE on this claim. The new user should choose another username and generate a new claim link.</p>
                <q-btn no-caps outline color="primary" :to="'/@' + payload.u" :label="'View @' + payload.u" />
              </div>
            </div>
          </q-card-section>

          <q-card-section v-else>
            <div v-if="!loggedInUser" class="claim-signin">
              <q-icon name="login" size="26px" aria-hidden="true" />
              <div>
                <strong>Sign in to create this account</strong>
                <p>Use Hive Keychain, SmartLock or HiveAuth. The sign-in panel opens from the account menu in the header.</p>
              </div>
              <q-btn no-caps unelevated color="primary" icon="login" label="Sign in" @click="openLogin()" />
            </div>

            <template v-else>
              <div class="claim-sponsor">
                <div>
                  <span class="claim-eyebrow">Signed in as</span>
                  <strong>@{{ loggedInUser }}</strong>
                </div>
                <div class="claim-sponsor__balances">
                  <div>
                    <span>Account tokens</span>
                    <strong>{{ pendingClaimed }}</strong>
                  </div>
                  <div>
                    <span>Liquid HIVE</span>
                    <strong>{{ liquidHiveLabel }}</strong>
                  </div>
                </div>
              </div>

              <div v-if="payload.u === loggedInUser" class="claim-result claim-result--bad">
                <q-icon name="info" size="22px" aria-hidden="true" />
                <div>
                  <strong>This claim is for your own username.</strong>
                  <p>Log in as a different account to sponsor @{{ payload.u }}, or choose another username.</p>
                </div>
              </div>

              <template v-else>
                <div class="claim-actions claim-actions--stack">
                  <q-btn
                    no-caps
                    unelevated
                    color="primary"
                    icon="generating_tokens"
                    :label="'Create with account token (' + pendingClaimed + ' available)'"
                    :disable="pendingClaimed < 1 || queued || tokenQueued"
                    @click="createWithToken()"
                  />
                  <q-btn
                    no-caps
                    unelevated
                    color="orange"
                    icon="paid"
                    :label="'Create for ' + accountCreationFee"
                    :disable="!hasEnoughHive || queued || tokenQueued"
                    @click="createWithHive()"
                  />
                  <q-btn
                    no-caps
                    flat
                    color="primary"
                    icon="add_circle"
                    label="Claim an account token first"
                    :disable="pendingClaimed > 0 || queued || tokenQueued"
                    @click="claimAccountToken()"
                  />
                </div>

                <p v-if="pendingClaimed < 1 && !hasEnoughHive" class="claim-hint">
                  You need one account token or at least {{ accountCreationFee }} liquid HIVE. You can
                  claim a token with Resource Credits from your account page, or fund this account.
                </p>
                <p v-else-if="pendingClaimed < 1" class="claim-hint">
                  No account tokens yet. Use your liquid HIVE, or claim a token with Resource Credits
                  and wait for it to confirm.
                </p>

                <q-banner v-if="tokenQueued" class="claim-banner claim-banner--info" rounded>
                  <template #avatar><q-spinner color="primary" size="18px" /></template>
                  <strong>Account token claim queued.</strong>
                  <div class="claim-banner__copy">
                    Approve it in your wallet. This page will refresh your token balance; create
                    the account once the token is available.
                  </div>
                </q-banner>

                <q-banner v-if="queued" class="claim-banner claim-banner--info" rounded>
                  <template #avatar><q-spinner v-if="!created" color="primary" size="18px" /><q-icon v-else name="check_circle" color="positive" aria-hidden="true" /></template>
                  <strong>{{ created ? 'Account created.' : 'Creation queued.' }}</strong>
                  <div class="claim-banner__copy">
                    <template v-if="created">@{{ payload.u }} now exists. Tell them to open Banksia and import their keys.</template>
                    <template v-else>Approve the action in Keychain, HiveAuth or SmartLock. This page will check the chain for a few minutes. If approval failed, open the action queue from the header and retry.</template>
                  </div>
                </q-banner>

                <p class="claim-hint">
                  The transaction is signed by you, not by Banksia. Your active key never leaves your
                  wallet. The new user only ever shares public keys.
                </p>
              </template>
            </template>
          </q-card-section>
        </q-card>

        <div class="claim-foot">
          <q-btn no-caps flat color="primary" icon="refresh" label="Check again" :loading="checkingAccount" @click="checkExistingAccount()" />
          <q-btn no-caps flat color="primary" icon="key" label="Create my own claim link" to="/join/keys" />
        </div>
      </template>
    </div>
  </q-page>
</template>

<script>
import { copyToClipboard } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { claimAgeDays, claimFingerprint, claimFromLink, buildClaimLink, authoritiesFromPayload, authoritiesMatchPayload } from 'src/services/accountClaim'
import { buildAccountCreationMetadata } from 'src/services/accountOnboarding'
import { pollWhileVisible } from 'src/services/polling'
import PageHeader from 'components/ui/PageHeader.vue'

const POLL_INTERVAL_MS = 5000
const POLL_ATTEMPTS = 60

export default {
  name: 'claimAccountPage',
  components: { PageHeader },
  data () {
    return {
      payload: null,
      payloadError: '',
      checkError: '',
      checkToken: 0,
      pastedLink: '',
      fingerprint: '',
      checkingAccount: false,
      accountExists: false,
      existingAccount: null,
      keysMatch: false,
      chainProperties: null,
      queued: false,
      tokenQueued: false,
      created: false,
      poller: null,
      pollCount: 0,
      polling: false
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
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
    hasEnoughHive () {
      return this.liquidHiveBalance >= this.accountCreationFeeAmount
    },
    publicKeyRows () {
      if (!this.payload) return []
      return [
        { label: 'Owner', value: this.payload.o },
        { label: 'Active', value: this.payload.a },
        { label: 'Posting', value: this.payload.p },
        { label: 'Memo', value: this.payload.m }
      ]
    },
    createdLabel () {
      if (!this.payload?.t) return ''
      const when = new Date(this.payload.t)
      if (Number.isNaN(when.getTime())) return ''
      const days = claimAgeDays(this.payload)
      const age = days === null ? '' : days < 1 ? 'created today' : 'created ' + Math.floor(days) + ' day' + (days < 2 ? '' : 's') + ' ago'
      return when.toLocaleDateString() + (age ? ' · ' + age : '')
    }
  },
  watch: {
    loggedInUser () {
      this.initAccount()
    }
  },
  mounted () {
    setPageMeta({
      title: 'Claim a Hive account — Banksia',
      description: 'Review a public-key-only Hive account claim and create the account with an account token or HIVE.',
      url: '/create/claim',
      noindex: true
    })
    this.readClaimFromUrl()
    this.getChainProperties()
    window.addEventListener('hashchange', this.readClaimFromUrl)
  },
  beforeUnmount () {
    this.stopPolling()
    window.removeEventListener('hashchange', this.readClaimFromUrl)
  },
  methods: {
    readClaimFromUrl () {
      try {
        const payload = claimFromLink(window.location.href)
        if (!payload) {
          this.payload = null
          this.payloadError = ''
          return
        }
        this.applyPayload(payload)
      } catch (error) {
        this.payload = null
        this.payloadError = error?.message || 'This claim link is not valid.'
      }
    },
    applyPastedLink () {
      const raw = String(this.pastedLink || '').trim()
      if (!raw) return
      try {
        const payload = claimFromLink(raw)
        if (!payload) {
          this.payloadError = 'That does not look like a Banksia claim link. It should contain /create/claim#claim=...'
          return
        }
        this.payloadError = ''
        this.applyPayload(payload)
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', buildClaimLink(payload))
        }
      } catch (error) {
        this.payloadError = error?.message || 'This claim link is not valid.'
      }
    },
    async applyPayload (payload) {
      this.payload = payload
      this.payloadError = ''
      this.checkError = ''
      this.checkToken += 1
      this.existingAccount = null
      this.accountExists = false
      this.keysMatch = false
      this.created = false
      this.queued = false
      this.tokenQueued = false
      this.stopPolling()
      this.fingerprint = await claimFingerprint(payload)
      this.checkExistingAccount()
      this.initAccount()
    },
    async checkExistingAccount () {
      if (!this.payload) return
      const payload = this.payload
      const token = this.checkToken
      this.checkingAccount = true
      this.checkError = ''
      try {
        const accounts = await this.$hive.api.getAccountsAsync([payload.u])
        if (token !== this.checkToken || payload !== this.payload) return
        if (accounts.length) {
          this.existingAccount = accounts[0]
          this.accountExists = true
          this.keysMatch = this.accountMatchesPayload(accounts[0], payload)
          if (this.keysMatch) {
            this.created = true
            this.stopPolling()
          }
        } else {
          this.existingAccount = null
          this.accountExists = false
          this.keysMatch = false
        }
      } catch {
        if (token !== this.checkToken || payload !== this.payload) return
        this.checkError = 'Could not check @' + payload.u + ' on chain. Try again before creating it.'
      } finally {
        if (token === this.checkToken) this.checkingAccount = false
      }
    },
    accountMatchesPayload (account, payload) {
      return authoritiesMatchPayload(account, payload)
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
    accountOpBase () {
      const authorities = authoritiesFromPayload(this.payload)
      return {
        new_account_name: this.payload.u,
        ...authorities,
        json_metadata: buildAccountCreationMetadata({
          sponsor: this.loggedInUser,
          via: 'claim-link',
          nonce: this.payload.n
        }),
        extensions: []
      }
    },
    createWithToken () {
      if (!this.payload || !this.loggedInUser || this.pendingClaimed < 1) return
      const tx = ['create_claimed_account', {
        creator: this.loggedInUser,
        ...this.accountOpBase()
      }]
      this.queueCreation(tx)
    },
    createWithHive () {
      if (!this.payload || !this.loggedInUser || !this.hasEnoughHive) return
      const tx = ['account_create', {
        fee: this.accountCreationFee,
        creator: this.loggedInUser,
        ...this.accountOpBase()
      }]
      this.queueCreation(tx)
    },
    claimAccountToken () {
      if (!this.loggedInUser) return
      const tx = ['claim_account', { creator: this.loggedInUser, fee: '0.000 HIVE', extensions: [] }]
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', tx])
      this.tokenQueued = true
      this.$q.notify({
        message: 'Account token claim queued. Approve it, then create the account.',
        color: 'primary',
        icon: 'generating_tokens',
        position: 'top',
        timeout: 5000
      })
      this.startPolling()
    },
    queueCreation (tx) {
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', tx])
      this.queued = true
      this.$q.notify({
        message: 'Account creation queued. Approve it in your wallet.',
        color: 'primary',
        icon: 'person_add',
        position: 'top',
        timeout: 5000
      })
      this.startPolling()
    },
    startPolling () {
      this.stopPolling()
      this.pollCount = 0
      this.poller = pollWhileVisible(async () => {
        if (this.polling) return
        this.polling = true
        try {
          this.pollCount += 1
          await this.checkExistingAccount()
          this.initAccount()
          if (this.tokenQueued && this.pendingClaimed > 0) {
            this.tokenQueued = false
            this.$q.notify({
              message: 'Account token ready. You can create the account now.',
              color: 'green',
              icon: 'check_circle',
              position: 'top',
              timeout: 4000
            })
          }
          if (this.created) {
            this.stopPolling()
            return
          }
          if (this.pollCount >= POLL_ATTEMPTS) {
            this.stopPolling()
            if (this.queued) {
              this.queued = false
              this.$q.notify({
                message: 'No account confirmation yet. Check the action queue and retry if it failed.',
                color: 'orange',
                icon: 'schedule',
                position: 'top',
                timeout: 6000
              })
            }
            if (this.tokenQueued) {
              this.tokenQueued = false
              this.$q.notify({
                message: 'No token confirmation yet. Check the action queue and retry if it failed.',
                color: 'orange',
                icon: 'schedule',
                position: 'top',
                timeout: 6000
              })
            }
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
      this.$q.notify({
        message: label + ' copied.',
        color: 'primary',
        icon: 'content_copy',
        position: 'top',
        timeout: 1600
      })
    }
  }
}
</script>

<style scoped>
.claim-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.claim-shell {
  width: min(840px, 100%);
  margin: 0 auto;
}

.claim-card {
  background: var(--c-card);
}

.claim-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.claim-title {
  margin: 0.2rem 0 var(--space-2);
  font-size: 1.25rem;
}

.claim-copy {
  margin: 0 0 var(--space-3);
  color: var(--c-text-subtle);
  font-size: 0.85rem;
  line-height: 1.55;
}

.claim-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.claim-username {
  margin: 0.1rem 0 0.3rem;
  font-size: 1.45rem;
  font-weight: 600;
}

.claim-meta {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.claim-meta code {
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
}

.claim-status-badge {
  font-variant-numeric: tabular-nums;
}

.claim-keys {
  margin: var(--space-3) 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.claim-key-list {
  padding: 0.4rem 0.65rem;
}

.claim-key-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: 0.3rem 0;
  border-top: 1px solid var(--c-border-subtle);
}

.claim-key-row:first-child {
  border-top: 0;
}

.claim-key-row span {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.claim-key-row code {
  overflow: hidden;
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.claim-banner {
  margin: var(--space-3) 0;
  color: var(--c-text);
}

.claim-banner--warning {
  background: color-mix(in srgb, var(--c-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
}

.claim-banner--info {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-primary) 35%, transparent);
}

.claim-banner--error {
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-negative) 35%, transparent);
}

.claim-banner__copy {
  margin-top: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.claim-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.claim-actions--stack {
  flex-direction: column;
  align-items: flex-start;
}

.claim-actions--stack .q-btn {
  width: 100%;
  justify-content: flex-start;
}

.claim-signin {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.claim-signin strong {
  display: block;
}

.claim-signin p {
  margin: 0.2rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.45;
}

.claim-signin .q-btn {
  margin-left: auto;
}

.claim-sponsor {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--c-border-subtle);
}

.claim-sponsor > div > strong {
  display: block;
  margin-top: 0.15rem;
}

.claim-sponsor__balances {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.claim-sponsor__balances div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.claim-sponsor__balances span {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.claim-sponsor__balances strong {
  font-variant-numeric: tabular-nums;
}

.claim-result {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
}

.claim-result--ok {
  color: var(--c-positive);
  background: color-mix(in srgb, var(--c-positive) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-positive) 30%, transparent);
}

.claim-result--bad {
  color: var(--c-negative);
  background: color-mix(in srgb, var(--c-negative) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-negative) 30%, transparent);
}

.claim-result p {
  margin: 0.25rem 0 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.claim-hint {
  margin: var(--space-2) 0 0;
  color: var(--c-text-faint);
  font-size: 0.75rem;
  line-height: 1.5;
}

.claim-foot {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

@media (max-width: 599px) {
  .claim-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .claim-key-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .claim-key-row span {
    grid-column: 1 / -1;
  }

  .claim-signin .q-btn {
    margin-left: 0;
    width: 100%;
  }
}
</style>
