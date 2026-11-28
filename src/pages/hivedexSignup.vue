<template>
  <q-page class="hivedex-page">
    <div class="hivedex-shell">
      <page-header
        eyebrow="Join Hive"
        title="Create an account with Hivedex"
        intro="Generate your keys in this browser, pay Hivedex in crypto, and keep the private keys. Hivedex only receives your public keys. Payment is handled by Hivedex on its own checkout page."
      >
        <template #actions>
          <q-btn no-caps flat color="primary" icon="arrow_back" label="Back to join" to="/join" />
        </template>
      </page-header>

      <q-banner class="hivedex-banner hivedex-banner--provider" rounded>
        <template #avatar><q-icon name="verified_user" color="primary" aria-hidden="true" /></template>
        <div class="hivedex-banner__row">
          <div>
            <strong>Provided by Hivedex.</strong>
            <div class="hivedex-banner__copy">
              Anonymous crypto signup. Current price
              <strong>{{ priceLoading ? '…' : priceLabel }}</strong><span v-if="priceAssetsLabel"> · {{ priceAssetsLabel }}</span>.
              Banksia does not process the payment and never sees your private keys.
            </div>
          </div>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="open_in_new"
            label="hivedex.io"
            href="https://hivedex.io/signup"
            target="_blank"
            rel="noopener noreferrer"
          />
        </div>
      </q-banner>

      <q-banner v-if="savedOrder && !invoice" class="hivedex-banner hivedex-banner--info" rounded>
        <template #avatar><q-icon name="restore" color="primary" aria-hidden="true" /></template>
        <div class="hivedex-banner__row">
          <div>
            <strong>Unfinished Hivedex order for @{{ savedOrder.username }}.</strong>
            <div class="hivedex-banner__copy">
              The payment link and order status are saved in this browser. Your keys are not saved;
              use the backup you downloaded when you created them.
            </div>
          </div>
          <div class="hivedex-banner__actions">
            <q-btn no-caps unelevated color="primary" label="Resume order" @click="resumeOrder()" />
            <q-btn no-caps flat color="primary" label="Forget" @click="forgetSavedOrder()" />
          </div>
        </div>
      </q-banner>

      <div class="hivedex-layout">
        <q-card flat bordered class="hivedex-card">
          <template v-if="!invoice">
            <q-card-section>
              <div class="hivedex-step">
                <span class="hivedex-step__num">1</span>
                <div>
                  <h2 class="hivedex-step__title">Choose your username</h2>
                  <p class="hivedex-step__copy">Your username is permanent. It cannot be changed after creation.</p>
                </div>
              </div>

              <div class="hivedex-username">
                <q-input
                  v-model="username"
                  label="Username"
                  outlined
                  dense
                  autocomplete="off"
                  spellcheck="false"
                  :error="Boolean(usernameError)"
                  :error-message="usernameError"
                  :loading="checking"
                  :disable="Boolean(invoice)"
                  @blur="checkUsernameAvailability()"
                  @keyup.enter="checkUsernameAvailability()"
                >
                  <template #prepend><span class="hivedex-at">@</span></template>
                </q-input>
                <q-btn
                  no-caps
                  outline
                  color="primary"
                  label="Check availability"
                  :loading="checking"
                  :disable="Boolean(invoice) || Boolean(validateUsername(username))"
                  @click="checkUsernameAvailability()"
                />
              </div>

              <div v-if="available === true" class="hivedex-status hivedex-status--ok" role="status">
                <q-icon name="check_circle" size="16px" aria-hidden="true" />
                <strong>@{{ username }}</strong> is available.
              </div>
              <div v-else-if="available === false" class="hivedex-status hivedex-status--bad" role="status">
                <q-icon name="error" size="16px" aria-hidden="true" />
                <strong>@{{ username }}</strong> is already registered.
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="hivedex-step">
                <span class="hivedex-step__num">2</span>
                <div>
                  <h2 class="hivedex-step__title">Create your keys</h2>
                  <p class="hivedex-step__copy">Keys are generated locally. Hivedex receives only the public keys.</p>
                </div>
              </div>

              <q-btn
                v-if="!keys"
                no-caps
                unelevated
                color="primary"
                icon="enhanced_encryption"
                label="Generate keys"
                :disable="available !== true"
                @click="generateKeysForUser()"
              />
              <p v-else class="hivedex-step__copy">Keys generated for <strong>@{{ keys.username }}</strong>.</p>
            </q-card-section>

            <template v-if="keys">
              <q-separator />
              <q-card-section>
                <div class="hivedex-step">
                  <span class="hivedex-step__num">3</span>
                  <div>
                    <h2 class="hivedex-step__title">Save your backup</h2>
                    <p class="hivedex-step__copy">This is the only copy. Hive has no password reset.</p>
                  </div>
                </div>

                <q-banner class="hivedex-banner hivedex-banner--warning" rounded>
                  <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
                  <strong>Download the backup before you pay.</strong>
                  <div class="hivedex-banner__copy">
                    Hivedex never sees your password or private keys. Banksia cannot recover them.
                  </div>
                </q-banner>

                <div class="hivedex-key-list" aria-label="New account credentials">
                  <div v-for="row in keyRows" :key="row.label" class="hivedex-key-row">
                    <span class="hivedex-key-row__label">{{ row.label }}</span>
                    <code class="hivedex-key-row__value">{{ row.value }}</code>
                    <q-btn dense flat round icon="content_copy" :aria-label="'Copy ' + row.label" @click="copy(row.value, row.label)" />
                  </div>
                </div>

                <div class="hivedex-actions">
                  <q-btn no-caps outline color="primary" icon="download" label="Download backup" @click="downloadKeys()" />
                  <q-btn no-caps outline color="primary" icon="content_copy" label="Copy all" @click="copy(JSON.stringify(keys, null, 2), 'keys')" />
                  <q-btn
                    no-caps
                    outline
                    color="primary"
                    icon="img:/statics/hive-keychain.svg"
                    label="Import keys to Hive Keychain"
                    :loading="keychainImporting"
                    @click="importToKeychain()"
                  />
                </div>

                <q-checkbox v-model="confirmedSaved" label="I saved my password and keys in a secure place" class="hivedex-confirm" />
                <div class="hivedex-fingerprint">
                  Key fingerprint <code>{{ fingerprint || '…' }}</code>
                </div>
              </q-card-section>

              <q-separator />
              <q-card-section>
                <div class="hivedex-step">
                  <span class="hivedex-step__num">4</span>
                  <div>
                    <h2 class="hivedex-step__title">Create the payment invoice</h2>
                    <p class="hivedex-step__copy">
                      Hivedex will show a crypto checkout. Pay there and return to this tab; it
                      checks the chain and confirms the account.
                    </p>
                  </div>
                </div>

                <q-banner v-if="invoiceError" class="hivedex-banner hivedex-banner--error" rounded>
                  <template #avatar><q-icon name="error" color="negative" aria-hidden="true" /></template>
                  {{ invoiceError }}
                </q-banner>

                <div class="hivedex-actions">
                  <q-btn
                    no-caps
                    unelevated
                    color="primary"
                    icon="paid"
                    :label="!priceInfo ? 'Create invoice' : 'Create invoice for ' + priceLabel"
                    :loading="creatingInvoice"
                    :disable="!confirmedSaved || creatingInvoice || !priceInfo"
                    @click="createPaymentInvoice()"
                  />
                  <q-btn no-caps flat color="primary" icon="refresh" label="Refresh price" :loading="priceLoading" @click="loadPrice(true)" />
                </div>

                <p class="hivedex-hint">
                  The invoice is created with your public keys. Creating an invoice does not charge
                  you; the payment page is the next step.
                </p>
              </q-card-section>
            </template>
          </template>

          <template v-else>
            <q-card-section>
              <div class="hivedex-order-head">
                <div>
                  <div class="hivedex-eyebrow">Hivedex order</div>
                  <h2 class="hivedex-order-title">@{{ username }}</h2>
                  <div class="hivedex-order-meta">
                    <span>Order <code>{{ invoice.trackId }}</code></span>
                    <span v-if="fingerprint">Key fingerprint <code>{{ fingerprint }}</code></span>
                  </div>
                </div>
                <q-badge :color="statusColor" class="hivedex-status-badge">{{ statusLabel }}</q-badge>
              </div>

              <q-banner class="hivedex-banner hivedex-banner--warning" rounded>
                <template #avatar><q-icon name="warning" color="warning" aria-hidden="true" /></template>
                <strong>Keep this tab open.</strong>
                <div class="hivedex-banner__copy">
                  Pay on the Hivedex checkout page. This tab polls the order and the Hive chain. If
                  you close it, use “Resume order” later; your downloaded backup is still required
                  to import the account.
                </div>
              </q-banner>

              <div class="hivedex-pay-card">
                <div>
                  <div class="hivedex-eyebrow">Payment</div>
                  <div class="hivedex-pay-price">{{ priceLabel }}</div>
                  <div class="hivedex-pay-copy">
                    Hivedex checkout supports the crypto assets it shows on its payment page.
                    Payment and refunds are handled by Hivedex.
                  </div>
                </div>
                <q-btn
                  no-caps
                  unelevated
                  color="primary"
                  icon="open_in_new"
                  label="Open Hivedex payment page"
                  :href="invoice.payLink"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </div>

              <div class="hivedex-actions">
                <q-btn no-caps outline color="primary" icon="refresh" label="Check status now" :loading="checkingStatus" @click="checkStatus()" />
                <q-btn v-if="status === 'expired'" no-caps flat color="primary" icon="restart_alt" label="Create a new invoice" :loading="creatingInvoice" @click="replaceInvoice()" />
                <q-btn no-caps flat color="primary" icon="delete_sweep" label="Start over" @click="startOver()" />
              </div>

              <q-banner v-if="statusError" class="hivedex-banner hivedex-banner--error" rounded>
                <template #avatar><q-icon name="error" color="negative" aria-hidden="true" /></template>
                {{ statusError }}
              </q-banner>

              <div v-if="status === 'paid' && !accountExists" class="hivedex-waiting">
                <q-spinner color="primary" size="20px" />
                <div>
                  <strong>Payment received. Waiting for Hivedex to create the account.</strong>
                  <div class="hivedex-banner__copy">This can take a short while. This page checks the chain every few seconds.</div>
                </div>
              </div>

              <div v-if="accountExists" class="hivedex-result" :class="keysMatch === false ? 'hivedex-result--bad' : 'hivedex-result--ok'">
                <q-icon :name="keysMatch === true ? 'check_circle' : keysMatch === false ? 'report' : 'help_outline'" size="24px" aria-hidden="true" />
                <div>
                  <strong v-if="keysMatch === false">The account exists, but its keys do not match this order.</strong>
                  <strong v-else-if="keysMatch === true">Account created with your keys.</strong>
                  <strong v-else>Account exists — keys not verified.</strong>
                  <p v-if="keysMatch === false">
                    Do not reuse this order. Choose another username and create a new invoice.
                  </p>
                  <p v-else-if="keysMatch === true">
                    @{{ username }} is live. The new owner should import their backup into SmartLock
                    or Hive Keychain and keep the owner key offline.
                  </p>
                  <p v-else>
                    Verify the account keys against the saved order before treating this as complete.
                  </p>
                  <div class="hivedex-actions">
                    <q-btn no-caps outline color="primary" :to="'/@' + username" :label="'View @' + username" />
                    <q-btn v-if="keys" no-caps flat color="primary" icon="lock" label="Import to SmartLock" @click="importToSmartlock()" />
                    <q-btn v-if="keys" no-caps flat color="primary" icon="img:/statics/hive-keychain.svg" label="Import keys to Hive Keychain" :loading="keychainImporting" @click="importToKeychain()" />
                  </div>
                </div>
              </div>

              <q-expansion-item v-if="keys" class="hivedex-keys-expand" dense icon="key" label="Your keys (still only in this browser)">
                <div class="hivedex-key-list">
                  <div v-for="row in keyRows" :key="row.label" class="hivedex-key-row">
                    <span class="hivedex-key-row__label">{{ row.label }}</span>
                    <code class="hivedex-key-row__value">{{ row.value }}</code>
                    <q-btn dense flat round icon="content_copy" :aria-label="'Copy ' + row.label" @click="copy(row.value, row.label)" />
                  </div>
                </div>
                <div class="hivedex-actions">
                  <q-btn no-caps outline color="primary" icon="download" label="Download backup again" @click="downloadKeys()" />
                </div>
              </q-expansion-item>
            </q-card-section>
          </template>
        </q-card>

        <aside class="hivedex-aside">
          <q-card flat bordered class="hivedex-aside-card">
            <q-card-section>
              <div class="hivedex-eyebrow">How it works</div>
              <ol class="hivedex-aside-list">
                <li>You generate a password and keys in this browser.</li>
                <li>Hivedex receives the four public keys and a payment link.</li>
                <li>You pay on the Hivedex checkout page.</li>
                <li>Hivedex creates the account; this page verifies the chain and shows the account.</li>
              </ol>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="hivedex-aside-card">
            <q-card-section>
              <div class="hivedex-eyebrow">Safety</div>
              <p class="hivedex-aside-copy">
                Banksia never sees your private keys. Hivedex never receives them either. Never
                paste your password or private keys into a chat, email or website.
              </p>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="hivedex-aside-card">
            <q-card-section>
              <div class="hivedex-eyebrow">Price</div>
              <div class="hivedex-aside-price">{{ priceLoading ? '…' : priceLabel }}</div>
              <p class="hivedex-aside-copy">
                Dynamic price from Hivedex. Payment assets and network fees are shown on the
                checkout page. Banksia does not add a fee.
              </p>
              <p v-if="priceError" class="hivedex-aside-copy hivedex-aside-copy--error">{{ priceError }}</p>
              <q-btn no-caps flat color="primary" icon="refresh" label="Refresh price" :loading="priceLoading" @click="loadPrice(true)" />
            </q-card-section>
          </q-card>
        </aside>
      </div>

      <p class="hivedex-footnote">
        Hivedex is an independent community service. Banksia does not operate it, does not process
        payments, and cannot issue refunds. Always keep a copy of the master password and keys.
      </p>
    </div>
  </q-page>
