<template>
  <q-page class="flex q-pa-md flex-center create-page">
    <q-card flat bordered class="create-card">
      <q-card-section>
        <div class="create-eyebrow">Existing Hive account</div>
        <h1 class="create-title">Create an account for someone</h1>
        <p class="create-copy">
          Use one account token or {{ accountCreationFee }} to create a new Hive account. You will
          see its password and private keys once; the new owner must save them. Hive has no password
          reset.
        </p>
        <div class="create-actions">
          <q-btn no-caps outline color="primary" icon="key" label="New user? Generate keys first" to="/join/keys" />
          <q-btn no-caps flat color="primary" icon="link" label="Open a claim link" to="/create/claim" />
          <q-btn no-caps flat color="primary" icon="fact_check" label="Batch claim links" to="/create/batch" />
        </div>
        <q-banner class="create-warning" rounded>
          <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
          <strong>Safer handoff:</strong> ask the new owner to generate their own keys at
          <router-link to="/join/keys">/join/keys</router-link> and send you the claim link. You
          then create the account without ever seeing their private keys.
        </q-banner>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <q-card flat bordered class="create-form-card">
          <q-card-section>
            <q-form @submit="keys=null;checkUsernameAvailable(newUsername)">
              <q-input
                label="New account username"
                v-model="newUsername"
                bottom-slots
                :error-message="newUsername ? validateUsername(newUsername) : ''"
                :error="Boolean(newUsername) && validateUsername(newUsername) !== null"
                v-if="availableUsername === false || availableUsername === null"
                clearable
              />
            </q-form>
            <div v-if="availableUsername === false" class="create-available create-available--bad">
              <q-icon name="error" size="md" aria-hidden="true" />
              Account <router-link :to="linkAccount(newUsername)">@{{ newUsername }}</router-link> is already registered
            </div>
            <div v-if="availableUsername === true" class="create-available create-available--ok">
              <b>@{{ newUsername }}</b> is available.
              <q-btn dense flat round icon="refresh" color="primary" aria-label="Check availability again" v-if="keys" @click="checkUsernameAvailable(newUsername) && init()" />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions class="create-form-actions">
            <q-btn flat label="Choose another username" icon="arrow_back" color="primary" @click="newUsername='';keys=null;confirmedSaved=false" v-if="availableUsername === true" />
            <q-btn flat label="Check username availability" icon="search" color="primary" @click="keys=null;checkUsernameAvailable(newUsername)" v-if="!availableUsername && !keys" :disable="validateUsername(newUsername) !== null" />
            <q-btn flat label="Generate keys" icon="enhanced_encryption" color="orange" v-if="availableUsername && !keys" @click="genKeys()" />
          </q-card-actions>
        </q-card>

        <q-card flat bordered v-if="keys" class="create-keys-card">
          <q-card-section class="create-keys-head">
            <q-icon name="warning" color="warning" size="22px" aria-hidden="true" />
            <div>
              <div class="create-keys-title">Save a copy of these keys</div>
              <div class="create-keys-copy">The new owner needs the password and owner/active/posting/memo keys. Do not email them; hand them over securely.</div>
            </div>
          </q-card-section>
          <q-card-section>
            <json-viewer :data="keys" />
            <q-checkbox label="I have saved these keys in a secure location" v-model="confirmedSaved" />
          </q-card-section>
          <q-card-actions class="create-key-actions">
            <q-btn dense color="primary" icon="content_copy" label="Copy" @click="copy(JSON.stringify(keys))" />
            <q-btn dense color="primary" icon="save" label="Download" @click="saveKeys()" />
            <q-btn
              dense
              color="red"
              icon="person_add"
              label="Create with token"
              @click="claimAccountWithToken()"
              :title="!loggedInUser ? 'Sign in first' : 'Broadcast account creation to the blockchain'"
              :disable="!loggedInUser || !account?.pending_claimed_accounts || !confirmedSaved"
              v-if="account?.pending_claimed_accounts > 0"
            />
            <q-btn
              dense
              color="red"
              icon="person_add"
              :label="'Create for ' + accountCreationFeeAmount + ' HIVE'"
              @click="claimAccountWithHive()"
              :title="!loggedInUser ? 'Sign in first' : 'Broadcast account creation to the blockchain'"
              :disable="!loggedInUser || !confirmedSaved"
              v-if="liquidHiveBalance >= accountCreationFeeAmount"
            />
            <q-btn dense label="Import keys to Hive Keychain" color="primary" icon="img:/statics/hive-keychain.svg" :loading="keychainImporting" @click="importToKeychain()" />
            <q-btn dense label="Import to SmartLock" color="primary" icon="lock" :loading="smartlockImporting" @click="importToSmartlock()" />
          </q-card-actions>
          <q-separator />
          <q-card-section>
            <delegation-options v-model="delegation" />
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-section v-if="!loggedInUser" class="create-signin">
        <div>
          <strong>Sign in to create the account.</strong>
          <p>Use Hive Keychain, SmartLock or HiveAuth. The account token/HIVE balance is shown after sign-in.</p>
        </div>
        <q-btn no-caps unelevated color="primary" icon="login" label="Sign in" @click="openLogin()" />
      </q-card-section>

      <q-card-section v-else-if="account" class="create-balance">
        <div>
          <span class="create-balance__label">Account tokens</span>
          <strong>{{ account.pending_claimed_accounts }}</strong>
        </div>
        <div>
          <span class="create-balance__label">Liquid HIVE</span>
          <strong>{{ account.balance }}</strong>
        </div>
        <div class="create-balance__actions">
          <q-btn
            v-if="!account.pending_claimed_accounts"
            dense
            flat
            no-caps
            color="primary"
            icon="generating_tokens"
            label="Claim an account token"
            @click="claimAccountToken()"
          />
          <span class="create-balance__hint">Account creation fee: {{ accountCreationFee }}</span>
        </div>
        <rc :username="loggedInUser" :showAccountClaimsOnly="true" />
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { defineAsyncComponent } from 'vue'
import { copyToClipboard, exportFile } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { validateAccountName } from 'src/services/hiveNames'
import { createPassword, generateKeys } from 'src/services/hiveTx'
import { importKeysToKeychain } from 'src/services/keychainAccounts'
import { buildAccountCreationMetadata } from 'src/services/accountOnboarding'
import { buildDelegationOperations } from 'src/services/accountDelegation'
import { requiredAuthority } from 'src/services/queueAuthority'
import { fetchGlobalProps } from 'src/services/chainData'
import DelegationOptions from 'components/onboarding/DelegationOptions.vue'
export default {
  name: 'createAccountPage',
  components: {
    DelegationOptions,
    jsonViewer: defineAsyncComponent(() => import('components/jsonViewer.vue')),
    rc: defineAsyncComponent(() => import('components/rc.vue'))
  },
  data () {
    return {
      newUsername: '',
      availableUsername: null,
      checkedUsername: '',
      checkToken: 0,
      keys: null,
      generatedAuthorities: null,
      roles: ['active', 'owner', 'posting', 'memo'],
      confirmedSaved: false,
      chainProperties: null,
      smartlockImporting: false,
      keychainImporting: false,
      delegation: { rcEnabled: false, rcAmount: 5, hpEnabled: false, hpAmount: 5 }
    }
  },
  watch: {
    newUsername: function () {
      this.availableUsername = null
      this.checkedUsername = ''
      this.checkToken += 1
      this.keys = null
      this.generatedAuthorities = null
      this.confirmedSaved = false
    },
    loggedInUser: function () { this.init() },
    keys: function (value) { if (!value) this.generatedAuthorities = null }
  },
  computed: {
    globalProps: function () { return this.$hiveStore.globalProps },
    loggedInUser: function () { return this.$hiveStore.user.username },
    account: function () { return this.$hiveStore.accounts[this.loggedInUser] || null },
    liquidHiveBalance: function () {
      const balance = this.account?.balance
      if (typeof balance !== 'string') return 0
      const amount = parseFloat(balance.split(' ')[0])
      return Number.isFinite(amount) ? amount : 0
    },
    accountCreationFee: function () {
      return this.formatAccountCreationFee(this.chainProperties?.account_creation_fee)
    },
    accountCreationFeeAmount: function () {
      const amount = parseFloat(this.accountCreationFee.split(' ')[0])
      return Number.isFinite(amount) && amount > 0 ? amount : 3
    }
  },
  methods: {
    async checkUsernameAvailable (username) {
      const name = String(username || '').trim().toLowerCase()
      const token = ++this.checkToken
      this.availableUsername = null
      this.checkedUsername = ''
      if (!name || this.validateUsername(name) !== null) return false
      try {
        const response = await this.$hive.api.getAccountsAsync([name])
        if (token !== this.checkToken || name !== String(this.newUsername || '').trim().toLowerCase()) return false
        this.availableUsername = response.length === 0
        this.checkedUsername = name
        return this.availableUsername
      } catch (err) {
        console.error(err?.cause?.data || err)
        return false
      }
    },
    validateUsername (username) {
      return validateAccountName(username)
    },
    async genKeys () {
      const username = String(this.newUsername || '').trim().toLowerCase()
      if (this.validateUsername(username) !== null) return
      if (this.availableUsername !== true || this.checkedUsername !== username) {
        const available = await this.checkUsernameAvailable(username)
        if (!available) return
      }
      const password = await createPassword()
      const generated = await generateKeys(username, password)
      this.generatedAuthorities = generated
      this.keys = {
        username,
        password,
        ...generated.privateKeys
      }
    },
    copy (i) { copyToClipboard(i); this.$q.notify('Copied keys to clipboard') },
    openLogin () {
      window.dispatchEvent(new CustomEvent('banksia:open-login'))
    },
    claimAccountToken () {
      if (!this.loggedInUser) return
      const tx = ['claim_account', { creator: this.loggedInUser, fee: '0.000 HIVE', extensions: [] }]
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', tx])
      this.$q.notify({
        message: 'Account token claim queued. Approve it, then create the account.',
        color: 'primary',
        icon: 'generating_tokens',
        position: 'top',
        timeout: 5000
      })
      setTimeout(() => this.init(), 4000)
    },
    async waitForAccount (username, attempts = 24, delayMs = 5000) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const accounts = await this.$hive.api.getAccountsAsync([username])
        if (accounts.length) return accounts[0]
        if (attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
      return null
    },
    async importToSmartlock () {
      if (!this.keys) return
      this.smartlockImporting = true
      try {
        const account = await this.waitForAccount(this.keys.username)
        if (!account) {
          this.$q.notify({
            message: 'The account is not on-chain yet. Wait for the creation transaction, then try again.',
            color: 'orange',
            icon: 'schedule',
            position: 'top',
            timeout: 5000
          })
          return
        }
        const smartlock = (await import('components/smartlock/index.js')).default
        await smartlock.importAccount(
          this.keys.username,
          this.keys.password,
          this.keys.posting,
          this.keys.active,
          this.keys.memo
        )
        this.$q.notify({
          message: 'Imported @' + this.keys.username + ' into SmartLock. Keep the owner key offline.',
          color: 'green',
          icon: 'lock',
          position: 'top',
          timeout: 6000
        })
      } catch (error) {
        this.$q.notify({
          message: error?.message || 'Could not import into SmartLock.',
          color: 'negative',
          icon: 'error',
          position: 'top'
        })
      } finally {
        this.smartlockImporting = false
      }
    },
    linkAccount (account) { return '/@' + account },
    // condenser_api returns the fee as an "x.xxx HIVE" string on Hive, but
    // accept the asset object form too so a node/RPC change cannot break this.
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
    getChainProperties () {
      this.$hive.api.callAsync('condenser_api.get_chain_properties', [])
        .then(props => { if (props) this.chainProperties = props })
        .catch(err => { console.error('Failed to load chain properties', err?.cause?.data || err) })
    },
    async claimAccountWithToken () {
      if (!this.generatedAuthorities) return
      const { owner, active, posting, memo_key: memoKey } = this.generatedAuthorities
      const username = String(this.keys?.username || '').trim().toLowerCase()
      if (!username || username !== String(this.newUsername || '').trim().toLowerCase()) {
        this.$q.notify({ type: 'negative', message: 'The username changed after key generation. Generate keys again.' })
        return
      }
      const delegationOps = await this.delegationOperations(username)
      if (delegationOps === null) return
      var op = {
        creator: this.loggedInUser,
        new_account_name: username,
        owner,
        active,
        posting,
        memo_key: memoKey,
        json_metadata: buildAccountCreationMetadata({ sponsor: this.loggedInUser, via: 'create-page' }),
        extensions: []
      }
      var tx = ['create_claimed_account', op]
      this.queueCreation(tx, delegationOps)
    },
    async claimAccountWithHive () {
      if (!this.generatedAuthorities) return
      const { owner, active, posting, memo_key: memoKey } = this.generatedAuthorities
      const username = String(this.keys?.username || '').trim().toLowerCase()
      if (!username || username !== String(this.newUsername || '').trim().toLowerCase()) {
        this.$q.notify({ type: 'negative', message: 'The username changed after key generation. Generate keys again.' })
        return
      }
      const delegationOps = await this.delegationOperations(username)
      if (delegationOps === null) return
      var op = {
        fee: this.accountCreationFee,
        creator: this.loggedInUser,
        new_account_name: username,
        owner,
        active,
        posting,
        memo_key: memoKey,
        json_metadata: buildAccountCreationMetadata({ sponsor: this.loggedInUser, via: 'create-page' }),
        extensions: []
      }
      var tx = ['account_create', op]
      this.queueCreation(tx, delegationOps)
    },
    async delegationOperations (username) {
      if (!this.delegation.rcEnabled && !this.delegation.hpEnabled) return []
      const rcAmount = this.delegation.rcEnabled
        ? Math.round(Number(this.delegation.rcAmount || 0) * 1e9)
        : 0
      const hpAmount = this.delegation.hpEnabled ? Number(this.delegation.hpAmount || 0) : 0
      let globalProps = null
      if (hpAmount > 0) {
        globalProps = await fetchGlobalProps().catch(() => null)
      }
      try {
        return buildDelegationOperations({
          sponsor: this.loggedInUser,
          account: username,
          rcAmount,
          hpAmount,
          globalProps
        })
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: error?.message || 'The delegation options are invalid.',
          caption: 'Nothing was queued.',
          timeout: 6000
        })
        return null
      }
    },
    queueCreation (tx, delegationOps = []) {
      this.$hiveStore.addToQueue([this.loggedInUser, 'active', tx])
      for (const operation of delegationOps) {
        this.$hiveStore.addToQueue([this.loggedInUser, requiredAuthority(operation) || 'active', operation])
      }
      this.$q.notify({
        message: 'Account creation queued.',
        caption: delegationOps.length
          ? delegationOps.length + ' delegation action' + (delegationOps.length === 1 ? '' : 's') + ' will follow it in the queue.'
          : '',
        color: 'primary',
        icon: 'person_add',
        position: 'top',
        timeout: 6000
      })
    },
    async importToKeychain () {
      if (!this.keys || this.keychainImporting) return
      this.keychainImporting = true
      try {
        const result = await importKeysToKeychain(this.keys)
        this.$q.notify({
          message: result.message,
          color: result.success ? 'green' : 'orange',
          icon: result.success ? 'check_circle' : 'info',
          position: 'top'
        })
      } finally {
        this.keychainImporting = false
      }
    },
    saveKeys () {
      if (this.keys) {
        var status = exportFile(this.keys.username + '-HiveKeys.txt', JSON.stringify(this.keys))
        if (status === true) { this.$q.notify('Downloaded ' + this.keys.username + '-HiveKeys.txt') } else { this.$q.notify(Error + ':' + status) }
      }
    },
    init () {
      if (this.loggedInUser) { this.$hiveStore.getAccount(this.loggedInUser) }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Create a Hive account for someone — Banksia',
      description: 'Create a new Hive account with an account token or HIVE, or ask the new owner to generate a public-key-only claim link and create it without seeing their private keys.',
      url: '/create'
    })
    this.getChainProperties()
  }
}
</script>

