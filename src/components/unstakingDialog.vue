<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="this.$store.state.hive.accounts[this.username] !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      Unstake {{ tokenName }}
    </q-card-section>
    <q-card-section>
      <div><q-input label="Amount" v-model="amount" /></div>
      <div class="text-center text-caption" v-if="balance">Available: <span class="cursor-pointer text-bold" @click="amount = parseFloat(balance)">{{ balance }}</span> {{ tokenName }}</div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ this.log }}</div>
        <q-btn flat label="Unstake" icon="lock_open" color="primary" @click="unstake()" v-if="!sent" />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
export default {
  name: 'unstakingDialog',
  data () {
    return {
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
        return this.$store.state.hive.accounts[this.username].balance.split(' ')[0]
      } else if (this.network === 'hive' && this.tokenName === 'HBD') {
        return this.$store.state.hive.accounts[this.username].hbd_balance.split(' ')[0]
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
        this.stakeHiveEngineKeychain()
      }
    },
    stakeHive () {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['transfer_to_vesting', { to: this.toAccount, from: this.username, amount: parseFloat(this.amount).toFixed(this.precision) + ' ' + this.tokenName }]])
    },
    transferHiveKeychain () {
      console.log(this.username, this.toAccount, this.toAccount, parseFloat(this.amount).toFixed(this.precision), this.memo, this.tokenName)
      window.hive_keychain.requestTransfer(this.username, this.toAccount, parseFloat(this.amount).toFixed(this.precision), this.memo, this.tokenName, function (response, err) {
        if (response.success === true) {
          this.err = false
          this.sent = true
          this.log = response.message
        }
        if (response.success === false) {
          this.err = true
          this.log = response.message
        }
      }.bind(this))
    },
    transferHiveEngineKeychain () {
      var json = '{ "contractName": "tokens", "contractAction": "transfer", "contractPayload": { "symbol": "' + this.tokenName + '", "to": "' + this.toAccount + '", "quantity": "' + this.amount + '", "memo": "' + this.memo + '" } }'
      window.hive_keychain.requestCustomJson(this.username, 'ssc-mainnet-hive', 'Active', json, 'Transfer ' + this.amount + ' ' + this.tokenName + ' to ' + this.toAccount, function (response) {
        if (response.success === true) {
          this.err = false
          this.sent = true
          this.log = response.message
        } else {
          this.err = true
          this.log = response.message
        }
      }.bind(this))
    }
  },
  mounted () {
    if (this.$store.state.hive.accounts[this.username] === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
  }
}
</script>
