<template>
  <q-page class="tip-page">
    <div v-if="loading" class="tip-shell" aria-live="polite" aria-busy="true">
      <q-card flat bordered class="tip-loading">
        <q-skeleton type="rect" height="9.5rem" />
        <div class="tip-loading__body">
          <q-skeleton type="text" width="42%" />
          <q-skeleton type="text" />
          <q-skeleton type="text" width="72%" />
        </div>
      </q-card>
      <span class="sr-only">Loading @{{ username || 'account' }}…</span>
    </div>

    <div v-else-if="notFound" class="tip-shell">
      <q-card flat bordered class="tip-state">
        <q-icon name="person_search" size="2.4em" class="tip-state__icon" aria-hidden="true" />
        <h1 class="tip-state__title">Account not found</h1>
        <p class="tip-state__copy">
          @{{ username || 'that account' }} could not be read from Hive. Check the spelling, or
          head back and find the account another way.
        </p>
        <div class="tip-state__actions">
          <q-btn unelevated no-caps color="primary" icon="home" label="Back home" to="/" />
          <q-btn flat no-caps color="primary" label="Browse accounts" to="/browse" />
        </div>
      </q-card>
    </div>

    <template v-else-if="account">
      <account-header
        :globalProps="globalProps"
        :account="account"
        headingTag="div"
        :showNavBar="false"
        :showBalances="false"
      />

      <div class="tip-shell">
        <header class="tip-hero">
          <div class="tip-hero__copy">
            <p class="tip-eyebrow">Tips</p>
            <h1 class="tip-hero__title">Send @{{ username }} a tip</h1>
            <p class="tip-hero__lede">
              Tips go straight to @{{ username }}'s Hive wallet. Send HIVE or HBD directly, or pay
              over Lightning in sats — no platform cut and no custodial wallet.
            </p>
            <ul class="tip-hero__rails" aria-label="Accepted tip methods">
              <li><img src="/statics/hive.svg" alt="" aria-hidden="true" /> HIVE</li>
              <li><img src="/statics/hbd.svg" alt="" aria-hidden="true" /> HBD</li>
              <li><img src="/statics/lightning.webp" alt="" aria-hidden="true" /> Lightning</li>
            </ul>
            <div class="tip-hero__actions">
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="volunteer_activism"
                label="Send a tip"
                class="tip-cta"
                @click="tipOpen = true"
              />
              <a class="tip-hero__secondary" href="#lightning-tip">or tip with Lightning</a>
            </div>
            <p v-if="!loggedInUser" class="tip-hero__hint">
              <q-icon name="info" size="1rem" aria-hidden="true" />
              <span>No login is needed to pay over Lightning — scan the QR with any wallet. Log in from the top bar to send HIVE or HBD from Banksia.</span>
            </p>
          </div>
          <span class="tip-hero__mark" aria-hidden="true" />
        </header>

        <section id="lightning-tip" class="tip-lightning" aria-labelledby="tip-lightning-title">
          <div class="tip-lightning__copy">
            <p class="tip-eyebrow tip-eyebrow--lightning">Bitcoin Lightning</p>
            <h2 id="tip-lightning-title" class="tip-lightning__title">Tip @{{ username }} with sats</h2>
            <p class="tip-lightning__lede">
              Any Lightning wallet can pay @{{ username }}. Scan the QR or copy the address; the
              v4v.app bridge settles the payment as HIVE or HBD in their Hive wallet.
            </p>
            <ul class="tip-lightning__facts">
              <li>
                <q-icon name="bolt" aria-hidden="true" />
                <span><strong>Instant.</strong> Lightning settles in seconds, not blocks.</span>
              </li>
              <li>
                <q-icon name="payments" aria-hidden="true" />
                <span><strong>Small-invoice fee.</strong> Tiny invoices lose a fixed ~50 sat bridge fee.</span>
              </li>
              <li>
                <q-icon name="shield" aria-hidden="true" />
                <span><strong>Non-custodial.</strong> Banksia never holds your sats or keys.</span>
              </li>
            </ul>
          </div>
          <div class="tip-lightning__card">
            <lightning-address-card
              :account="account.name"
              :show-qr="true"
              :show-receive="true"
              @receive="lightningOpen = true"
            />
          </div>
        </section>
      </div>

      <q-dialog v-model="tipOpen" aria-labelledby="tip-dialog-title">
        <q-card class="tip-dialog-card">
          <q-card-section class="tip-dialog-card__head">
            <div>
              <p class="tip-eyebrow">Send a tip</p>
              <h2 id="tip-dialog-title" class="tip-dialog-card__title">Tip @{{ username }}</h2>
            </div>
            <q-btn flat round dense icon="close" aria-label="Close tip options" v-close-popup />
          </q-card-section>
          <q-card-section class="tip-dialog-card__body">
            <p class="tip-dialog-card__lede">
              Choose a method. Hive and HBD transfers are signed in your own wallet.
            </p>
            <p v-if="!loggedInUser" class="tip-dialog-card__hint">
              <q-icon name="info" size="1rem" aria-hidden="true" />
              <span>Log in from the top bar to send HIVE or HBD. To tip over Lightning, scan the QR on the page with any wallet.</span>
            </p>
            <tip-dialog :account="account.name" />
          </q-card-section>
        </q-card>
      </q-dialog>

      <lightning-receive-dialog
        v-if="lightningOpen"
        v-model="lightningOpen"
        :account="account.name"
        default-currency="hbd"
        :default-amount="5"
        default-note="Lightning tip from banksia.io"
      />
    </template>
  </q-page>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import accountHeader from 'components/accountHeader.vue'