<style scoped>
.create-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.create-card {
  width: min(780px, 100%);
  background: var(--c-card);
}

.create-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.create-title {
  margin: 0.2rem 0 var(--space-2);
  font-size: 1.45rem;
  font-weight: 600;
}

.create-copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.88rem;
  line-height: 1.55;
}

.create-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}

.create-warning {
  margin-top: var(--space-3);
  background: color-mix(in srgb, var(--c-warning) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-warning) 30%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.create-warning a {
  color: var(--c-link);
}

.create-form-card,
.create-keys-card {
  background: var(--c-surface-2);
}

.create-available {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: var(--space-2);
  font-size: 0.9rem;
}

.create-available a {
  color: var(--c-link);
}

.create-available--ok {
  color: var(--c-positive);
}

.create-available--bad {
  color: var(--c-negative);
}

.create-form-actions,
.create-key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.create-keys-card {
  margin-top: var(--space-3);
}

.create-keys-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.create-keys-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--c-warning);
}

.create-keys-copy {
  margin-top: 0.2rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.create-signin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  border-top: 1px solid var(--c-border-subtle);
  background: var(--c-surface-2);
}

.create-signin strong {
  display: block;
}

.create-signin p {
  margin: 0.2rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.create-balance {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
  flex-wrap: wrap;
  border-top: 1px solid var(--c-border-subtle);
  background: var(--c-surface-2);
}

.create-balance > div:not(.create-balance__actions) {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.create-balance__label {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.create-balance strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.create-balance__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.create-balance__hint {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

@media (max-width: 599px) {
  .create-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .create-title {
    font-size: 1.25rem;
  }
}
</style>