</template>

<script>
import { copyToClipboard, exportFile } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { validateAccountName } from 'src/services/hiveNames'
import { pollWhileVisible } from 'src/services/polling'
import { createPassword, generateKeys } from 'src/services/hiveTx'
import { importKeysToKeychain } from 'src/services/keychainAccounts'
import { authoritiesMatchKeys, buildClaimPayload, claimFingerprint, publicKeysFromAuthorities } from 'src/services/accountClaim'
import {
  createInvoice,
  getInvoiceStatus,
  getPrice,
  HIVEDEX_STATUS,
  safeHivedexPayLink
} from 'src/services/hivedex'
import PageHeader from 'components/ui/PageHeader.vue'

const ORDER_KEY = 'banksia_hivedex_order_v1'
const STATUS_POLL_MS = 5000
const STATUS_POLL_ATTEMPTS = 120
const ACCOUNT_POLL_MS = 5000
const ACCOUNT_POLL_ATTEMPTS = 24

const STATUS_LABELS = {
  [HIVEDEX_STATUS.NEW]: 'Waiting for payment',
  [HIVEDEX_STATUS.WAITING]: 'Waiting for payment',
  [HIVEDEX_STATUS.PAYING]: 'Payment processing',
  [HIVEDEX_STATUS.PAID]: 'Paid',
  [HIVEDEX_STATUS.EXPIRED]: 'Invoice expired',
  [HIVEDEX_STATUS.UNKNOWN]: 'Checking order'
}

