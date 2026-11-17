<template>
    <q-page v-if="account !== undefined">
        <account-header :globalProps="globalProps" :account="account" :showNavBar="false" :showBalances="false" />
        <q-card class="text-center q-ma-md q-pa-md" padding rounded>
          <div class="text-center">
            <transition appear enter-active-class="animated zoomInDown" leave-active-class="animated fadeOut">
            <q-icon name="img:/statics/piggyBank.svg" size="10em" />
            </transition>
          </div>
          <p class="q-ma-sm">{{ username }} accepts donations in <strong class="color-primary">Hive</strong> - Near instant, secure, free transactions with no middle-man.</p>
          <tipButton :account="account.name" />
        </q-card>
    </q-page>
</template>
<script>
import accountHeader from 'components/accountHeader.vue'
import tipButton from 'components/tipButton.vue'
export default {
  name: 'browsePage',
  components: {
    accountHeader,
    tipButton
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
      username: this.$route.params.username || this.$route.params.account
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
