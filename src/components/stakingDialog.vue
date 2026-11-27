<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="$hiveStore.accounts[username] !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      Stake {{ tokenName }}
    </q-card-section>
    <q-card-section>
      <div><q-input v-model="toAccount" label="To" /></div>
      <div><q-input label="Amount" v-model="amount" /></div>
      <div class="text-center text-caption" v-if="balance">Available: <button type="button" class="amount-shortcut" :aria-label="'Use available balance ' + balance + ' ' + tokenName" @click="amount = parseFloat(balance)">{{ balance }}</button> {{ tokenName }}</div>
      <div class="text-center text-caption" v-else-if="availableBalance">Available: <button type="button" class="amount-shortcut" :aria-label="'Use available balance ' + availableBalance + ' ' + tokenName" @click="amount = parseFloat(availableBalance)">{{ availableBalance }}</button> {{ tokenName }}</div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ log }}</div>
        <q-btn flat label="Stake" icon="account_balance" color="primary" @click="stake()" v-if="!sent" />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
export default {
  name: 'stakingDialog',
  data () {
    return {
      toAccount: this.username,
      amount: 0.000,
      memo: '',
      err: false,
      log: '',
      sent: false
    }
  },
  props: {
    tokenName: {
      type: String,
      required: true
    },
    network: {
      type: String,
      required: false,
      default: 'hive'
    },
    balance: {
      type: Number,
      required: false,
      default: null
    },
    username: {
      type: String,
      required: true
    },
    precision: {
      type: Number,
      required: false,
      default: 3
    },
    to: {
      type: String,
      required: false,
      default: ''
    }
  },
  components: {},
  computed: {
    availableBalance: function () {
      if (this.network === 'hive' && this.tokenName === 'HIVE') {
        return this.$hiveStore.accounts[this.username].balance.split(' ')[0]
      } else if (this.network === 'hive' && this.tokenName === 'HBD') {
        return this.$hiveStore.accounts[this.username].hbd_balance.split(' ')[0]
      } else {
        return null
      }
    }
  },
  methods: {
    setUsername (u) {
      this.toAccount = u
    },
    stake () {
      if (this.network === 'hive') {
        this.stakeHive()
      } else if (this.network === 'hiveEngine') {
        this.stakeHiveEngine()
      }
    },
    stakeHive () {
      this.$hiveStore.addToQueue([this.username, 'active', ['transfer_to_vesting', { to: this.toAccount, from: this.username, amount: parseFloat(this.amount).toFixed(this.precision) + ' ' + this.tokenName }]])
    },
    stakeHiveEngine () {
      var j = '{ "contractName": "tokens", "contractAction": "stake", "contractPayload": { "symbol": "' + this.tokenName + '", "to": "' + this.toAccount + '", "quantity": "' + this.amount + '" } }'
      var cj = {
        required_auths: [this.username],
        required_posting_auths: [],
        id: 'ssc-mainnet-hive',
        json: j
      }
      this.$hiveStore.addToQueue([this.username, 'active', ['custom_json', cj]])
    }
  },
  mounted () {
    if (this.$hiveStore.accounts[this.username] === undefined) { this.$hiveStore.getAccount(this.username) }
  }
}
</script>

<style scoped>
.amount-shortcut {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.amount-shortcut:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 1px;
  border-radius: var(--radius-sm);
}
</style>
