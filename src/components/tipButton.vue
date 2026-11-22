<template>
  <span class="tip-button">
    <q-btn flat no-caps class="tip-button__btn" aria-label="Send this account a tip" title="Send a tip" @click="dialog = !dialog">
      <q-icon name="volunteer_activism" size="17px" aria-hidden="true" />
      <span class="tip-button__label">Send a tip</span>
      <span v-if="coins.length" class="tip-button__coins" aria-hidden="true">
        <q-icon v-for="coin in coins" :key="coin" :name="returnCoinSvg(coin)" size="13px" />
      </span>
      <q-icon name="img:/statics/hive.svg" size="14px" aria-hidden="true" />
      <q-icon name="img:/statics/hbd.svg" size="14px" aria-hidden="true" />
    </q-btn>
    <tip-dialog v-if="dialog" :account="account" :accountData="accountData" :accountMeta="accountMeta" :coins="coins" />
  </span>
</template>
<script>
import tipDialog from 'components/tipDialog.vue'
export default {
  name: 'tipButton',
  components: {
    tipDialog
  },
  data () {
    return {
      supportedCoins: ['bitcoin', 'litecoin', 'ethereum', 'dogecoin', 'lightning'],
      dialog: false
    }
  },
  props: ['account'],
  computed: {
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
          Object.keys(this.accountMeta.profile).forEach(e => this.supportedCoins.includes(e) ? userCoins.push(e) : null)
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
      return 'img:/statics/' + coin + (coin === 'lightning' ? '.webp' : '.svg')
    }
  },
  mounted () {
    if (this.$hiveStore.accounts[this.account] === undefined) {
      this.$hiveStore.getAccount(this.account)
    }
  }
}
</script>

<style scoped>
.tip-button__btn.q-btn {
  gap: 0.35rem;
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--c-link) 35%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: var(--c-link-hover);
  font-size: 0.8rem;
  font-weight: 600;
}

.tip-button__btn.q-btn .q-icon {
  font-size: 17px;
  color: inherit;
}

.tip-button__btn.q-btn:hover {
  border-color: color-mix(in srgb, var(--c-link) 60%, transparent);
  background: color-mix(in srgb, var(--c-link) 12%, transparent);
  color: var(--c-link-soft);
}

.tip-button__coins {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  margin-left: auto;
  padding-left: 0.35rem;
  opacity: 0.65;
}
</style>