import tipDialog from 'components/tipDialog.vue'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
import { setPageMeta } from 'src/utils/pageMeta'
const LightningReceiveDialog = defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue'))

export default {
  name: 'TipPage',
  components: {
    accountHeader,
    tipDialog,
    LightningAddressCard,
    LightningReceiveDialog
  },
  data () {
    return {
      username: this.normalizeAccount(this.$route.params.username || this.$route.params.account),
      lightningOpen: false,
      tipOpen: false,
      loading: true,
      notFound: false
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    }
  },
  watch: {
    '$route.params.account' () {
      this.syncFromRoute()
    },
    '$route.params.username' () {
      this.syncFromRoute()
    }
  },
  created () {
    this.updateMeta()
  },
  mounted () {
    this.loadAccount()
  },
  methods: {
    normalizeAccount (value) {
      return String(value || '').trim().replace(/^@/, '').toLowerCase()
    },
    syncFromRoute () {
      const next = this.normalizeAccount(this.$route.params.username || this.$route.params.account)
      if (next === this.username) return
      this.username = next
      this.tipOpen = false
      this.lightningOpen = false
      this.updateMeta()
      this.loadAccount()
    },
    async loadAccount () {
      this.loading = true
      this.notFound = false
      try {
        if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
        if (!this.username) {
          this.notFound = true
          return
        }
        if (this.account === undefined) {
          await this.$hiveStore.getAccount(this.username)
        }
        this.notFound = this.account === undefined
      } finally {
        this.loading = false
      }
    },
    updateMeta () {
      if (!this.username) return
      setPageMeta({
        title: 'Tip @' + this.username + ' — Hive and Lightning — banksia.io',
        description: 'Send @' + this.username + ' a tip with HIVE, HBD or Bitcoin Lightning. Direct transfers, instant sats and no custodial wallet.',
        url: '/@' + this.username + '/tip'
      })
    }
  }
}
</script>

<style scoped>
.tip-page {
  background: var(--c-bg);
}

.tip-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.tip-loading {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--c-card);
}

.tip-loading__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem;
}

.tip-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 2.6rem 1.1rem;
  border-radius: var(--radius-card);
  background: var(--c-card);
  text-align: center;
}

.tip-state__icon {
  color: var(--c-text-faint);
}

.tip-state__title {
  margin: 0;
  color: var(--c-text);
  font-size: 1.35rem;
}

.tip-state__copy {
  max-width: 46ch;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.84rem;
  line-height: 1.5;
}

.tip-state__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.tip-eyebrow {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tip-eyebrow--lightning {
  color: var(--c-warning);
}

.tip-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  overflow: hidden;
  padding: clamp(1.1rem, 2.5vw, 1.8rem);
  border: 1px solid color-mix(in srgb, var(--c-warning) 16%, transparent);
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--c-warning) 12%, transparent), transparent 42%),
    radial-gradient(circle at 5% 100%, color-mix(in srgb, var(--c-link) 7%, transparent), transparent 40%),
    color-mix(in srgb, var(--c-text) 2%, transparent);
}