const STATUS_COLORS = {
  [HIVEDEX_STATUS.NEW]: 'primary',
  [HIVEDEX_STATUS.WAITING]: 'primary',
  [HIVEDEX_STATUS.PAYING]: 'orange',
  [HIVEDEX_STATUS.PAID]: 'green',
  [HIVEDEX_STATUS.EXPIRED]: 'red',
  [HIVEDEX_STATUS.UNKNOWN]: 'grey'
}

export default {
  name: 'hivedexSignupPage',
  components: { PageHeader },
  data () {
    return {
      username: '',
      usernameError: '',
      checking: false,
      available: null,
      keys: null,
      generatedAuthorities: null,
      confirmedSaved: false,
      keychainImporting: false,
      fingerprint: '',
      priceInfo: null,
      priceLoading: false,
      priceError: '',
      invoice: null,
      invoiceError: '',
      creatingInvoice: false,
      status: '',
      statusError: '',
      checkingStatus: false,
      accountExists: false,
      accountCreated: null,
      keysMatch: null,
      resumePublicKeys: null,
      checkingAccount: false,
      savedOrder: null,
      statusPoller: null,
      statusCount: 0,
      accountPoller: null,
      accountCount: 0
    }
  },
  computed: {
    priceLabel () {
      const price = Number(this.priceInfo?.price)
      if (!Number.isFinite(price) || price <= 0) return 'price unavailable'
      return '$' + price.toFixed(2)
    },
    priceAssetsLabel () {
      const assets = this.priceInfo?.assets
      if (!Array.isArray(assets) || !assets.length) return ''
      const names = assets.map(asset => asset?.currency).filter(Boolean)
      if (!names.length) return ''
      const shown = names.slice(0, 6).join(', ')
      return shown + (names.length > 6 ? ' +' + (names.length - 6) + ' more' : '')
    },
    statusLabel () {
      return STATUS_LABELS[this.status] || 'Waiting for payment'
    },
    statusColor () {
      return STATUS_COLORS[this.status] || 'primary'
    },
    keyRows () {
      if (!this.keys) return []
      return [
        { label: 'Master password', value: this.keys.password },
        { label: 'Owner key', value: this.keys.owner },
        { label: 'Active key', value: this.keys.active },
        { label: 'Posting key', value: this.keys.posting },
        { label: 'Memo key', value: this.keys.memo }
      ]
    }
  },
  watch: {
    username (value) {
      this.available = null
      this.usernameError = value ? (validateAccountName(value.trim().toLowerCase()) || '') : ''
      if (this.keys && value.trim().toLowerCase() !== this.keys.username) {
        this.resetGenerated()
      }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Create a Hive account with Hivedex — Banksia',
      description: 'Generate keys locally and pay Hivedex in crypto to create a Hive account. Hivedex receives public keys only; Banksia never sees private keys.',
      url: '/join/hivedex'
    })
    this.loadPrice()
    this.loadSavedOrder()
    if (this.$route.query.resume && this.savedOrder) {
      this.resumeOrder()
    }
  },
  beforeUnmount () {
    this.stopStatusPolling()
    this.stopAccountPolling()
  },
  methods: {
    validateUsername (value) {
      return validateAccountName(String(value || '').trim().toLowerCase())
    },
    async loadPrice (force = false) {
      this.priceLoading = true
      this.priceError = ''
      try {
        const price = await getPrice({ force })
        this.priceInfo = price
      } catch (error) {
        this.priceError = error?.message || 'Could not load the Hivedex price.'
      } finally {
        this.priceLoading = false
      }
    },
    async checkUsernameAvailability () {
      const name = String(this.username || '').trim().toLowerCase()
      this.username = name
      this.usernameError = this.validateUsername(name) || ''
      if (this.usernameError) {
        this.available = null
        return false
      }
      this.checking = true
      try {
        const accounts = await this.$hive.api.getAccountsAsync([name])
        if (name !== String(this.username || '').trim().toLowerCase()) return false
        this.available = accounts.length === 0
        return this.available
      } catch {
        this.available = null
        this.usernameError = 'Could not check that username. Try again.'
        return false
      } finally {
        this.checking = false
      }
    },
    async generateKeysForUser () {
      const name = String(this.username || '').trim().toLowerCase()
      this.username = name
      this.usernameError = this.validateUsername(name) || ''
      if (this.usernameError || this.available !== true) return

      try {
        const password = await createPassword()
        const generated = await generateKeys(name, password)
        const publicKeys = publicKeysFromAuthorities(generated)
        this.keys = { username: name, password, ...generated.privateKeys }
        this.generatedAuthorities = generated
        this.fingerprint = await claimFingerprint(buildClaimPayload({ username: name, ...publicKeys }))
        this.confirmedSaved = false
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: error?.message || 'Could not generate keys.',
          position: 'top'
        })
      }
    },
    resetGenerated () {
      this.keys = null
      this.generatedAuthorities = null
      this.fingerprint = ''
      this.confirmedSaved = false
    },
    async createPaymentInvoice () {
      if (!this.keys || !this.confirmedSaved || this.creatingInvoice) return
      this.creatingInvoice = true
      this.invoiceError = ''
      try {
        const available = await this.checkUsernameAvailability()
        if (!available) return
        const publicKeys = publicKeysFromAuthorities(this.generatedAuthorities)
        const returnUrl = window.location.origin + '/join/hivedex?resume=1'
        const invoice = await createInvoice({
          username: this.keys.username,
          ...publicKeys,
          returnUrl,
          referrer: 'ausbitbank'
        })
        this.invoice = invoice
        this.status = HIVEDEX_STATUS.NEW
        this.statusError = ''
        this.accountExists = false
        this.accountCreated = null
        this.keysMatch = null
        const order = {
          username: this.keys.username,
          trackId: invoice.trackId,
          orderId: invoice.orderId,
          payLink: invoice.payLink,
          fingerprint: this.fingerprint,
          publicKeys: publicKeysFromAuthorities(this.generatedAuthorities),
          createdAt: Date.now()
        }
        this.savedOrder = order
        this.$q.localStorage.set(ORDER_KEY, order)
        this.startStatusPolling()
        this.$q.notify({
          message: 'Invoice created. Open the Hivedex payment page to pay.',
          color: 'primary',
          icon: 'paid',
          position: 'top',
          timeout: 6000
        })
      } catch (error) {
        this.invoiceError = error?.message || 'Could not create a Hivedex invoice.'
      } finally {
        this.creatingInvoice = false
      }
    },
    async replaceInvoice () {
      if (!this.keys) {
        this.startOver()
        return
      }
      this.invoice = null
      this.stopStatusPolling()
      this.stopAccountPolling()
      this.confirmedSaved = true
      await this.createPaymentInvoice()
    },
    loadSavedOrder () {
      const order = this.$q.localStorage.getItem(ORDER_KEY)
      if (!order || !order.username || !order.trackId || !safeHivedexPayLink(order.payLink)) {
        this.savedOrder = null
        if (order) this.$q.localStorage.remove(ORDER_KEY)
        return
      }
      this.savedOrder = order
    },
    resumeOrder () {
      const order = this.savedOrder
      if (!order) return
      this.username = order.username
      this.invoice = {
        payLink: order.payLink,
        trackId: order.trackId,
        orderId: order.orderId || ''
      }
      this.fingerprint = order.fingerprint || ''
      this.keys = null
      this.generatedAuthorities = null
      this.resumePublicKeys = order.publicKeys || null
      this.confirmedSaved = false
      this.status = HIVEDEX_STATUS.NEW
      this.statusError = ''
      this.accountExists = false
      this.accountCreated = null
      this.keysMatch = null
      this.checkStatus()
      this.startStatusPolling()
    },
    forgetSavedOrder () {
      this.$q.localStorage.remove(ORDER_KEY)
      this.savedOrder = null
    },
    startStatusPolling () {
      this.stopStatusPolling()
      this.statusCount = 0
      this.statusPoller = pollWhileVisible(async () => {
        if (this.checkingStatus) return
        this.statusCount += 1
        await this.checkStatus()
        if (this.status === HIVEDEX_STATUS.PAID || this.status === HIVEDEX_STATUS.EXPIRED || this.statusCount >= STATUS_POLL_ATTEMPTS) {
          this.stopStatusPolling()
        }
      }, STATUS_POLL_MS, { immediate: false })
      this.statusPoller.start()
    },
    stopStatusPolling () {
      this.statusPoller?.stop()
      this.statusPoller = null
    },
    async checkStatus () {
      if (!this.invoice?.trackId) return
      this.checkingStatus = true
      this.statusError = ''
      try {
        const status = await getInvoiceStatus(this.invoice.trackId)
        this.status = status
        if (status === HIVEDEX_STATUS.PAID) {
          this.stopStatusPolling()
          this.startAccountPolling()
        }
        if (status === HIVEDEX_STATUS.EXPIRED) {
          this.stopStatusPolling()
        }
      } catch (error) {
        this.statusError = error?.message || 'Could not check the Hivedex order.'
      } finally {
        this.checkingStatus = false
      }
    },
    startAccountPolling () {
      this.stopAccountPolling()
      this.accountCount = 0
      this.checkAccount()
      this.accountPoller = pollWhileVisible(async () => {
        if (this.checkingAccount) return
        this.accountCount += 1
        await this.checkAccount()
        if (this.accountExists || this.accountCount >= ACCOUNT_POLL_ATTEMPTS) {
          this.stopAccountPolling()
        }
      }, ACCOUNT_POLL_MS, { immediate: false })
      this.accountPoller.start()
    },
    stopAccountPolling () {
      this.accountPoller?.stop()
      this.accountPoller = null
    },
    async checkAccount () {
      if (!this.username) return
      this.checkingAccount = true
      try {
        const accounts = await this.$hive.api.getAccountsAsync([this.username])
        if (accounts.length) {
          this.accountExists = true
          this.accountCreated = accounts[0]
          this.keysMatch = this.keys
            ? this.accountMatchesPayload(accounts[0])
            : this.resumePublicKeys
              ? authoritiesMatchKeys(accounts[0], this.resumePublicKeys)
              : null
          this.stopAccountPolling()
          // Keep the order when the chain keys do not match or cannot be
          // verified, so the user can see and act on the mismatch.
          if (this.keysMatch === true) {
            this.$q.localStorage.remove(ORDER_KEY)
            this.savedOrder = null
          }
        } else {
          this.accountExists = false
          this.accountCreated = null
          this.keysMatch = null
        }
      } catch {
        // Keep the current state; the user can retry with “Check status now”.
      } finally {
        this.checkingAccount = false
      }
    },
    accountMatchesPayload (account) {
      if (!this.generatedAuthorities) return null
      return authoritiesMatchKeys(account, publicKeysFromAuthorities(this.generatedAuthorities))
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
    async importToSmartlock () {
      if (!this.keys) return
      try {
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
      }
    },
    startOver () {
      const hasOrder = Boolean(this.invoice)
      const reset = () => {
        this.stopStatusPolling()
        this.stopAccountPolling()
        this.$q.localStorage.remove(ORDER_KEY)
        this.savedOrder = null
        this.invoice = null
        this.status = ''
        this.statusError = ''
        this.invoiceError = ''
        this.accountExists = false
        this.accountCreated = null
        this.keysMatch = null
        this.username = ''
        this.usernameError = ''
        this.available = null
        this.resetGenerated()
      }
      if (!hasOrder) {
        reset()
        return
      }
      this.$q.dialog({
        title: 'Start over?',
        message: 'This clears the saved Hivedex order in this browser. A paid order is not refunded here; check the Hivedex checkout page first.',
        cancel: true,
        persistent: true,
        ok: { label: 'Start over', color: 'negative' }
      }).onOk(reset)
    },
    downloadKeys () {
      if (!this.keys) return
      const status = exportFile(this.keys.username + '-HiveKeys.txt', JSON.stringify(this.keys, null, 2))
      if (status === true) {
        this.$q.notify({ message: 'Downloaded ' + this.keys.username + '-HiveKeys.txt', color: 'primary', icon: 'download', position: 'top' })
      } else {
        this.$q.notify({ message: 'Could not download the backup: ' + status, color: 'negative', icon: 'error', position: 'top' })
      }
    },
    copy (value, label) {
      copyToClipboard(String(value || ''))
      this.$q.notify({ message: label + ' copied.', color: 'primary', icon: 'content_copy', position: 'top', timeout: 1600 })
    }
  }
}
</script>

