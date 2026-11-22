<template>
  <q-page class="lightning-page">
    <header class="lightning-hero">
      <div class="lightning-hero__copy">
        <div class="lightning-hero__eyebrow">Hive ↔ Bitcoin Lightning</div>
        <h1 class="lightning-hero__title">Lightning</h1>
        <p class="lightning-hero__lede">
          Receive sats as HIVE or HBD, or spend HIVE and HBD on any Lightning invoice. Payments are
          bridged by <a href="https://v4v.app" target="_blank" rel="noopener noreferrer">v4v.app</a>;
          this site never holds your keys or your sats.
        </p>
      </div>
      <div class="lightning-hero__mark" aria-hidden="true">
        <img src="/statics/lightning.webp" alt="" />
      </div>
    </header>

    <section v-if="payQuery && !loggedInUser" class="lightning-link-banner" role="status">
      <q-icon name="bolt" size="20px" aria-hidden="true" />
      <div>
        <strong>A Lightning payment link is ready.</strong>
        <p>Log in with Keychain, SmartLock or HiveAuth from the header to review and pay it with HBD or HIVE.</p>
        <code>{{ payQueryLabel }}</code>
      </div>
    </section>

    <section class="lightning-account-bar" aria-label="Choose a Hive account">
      <div class="lightning-account-bar__label">Hive account</div>
      <user-search-box :username="account" label="Search accounts" @selectUsername="selectAccount" />
      <q-btn
        v-if="account"
        flat
        dense
        no-caps
        color="amber-9"
        icon="content_copy"
        label="Copy address"
        @click="copyAddress"
      />
    </section>

    <template v-if="account">
      <div class="lightning-grid">
        <section class="lightning-grid__main" aria-labelledby="lightning-address-title">
          <h2 id="lightning-address-title" class="lightning-section-title">Receive</h2>
          <lightning-address-card
            :account="account"
            :show-qr="true"
          />
          <div class="lightning-actions">
            <q-btn
              v-if="loggedInUser"
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              icon="bolt"
              label="Create a fixed invoice"
              @click="receiveOpen = true"
            />
            <span v-else class="lightning-login-hint">
              Log in with the account menu above to create invoices and pay.
            </span>
            <q-btn
              v-if="loggedInUser"
              outline
              no-caps
              color="amber-9"
              icon="send"
              label="Pay a Lightning invoice"
              @click="payOpen = true"
            />
          </div>
        </section>

        <aside class="lightning-grid__side">
          <section class="lightning-card" aria-labelledby="lightning-how-title">
            <h2 id="lightning-how-title" class="lightning-card__title">How it works</h2>
            <ol class="lightning-steps">
              <li>
                <strong>Receive.</strong> Share the Lightning address or QR. The sender pays sats;
                @v4vapp sends HIVE or HBD to @{{ account }}.
              </li>
              <li>
                <strong>Pay.</strong> Paste an invoice. The site queues a Hive/HBD transfer to
                @v4vapp with the invoice in the memo. You review and sign it.
              </li>
              <li>
                <strong>Confirm.</strong> The Hive transfer and the bridge notification are public;
                the wallet labels both as Lightning activity.
              </li>
            </ol>
          </section>

          <section class="lightning-card lightning-card--fees" aria-labelledby="lightning-fees-title">
            <h2 id="lightning-fees-title" class="lightning-card__title">Fees and limits</h2>
            <ul class="lightning-fees">
              <li>Hive → Lightning: about <strong>{{ feePercentLabel }} + {{ feeFixedLabel }} sats</strong>.</li>
              <li>Small incoming invoices lose the fixed {{ feeFixedLabel }} sat fee. Prefer {{ preferredSatsLabel }} sats or more.</li>
              <li>Maximum <strong>{{ feeMaxLabel }} sats</strong> per invoice. Bridge limits change; the live quote wins.</li>
              <li>If a Lightning payment fails, v4vapp refunds the Hive/HBD deposit, minus its fee.</li>
            </ul>
            <p class="lightning-card__note">
              {{ feeSourceNote }}
            </p>
          </section>

          <section class="lightning-card" aria-labelledby="lightning-privacy-title">
            <h2 id="lightning-privacy-title" class="lightning-card__title">Before you pay</h2>
            <p class="lightning-card__note">
              Lightning invoices reveal the amount and destination to v4v.app, and Hive transfer
              memos are public. Do not put personal information in a memo. Keepsats are held by
              v4v.app, not by hive.ausbit.dev.
            </p>
          </section>
        </aside>
      </div>
    </template>

    <section v-else class="lightning-empty">
      <q-icon name="bolt" size="2em" aria-hidden="true" />
      <h2>Choose an account</h2>
      <p>Search for a Hive account above, or log in to use your own.</p>
    </section>

    <lightning-receive-dialog
      v-if="account && receiveOpen"
      v-model="receiveOpen"
      :account="account"
      default-currency="hbd"
      :default-amount="1"
      @paid="onPaid"
    />
    <lightning-pay-dialog
      v-if="account && loggedInUser && payOpen"
      v-model="payOpen"
      :account="loggedInUser"
      :liquid-hive="liquidHive"
      :liquid-hbd="liquidHbd"
      :initial-input="payPrefill"
      :initial-sats="1000"
      @queued="onQueued"
    />
  </q-page>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { copyToClipboard } from 'quasar'