.tip-hero__copy {
  min-width: 0;
}

.tip-hero__title {
  margin: 0.25rem 0 0.5rem;
  color: var(--c-text);
  font-size: clamp(1.6rem, 3vw, 2.15rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.tip-hero__lede {
  max-width: 62ch;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.88rem;
  line-height: 1.55;
}

.tip-hero__rails {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
}

.tip-hero__rails li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-soft);
  font-size: 0.7rem;
  font-weight: 600;
}

.tip-hero__rails img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.tip-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 0.9rem;
  margin-top: 1rem;
}

.tip-cta.q-btn {
  min-height: 44px;
  padding: 0 1.2rem;
  border-radius: var(--radius-pill);
  font-size: 0.88rem;
  font-weight: 600;
  box-shadow: var(--shadow-card);
}

.tip-hero__secondary {
  color: var(--c-warning-soft);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
}

.tip-hero__secondary:hover,
.tip-hero__secondary:focus-visible {
  text-decoration: underline;
}

.tip-hero__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  max-width: 62ch;
  margin: 0.7rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.45;
}

.tip-hero__hint .q-icon {
  flex: none;
  margin-top: 1px;
}

.tip-hero__mark {
  display: block;
  width: 132px;
  height: 165px;
  justify-self: center;
  background: linear-gradient(160deg, var(--c-warning-soft), var(--c-warning) 58%, var(--c-secondary));
  opacity: 0.9;
  -webkit-mask: url('/statics/piggyBank.svg') center / contain no-repeat;
  mask: url('/statics/piggyBank.svg') center / contain no-repeat;
}

.tip-lightning {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(300px, 1.1fr);
  align-items: start;
  gap: var(--space-4);
  padding: clamp(1rem, 2vw, 1.4rem);
  border: 1px solid color-mix(in srgb, var(--c-warning) 18%, transparent);
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--c-warning) 7%, transparent), transparent 52%),
    var(--c-card);
  scroll-margin-top: 84px;
}

.tip-lightning__copy {
  min-width: 0;
}

.tip-lightning__title {
  margin: 0.2rem 0 0.45rem;
  color: var(--c-text);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.25;
}

.tip-lightning__lede {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.55;
}

.tip-lightning__facts {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
}

.tip-lightning__facts li {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  color: var(--c-text-faint);
  font-size: 0.74rem;
  line-height: 1.45;
}

.tip-lightning__facts .q-icon {
  flex: none;
  margin-top: 1px;
  color: var(--c-warning);
  font-size: 1rem;
}

.tip-lightning__facts strong {
  color: var(--c-text-soft);
  font-weight: 600;
}

.tip-lightning__card {
  min-width: 0;
}

.tip-lightning__card :deep(.lightning-address-card) {
  border-color: var(--border-subtle);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.tip-dialog-card {
  width: min(460px, 94vw);
  max-width: 94vw;
  border-radius: var(--radius-card);
  background: var(--c-dialog);
}

.tip-dialog-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding-bottom: 0.35rem;
}

.tip-dialog-card__title {
  margin: 0.15rem 0 0;
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.tip-dialog-card__body {
  padding-top: 0.35rem;
}

.tip-dialog-card__lede {
  margin: 0 0 0.55rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.tip-dialog-card__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0 0 0.6rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.45;
}

.tip-dialog-card__hint .q-icon {
  flex: none;
  margin-top: 1px;
}

.tip-dialog-card__body :deep(.q-list) {
  border-radius: 0.5rem;
  overflow: hidden;
}

.tip-dialog-card__body :deep(.q-item__label--caption) {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .tip-hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .tip-hero__mark {
    display: none;
  }

  .tip-lightning {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .tip-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .tip-hero__title {
    font-size: 1.55rem;
  }

  .tip-cta.q-btn {
    width: 100%;
  }

  .tip-hero__actions {
    align-items: stretch;
  }

  .tip-hero__secondary {
    text-align: center;
  }
}
</style>