<style scoped>
.hivedex-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.hivedex-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.hivedex-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: var(--space-4);
  align-items: start;
}

.hivedex-card {
  background: var(--c-card);
}

.hivedex-banner {
  margin: var(--space-3) 0;
  color: var(--c-text);
}

.hivedex-banner--provider {
  background: color-mix(in srgb, var(--c-primary) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-primary) 30%, transparent);
}

.hivedex-banner--warning {
  background: color-mix(in srgb, var(--c-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
}

.hivedex-banner--info {
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-primary) 35%, transparent);
}

.hivedex-banner--error {
  background: color-mix(in srgb, var(--c-negative) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-negative) 35%, transparent);
}

.hivedex-banner__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.hivedex-banner__copy {
  margin-top: 0.25rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.hivedex-banner__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.hivedex-step {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.hivedex-step__num {
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

.hivedex-step__title {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 600;
}

.hivedex-step__copy {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.55;
}

.hivedex-username {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: start;
}

.hivedex-at {
  color: var(--c-text-faint);
  font-weight: 600;
}

.hivedex-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: var(--space-2);
  font-size: 0.82rem;
}

.hivedex-status--ok {
  color: var(--c-positive);
}

.hivedex-status--bad {
  color: var(--c-negative);
}

.hivedex-key-list {
  margin: var(--space-3) 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.hivedex-key-row {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid var(--c-border-subtle);
}

.hivedex-key-row:last-child {
  border-bottom: 0;
}

.hivedex-key-row__label {
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.hivedex-key-row__value {
  min-width: 0;
  overflow: hidden;
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hivedex-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.hivedex-confirm {
  margin-top: var(--space-3);
  font-size: 0.85rem;
}

.hivedex-fingerprint {
  margin-top: var(--space-2);
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.hivedex-fingerprint code {
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
}

.hivedex-hint {
  margin: var(--space-2) 0 0;
  color: var(--c-text-faint);
  font-size: 0.75rem;
  line-height: 1.5;
}

.hivedex-order-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.hivedex-eyebrow {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.hivedex-order-title {
  margin: 0.1rem 0 0.3rem;
  font-size: 1.4rem;
  font-weight: 600;
}

.hivedex-order-meta {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  color: var(--c-text-faint);
  font-size: 0.74rem;
}

.hivedex-order-meta code {
  color: var(--c-text-subtle);
  font-family: var(--font-mono);
}

.hivedex-status-badge {
  font-variant-numeric: tabular-nums;
}

.hivedex-pay-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin: var(--space-3) 0;
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.hivedex-pay-price {
  margin-top: 0.1rem;
  font-size: 1.45rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hivedex-pay-copy {
  margin-top: 0.2rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
  max-width: 380px;
}

.hivedex-waiting {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--c-primary) 30%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-primary) 8%, transparent);
}

.hivedex-result {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
}

.hivedex-result--ok {
  color: var(--c-positive);
  background: color-mix(in srgb, var(--c-positive) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-positive) 30%, transparent);
}

.hivedex-result--bad {
  color: var(--c-negative);
  background: color-mix(in srgb, var(--c-negative) 8%, transparent);
  border-color: color-mix(in srgb, var(--c-negative) 30%, transparent);
}

.hivedex-result p {
  margin: 0.25rem 0 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.5;
}

.hivedex-keys-expand {
  margin-top: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.hivedex-aside {
  display: grid;
  gap: var(--space-3);
}

.hivedex-aside-card {
  background: var(--c-card);
}

.hivedex-aside-list {
  margin: var(--space-2) 0 0;
  padding-left: 1.1rem;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
  line-height: 1.55;
}

.hivedex-aside-list li + li {
  margin-top: 0.4rem;
}

.hivedex-aside-copy {
  margin: var(--space-2) 0 var(--space-3);
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.5;
}

.hivedex-aside-price {
  margin: var(--space-2) 0;
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hivedex-aside-copy--error {
  color: var(--c-negative);
}

.hivedex-footnote {
  margin: var(--space-4) 0 0;
  color: var(--c-text-faint);
  font-size: 0.74rem;
  line-height: 1.5;
}

@media (max-width: 899px) {
  .hivedex-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .hivedex-page {
    padding: var(--space-4) var(--space-3) var(--space-5);
  }

  .hivedex-username {
    grid-template-columns: minmax(0, 1fr);
  }

  .hivedex-key-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .hivedex-key-row__label {
    grid-column: 1 / -1;
  }
}
</style>
