<template>
    <q-page v-if="account !== undefined">
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
          default-note="Lightning tip from hive.ausbit.dev"
        />
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
      username: this.$route.params.username || this.$route.params.account,
      lightningOpen: false
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.account === undefined) {
      this.$hiveStore.getAccount(this.username)
    }
  }
}
</script>

<style scoped>
.lightning-eyebrow {
  color: #b0a06a;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tip-lightning__title {
  margin: 0.15rem 0 0.3rem;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.tip-lightning__lede {
  margin: 0 0 0.6rem;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}
</style>
