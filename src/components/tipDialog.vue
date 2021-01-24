<template>
  <q-list bordered separator dense>
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:statics/hextacular.svg" title="Hive" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          Hive
        </q-item-label>
        <q-item-label caption>
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
        <q-avatar><q-icon name="img:statics/hextacular.svg" title="Hive" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          Hive Dollars
        </q-item-label>
        <q-item-label caption>
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
        <q-item-label caption>
          <a :href="returnCoinLink(coin)" :title="accountMeta.profile[coin]">{{ accountMeta.profile[coin].substr(0,20) }}</a>..
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round type="a" :href="returnCoinLink(coin)" icon="send" title="Open Wallet Client" color="primary" class="hvr" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" color="blue-grey" title="Copy address to clipboard" @click="copy(accountMeta.profile[coin])" class="hvr"/>
      </q-item-section>
    </q-item>
  </q-list>
</template>
<style>
</style>
<script>
import transferDialog from 'components/transferDialog.vue'
import { copyToClipboard } from 'quasar' // eslint-disable-line no-unused-vars
export default {
  name: 'tipDialog',
  components: { transferDialog },
  data () {
    return {
      supportedCoins: ['bitcoin', 'litecoin', 'ethereum'],
      hivetransfer: false,
      hivedollartransfer: false
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
    },
    returnCoinLink (coin) {
      return coin + ':' + this.accountMeta.profile[coin]
    },
    copy (input) {
      copyToClipboard(input)
      this.$q.notify('Copied to clipboard: ' + input)
    }
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.account] === undefined) {
      console.log('dispatch sent to get account info for ' + this.account)
      this.$store.dispatch('hive/getAccount', this.account)
    }
  }
}
</script>
