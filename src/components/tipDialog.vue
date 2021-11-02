<template>
  <q-list bordered separator class="bg-dark">
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:statics/hive.svg" title="Hive" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          Hive
        </q-item-label>
        <q-item-label caption v-if="false">
          {{ account }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="send" title="Login (top right) to enable transfers" color="primary" @click="hivetransfer = true" :disabled="!this.$store.state.hive.user.username" class="hvr"/>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" title="Copy address to clipboard" color="blue-grey" @click="copy(account)" class="hvr"/>
      </q-item-section>
      <q-dialog v-model="hivetransfer">
        <transfer-dialog tokenName="HIVE" network="hive" :to="account" :username="this.$store.state.hive.user.username" />
      </q-dialog>
    </q-item>
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:statics/hbd.svg" title="Hive Dollars" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          Hive Dollars
        </q-item-label>
        <q-item-label caption v-if="false">
          {{ account }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="send" title="Login (top right) to enable transfers" color="primary" @click="hivedollartransfer = true" :disabled="!this.$store.state.hive.user.username" class="hvr" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" color="blue-grey" title="Copy address to clipboard" @click="copy(account)" class="hvr"/>
      </q-item-section>
      <q-dialog v-model="hivedollartransfer">
        <transfer-dialog tokenName="HBD" network="hive" :to="account" :username="this.$store.state.hive.user.username" />
      </q-dialog>
    </q-item>
    <q-item v-if="!accountData">
      <q-spinner-pie color="primary" size="sm" />
    </q-item>
    <q-item clickable v-for="coin in coins" :key="coin.index">
      <q-item-section avatar>
        <q-avatar size="lg"><q-icon :name="returnCoinSvg(coin)" :title="coin" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ coin }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round type="a" :href="returnCoinLink(coin)" icon="send" title="Open Wallet Client" color="primary" class="hvr" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" color="blue-grey" title="Copy address to clipboard" @click="copy(accountMeta.profile[coin])" class="hvr"/>
      </q-item-section>
    </q-item>
    <q-item clickable v-for="token in tokens" :key="token.index">
      <q-item-section avatar>
        <q-avatar size="lg"><q-img :src="getTokenImage(token)" :title="token" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ token }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round type="a" :href="getExchangeLink(account, token, accountMeta.profile.tokens[token])" icon="swap_vertical_circle" title="Exchange" color="orange" class="hvr" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" color="blue-grey" title="Copy address to clipboard" @click="copy(accountMeta.profile.tokens[token])" class="hvr"/>
      </q-item-section>
    </q-item>
  </q-list>
</template>
<style>
</style>
<script>
import transferDialog from 'components/transferDialog.vue'
import { copyToClipboard } from 'quasar'
export default {
  name: 'tipDialog',
  components: { transferDialog }, // metamask
  data () {
    return {
      supportedCoins: ['bitcoin', 'litecoin', 'ethereum', 'dogecoin', 'lightning'],
      supportedTokens: [],
      hivetransfer: false,
      hivedollartransfer: false,
      ethFromAddress: null
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
        if ('profile' in this.accountMeta) {
          Object.keys(this.accountMeta.profile).forEach(e => this.supportedCoins.includes(e) ? userCoins.push(e) : this.noop())
          return userCoins
        } else {
          return []
        }
      } else {
        return []
      }
    },
    tokens: function () {
      var userTokens = []
      if (this.accountMeta) {
        if ('profile' in this.accountMeta) {
          if ('tokens' in this.accountMeta.profile) { Object.keys(this.accountMeta.profile.tokens).forEach(e => this.supportedTokens.includes(e) ? userTokens.push(e) : this.noop()) }
          return userTokens
        } else {
          return []
        }
      } else {
        return []
      }
    }
  },
  methods: {
    returnCoinSvg (coin) {
      if (coin === 'lightning') { return 'img:statics/' + coin + '.png' } else { return 'img:statics/' + coin + '.svg' }
    },
    returnCoinLink (coin) {
      return coin + ':' + this.accountMeta.profile[coin]
    },
    copy (input) {
      copyToClipboard(input)
      this.$q.notify('Copied to clipboard: ' + input)
    },
    getTokens () {
      this.$axios.get('https://exchange-api.ausbit.dev/getCurrencies')
        .then((res) => { this.supportedTokens = res.data.result.sort() })
    },
    getTokenImage (token) { return 'https://web-api.changelly.com/api/coins/' + token.toLowerCase() + '.png' },
    getExchangeLink (username, token, address) { return 'https://hive.ausbit.dev/exchange?for=' + username + '&to=' + token + '&address=' + address },
    noop () {}
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.account] === undefined) {
      console.log('dispatch sent to get account info for ' + this.account)
      this.$store.dispatch('hive/getAccount', this.account)
    }
    if (this.accountMeta.profile && this.accountMeta.profile.tokens) { this.getTokens() }
  }
}
</script>