import { setPageMeta } from 'src/utils/pageMeta'
import { isValidHiveAccount, lightningAddress, normalizeFeePolicy } from 'src/services/lightning'
import { bridgeFeePolicy, getBridgeStatus } from 'src/services/v4vapp'
import UserSearchBox from 'components/userSearchBox.vue'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
const LightningReceiveDialog = defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue'))
const LightningPayDialog = defineAsyncComponent(() => import('components/lightning/LightningPayDialog.vue'))

export default {
  name: 'LightningPage',
  components: {
    UserSearchBox,
    LightningAddressCard,
    LightningReceiveDialog,
    LightningPayDialog
  },
  data () {
    return {
      account: '',
      receiveOpen: false,
      payOpen: false,
      payPrefill: '',
      feePolicy: normalizeFeePolicy({}),
      feePolicyLive: false
    }
  },
  computed: {
    payQuery () {
      return String(this.$route.query.pay || '').trim()
    },
    payQueryLabel () {
      const value = this.payQuery
      return value.length > 80 ? value.slice(0, 54) + '…' + value.slice(-18) : value
    },
    feePercentLabel () {
      return (Math.round(this.feePolicy.percent * 1000) / 10) + '%'
    },
    feeFixedLabel () {
      return Number(this.feePolicy.fixed || 0).toLocaleString('en-US')
    },
    feeMaxLabel () {
      return Number(this.feePolicy.maxSats || 0).toLocaleString('en-US')
    },
    preferredSatsLabel () {
      return Math.max(1000, Number(this.feePolicy.minSats) || 0).toLocaleString('en-US')
    },
    feeSourceNote () {
      if (this.feePolicyLive) {
        return 'Values read from the bridge on this visit. The payment dialog refreshes them and labels every estimate.'
      }
      return 'These are the bridge defaults because its live configuration could not be read. The payment dialog prefers the live values whenever the bridge is reachable.'
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    liquidHive () {
      const account = this.$hiveStore.accounts[this.loggedInUser]
      return parseFloat(String(account?.balance || '0').split(' ')[0]) || 0
    },
    liquidHbd () {
      const account = this.$hiveStore.accounts[this.loggedInUser]
      return parseFloat(String(account?.hbd_balance || '0').split(' ')[0]) || 0
    }
  },
  watch: {
    '$route.params.account' () {
      this.syncFromRoute()
    },
    '$route.query.account' () {
      this.syncFromRoute()
    },
    '$route.query.pay' () {
      this.preparePayLink()
    },
    loggedInUser (value) {
      if (!this.account && value) this.selectAccount(value)
      if (value) {
        this.$hiveStore.getAccount(value)
        if (this.payQuery) this.preparePayLink()
      }
    }
  },
  created () {
    this.syncFromRoute()
    if (!this.account && this.loggedInUser) this.selectAccount(this.loggedInUser, { replace: true })
    setPageMeta({
      title: 'Lightning — receive sats as Hive or pay Lightning invoices',
      description: 'Use the v4v.app bridge to receive Bitcoin Lightning payments as HIVE or HBD, and pay Lightning invoices with Hive.',
      url: '/lightning'
    })
  },
  mounted () {
    if (this.loggedInUser) this.$hiveStore.getAccount(this.loggedInUser)
    this.preparePayLink()
    this.loadFeePolicy()
  },
  methods: {
    async loadFeePolicy () {
      try {
        const status = await getBridgeStatus()
        if (!status?.config) return
        this.feePolicy = bridgeFeePolicy(status)
        this.feePolicyLive = true
      } catch {
        // Defaults stay visible and are labelled as such.
      }
    },
    preparePayLink () {
      const value = this.payQuery
      if (!value) return
      this.payPrefill = value
      if (this.loggedInUser) {
        if (!this.account) this.selectAccount(this.loggedInUser, { replace: true })
        this.payOpen = true
      }
    },
    syncFromRoute () {
      const fromRoute = this.$route.params.account || this.$route.query.account || ''
      if (fromRoute && fromRoute !== this.account) {
        this.account = fromRoute
      }
    },
    selectAccount (value, { replace = false } = {}) {
      const name = String(value || '').trim().replace(/^@/, '').toLowerCase()
      if (!name) return
      if (!isValidHiveAccount(name)) {
        this.$q.notify({ message: 'That is not a valid Hive account name.', color: 'orange', timeout: 3000, position: 'top' })
        return
      }
      this.account = name
      const query = { ...this.$route.query, account: name }
      this.$router[replace ? 'replace' : 'push']({ name: 'lightning', query }).catch(() => {})
      this.$hiveStore.getAccount(name)
    },
    copyAddress () {
      const address = lightningAddress(this.account, 'hive')
      Promise.resolve(copyToClipboard(address)).then(() => {
        this.$q.notify({ message: 'Copied ' + address, color: 'primary', icon: 'content_copy', timeout: 2000, position: 'top' })
      })
    },
    onPaid () {
      this.$hiveStore.getAccount(this.account, { force: true })
    },
    onQueued () {
      if (this.loggedInUser) this.$hiveStore.getAccount(this.loggedInUser, { force: true })
    }
  }
}
</script>

<style scoped>
.lightning-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.lightning-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: clamp(1.1rem, 3vw, 2rem);
  border: 1px solid color-mix(in srgb, var(--c-warning) 18%, transparent);
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 92% 12%, color-mix(in srgb, var(--c-warning) 14%, transparent), transparent 38%),
    radial-gradient(circle at 4% 100%, color-mix(in srgb, var(--c-link) 8%, transparent), transparent 40%),
    color-mix(in srgb, var(--c-text) 2%, transparent);
}

