<template>
  <span>
    <q-btn outline rounded color="primary" class="q-ma-none q-pa-none hvr" @click="dialog = !dialog">
      <q-icon v-for="coin in coins" :key="coin.index" :name="returnCoinSvg(coin)" /><q-icon name="img:statics/hive.svg" /><q-icon name="img:statics/hbd.svg" class="q-mr-md" /> Send {{ account }} a tip
    </q-btn>
    <tip-dialog v-if="dialog" :account="account" :accountData="accountData" :accountMeta="accountMeta" :coins="coins" />
  </span>
</template>
<style>
</style>
<script>
import tipDialog from 'components/tipDialog.vue'
export default {
  name: 'tipButton',
  components: {
    tipDialog
  },
  data () {
    return {
      supportedCoins: ['bitcoin', 'litecoin', 'ethereum', 'dogecoin'],
      dialog: false
    }
  },
  props: ['account'],
  computed: {
    accountData: function () {
      if (this.$store.state.hive.accounts[this.account] !== undefined) {
        return this.$store.state.hive.accounts[this.account]
      } else {
        return null
      }
    },
    accountMeta: function () {
      if (this.accountData) {
        if (this.accountData.posting_json_metadata) {
          return JSON.parse(this.accountData.posting_json_metadata)
        } else {
          return null
        }
      } else {
        return null
      }
    },
    coins: function () {
      var userCoins = []
      if (this.accountMeta) {
        Object.keys(this.accountMeta.profile).forEach(e => this.supportedCoins.includes(e) ? userCoins.push(e) : console.log())
        return userCoins
      } else {
        return []
      }
    }
  },
  methods: {
    returnCoinSvg (coin) {
      return 'img:statics/' + coin + '.svg'
    }
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.account] === undefined) {
      this.$store.dispatch('hive/getAccount', this.account)
    }
  }
}
</script>
