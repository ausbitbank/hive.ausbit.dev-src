<template>
  <q-list bordered separator class="surface-1">
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:/statics/hive.svg" title="Hive" /></q-avatar>
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
        <q-btn dense round icon="send" title="Login (top right) to enable transfers" color="primary" @click="hivetransfer = true" :disabled="!$hiveStore.user.username" class="hvr"/>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" title="Copy address to clipboard" color="blue-grey" @click="copy(account)" class="hvr"/>
      </q-item-section>
      <q-dialog v-model="hivetransfer">
        <transfer-dialog tokenName="HIVE" network="hive" :to="account" :username="$hiveStore.user.username" />
      </q-dialog>
    </q-item>
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:/statics/hbd.svg" title="Hive Dollars" /></q-avatar>
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
        <q-btn dense round icon="send" title="Login (top right) to enable transfers" color="primary" @click="hivedollartransfer = true" :disabled="!$hiveStore.user.username" class="hvr" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" color="blue-grey" title="Copy address to clipboard" @click="copy(account)" class="hvr"/>
      </q-item-section>
      <q-dialog v-model="hivedollartransfer">
        <transfer-dialog tokenName="HBD" network="hive" :to="account" :username="$hiveStore.user.username" />
      </q-dialog>
    </q-item>
    <q-item clickable>
      <q-item-section avatar>
        <q-avatar><q-icon name="img:/statics/lightning.webp" title="Lightning" /></q-avatar>
      </q-item-section>
      <q-item-section>
        <q-item-label>Lightning</q-item-label>
        <q-item-label caption>{{ lightningAddress }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="send" title="Tip with Lightning" color="amber-9" @click="showLightning = true" />
      </q-item-section>
      <q-item-section side>
        <q-btn dense round icon="content_copy" title="Copy Lightning address" color="blue-grey" @click="copy(lightningAddress)" />
      </q-item-section>
      <q-dialog v-if="showLightning" v-model="showLightning">
        <lightning-receive-dialog
          :account="account"
          v-model="showLightning"
          default-currency="hbd"
          :default-amount="5"
          default-note="Lightning tip from hive.ausbit.dev"
        />
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
  </q-list>
</template>
<style>
</style>
<script>
import { defineAsyncComponent } from 'vue'
import transferDialog from 'components/transferDialog.vue'
const LightningReceiveDialog = defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue'))
import { copyToClipboard } from 'quasar'
import { lightningAddress } from 'src/services/lightning'
export default {
  name: 'tipDialog',
  components: { transferDialog, LightningReceiveDialog }, // metamask
  data () {
    return {
      supportedCoins: ['bitcoin', 'litecoin', 'ethereum', 'dogecoin', 'lightning'],
      hivetransfer: false,
      hivedollartransfer: false,
      showLightning: false,
      ethFromAddress: null
    }
  },
  props: ['account'],
  computed: {
    lightningAddress: function () {
      return lightningAddress(this.account, 'hive')
    },
    accountData: function () {
      if (this.$hiveStore.accounts[this.account] !== undefined) {
        return this.$hiveStore.accounts[this.account]
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
          Object.keys(this.accountMeta.profile).forEach(e => (this.supportedCoins.includes(e) && e !== 'lightning') ? userCoins.push(e) : this.noop())
          return userCoins
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
      if (coin === 'lightning') { return 'img:/statics/' + coin + '.webp' } else { return 'img:/statics/' + coin + '.svg' }
    },
    returnCoinLink (coin) {
      return coin + ':' + this.accountMeta.profile[coin]
    },
    copy (input) {
      copyToClipboard(input)
      this.$q.notify('Copied to clipboard: ' + input)
    },
    noop () {}
  },
  mounted () {
    if (this.$hiveStore.accounts[this.account] === undefined) {
      this.$hiveStore.getAccount(this.account)
    }
  }
}
</script>
