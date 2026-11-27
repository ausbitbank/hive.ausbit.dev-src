<template>
    <q-page class="tip-page">
      <div v-if="loading" class="tip-state" aria-live="polite">
        <q-spinner-puff size="2.2em" color="primary" />
        <p>Loading @{{ username || 'account' }}…</p>
      </div>

      <div v-else-if="notFound" class="tip-state">
        <h1 class="tip-state__title">Account not found</h1>
        <p>
          @{{ username || 'that account' }} could not be read from Hive. Check the spelling or
          <router-link to="/">head back home</router-link>.
        </p>
      </div>

      <template v-else-if="account">
        <h1 class="sr-only">Tip @{{ account.name }} with Hive or Lightning</h1>
        <account-header :globalProps="globalProps" :account="account" :showNavBar="false" :showBalances="false" />
        <q-card class="text-center q-ma-md q-pa-md" padding rounded>
          <div class="text-center">
            <transition appear enter-active-class="animated zoomInDown" leave-active-class="animated fadeOut">
            <q-icon name="img:/statics/piggyBank.svg" size="10em" />
            </transition>
          </div>
          <p class="q-ma-sm">{{ username }} accepts donations in <strong class="color-primary">Hive</strong> or over <strong class="color-primary">Lightning</strong> - near instant, secure, no middle-man for Hive transfers.</p>
          <tipButton :account="account.name" />
        </q-card>

        <q-card class="text-left q-ma-md q-pa-md" flat bordered>
          <div class="lightning-eyebrow">Lightning</div>
          <h2 class="tip-lightning__title">Tip @{{ username }} with sats</h2>
          <p class="tip-lightning__lede">
            Any Lightning wallet can pay this account. The bridge settles the payment as HIVE or
            HBD in the Hive wallet. Small invoices lose a fixed ~50 sat fee.
          </p>
          <lightning-address-card
            :account="account.name"
            :show-qr="true"
            :show-receive="true"
            @receive="lightningOpen = true"
          />
        </q-card>

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
import tipButton from 'components/tipButton.vue'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
const LightningReceiveDialog = defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue'))
export default {
  name: 'browsePage',
  components: {
    accountHeader,
    tipButton,
    LightningAddressCard,
    LightningReceiveDialog
  },
  computed: {
    globalProps: {
      get () { return this.$hiveStore.globalProps }
    },
    account: {
      get () {
        return this.$hiveStore.accounts[this.username]
      }
    }
  },
  data () {
    return {
      username: this.normalizeAccount(this.$route.params.username || this.$route.params.account),
      lightningOpen: false,
      loading: true,
      notFound: false
    }
  },
  mounted () {
    this.loadAccount()
  },
  methods: {
    normalizeAccount (value) {
      return String(value || '').trim().replace(/^@/, '').toLowerCase()
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
    }
  }
}
</script>

<style scoped>
.tip-state {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 4rem 1rem;
  color: var(--c-text-subtle);
  text-align: center;
}

.tip-state__title {
  margin: 0;
  color: var(--c-text);
  font-size: 1.4rem;
}

.tip-state a {
  color: var(--c-link);
}

.lightning-eyebrow {
  color: var(--c-warning);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tip-lightning__title {
  margin: 0.15rem 0 0.3rem;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.tip-lightning__lede {
  margin: 0 0 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}
</style>