.lightning-hero__eyebrow {
  color: var(--c-warning);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.lightning-hero__title {
  margin: 0.2rem 0 0.35rem;
  color: var(--c-warning-soft);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.lightning-hero__lede {
  max-width: 68ch;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.86rem;
  line-height: 1.55;
}

.lightning-hero__lede a {
  color: var(--c-warning-soft);
}

.lightning-hero__mark img {
  width: clamp(72px, 10vw, 120px);
  height: auto;
  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--c-warning) 28%, transparent));
}

.lightning-link-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: var(--space-3);
  padding: 0.7rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
}

.lightning-link-banner strong {
  display: block;
  color: var(--c-warning-soft);
  font-size: 0.82rem;
}

.lightning-link-banner p {
  margin: 0.15rem 0 0.3rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
}

.lightning-link-banner code {
  color: var(--c-text-subtle);
  font-size: 0.66rem;
  overflow-wrap: anywhere;
}

.lightning-account-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.lightning-account-bar__label {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.lightning-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 1fr);
  gap: var(--space-4);
  align-items: start;
}

.lightning-grid__main,
.lightning-grid__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.lightning-section-title {
  margin: 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.lightning-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.lightning-login-hint {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.lightning-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.lightning-card__title {
  margin: 0;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.lightning-card__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.45;
}

.lightning-steps,
.lightning-fees {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.5;
}

.lightning-steps li,
.lightning-fees li {
  margin-bottom: 0.35rem;
}

.lightning-steps strong,
.lightning-fees strong {
  color: var(--c-text-soft);
}

.lightning-card--fees {
  border-color: color-mix(in srgb, var(--c-warning) 20%, transparent);
  background: color-mix(in srgb, var(--c-warning) 3%, transparent);
}

.lightning-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.5rem 1rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card);
  color: var(--c-text-faint);
  text-align: center;
}

.lightning-empty h2 {
  margin: 0;
  color: var(--c-text-muted);
  font-size: 1rem;
}

.lightning-empty p {
  margin: 0;
  font-size: 0.78rem;
}

@media (max-width: 900px) {
  .lightning-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .lightning-hero__mark {
    display: none;
  }
}
</style>
