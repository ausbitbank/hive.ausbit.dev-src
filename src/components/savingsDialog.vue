<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="account !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      <span v-if="type === 'deposit'">Deposit {{ tokenName }} to Savings</span>
      <span v-else-if="type === 'withdraw'">Withdraw {{ tokenName }} from Savings</span>
    </q-card-section>
    <q-card-section class="text-center">
      <div style="max-width: 350px;margin:auto">
        <q-input label="From" :disable="true" :model-value="username" />
        <q-input label="To" v-model="to" />
        <q-input label="Amount" v-model.number="amount" />
        <div v-if="type === 'deposit'"> Available Balance: <b class="text-primary cursor-pointer" @click="amount = availableBalance">{{ availableBalance }}</b> {{ tokenName }} </div>
        <div v-if="type === 'withdraw'"> Savings Balance: <b class="text-primary cursor-pointer" @click="amount = availableSavings">{{ availableSavings }}</b> {{ tokenName }} </div>
        <q-slider v-if="type === 'deposit'" label :label-value="tokenName + ': ' + amount" v-model="amount" markers :min="0" :max="availableBalance" :step="0.001" />
        <q-slider v-if="type === 'withdraw'" label :label-value="tokenName + ': ' + amount" v-model="amount" markers :min="0" :max="availableSavings" :step="0.001"  />
        <q-input label="Memo" caption="A message included with the transfer" v-model="memo" />
      </div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ log }}</div>
        <q-btn flat :label="buttonLabel" icon="savings" :color="buttonColor" :disable="!parsedAmount" @click="doTheThing()" v-close-popup />
        <q-btn flat label="Cancel and Close" icon="cancel" color="primary" v-close-popup />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import { parseAssetAmount } from 'src/services/signingInputs'
import { nextRequestId } from 'src/services/signingInputs'
import { vestToHive } from 'src/services/wallet'

export default {
  name: 'savingsDepositDialog',
  data () {
    return {
      amount: 0.000,
      memo: '',
      err: false,
      log: '',
      sent: false,
      to: this.username
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
    username: {
      type: String,
      required: true
    },
    precision: {
      type: Number,
      required: false,
      default: 3
    },
    type: {
      type: String,
      required: false,
      default: 'deposit'
    }
  },
  components: {},
  computed: {
    availableBalance: function () {
      if (this.network === 'hive' & this.tokenName === 'HIVE') {
        return parseFloat(this.account.balance.split(' ')[0])
      } else if (this.network === 'hive' & this.tokenName === 'HBD') {
        return parseFloat(this.account.hbd_balance.split(' ')[0])
      } else {
        return 0
      }
    },
    availableSavings: function () {
      if (this.network === 'hive' & this.tokenName === 'HIVE') {
        return parseFloat(this.account.savings_balance.split(' ')[0])
      } else if (this.network === 'hive' & this.tokenName === 'HBD') {
        return parseFloat(this.account.savings_hbd_balance.split(' ')[0])
      } else {
        return 0
      }
    },
    buttonLabel: function () { if (this.type === 'deposit') { return 'Deposit to savings' } else { return 'Withdraw from savings' } },
    buttonColor: function () { if (this.type === 'deposit') { return 'green' } else { return 'red' } },
    maxAmount () {
      return this.type === 'deposit' ? this.availableBalance : this.availableSavings
    },
    parsedAmount () {
      return parseAssetAmount(this.amount, { precision: this.precision, max: this.maxAmount })
    },
    account: function () { return this.$hiveStore.accounts[this.username] },
    loggedInUser: function () { return this.$hiveStore.user.username },
    globalProps: function () { return this.$hiveStore.globalProps }
  },
  methods: {
    doTheThing () { if (this.type === 'deposit') { this.deposit() } else { this.withdraw() } },
    vestToHive (vests) { if (this.globalProps) { return vestToHive(vests, this.globalProps).toFixed(3) } else { return null } },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    deposit () {
      const amount = this.parsedAmount
      if (!amount) return
      this.$hiveStore.addToQueue([this.username, 'active', ['transfer_to_savings', { from: this.username, to: this.to, amount: amount + ' ' + this.tokenName, memo: this.memo }]])
    },
    withdraw () {
      const amount = this.parsedAmount
      if (!amount) return
      var requestId = nextRequestId()
      this.$hiveStore.addToQueue([this.username, 'active', ['transfer_from_savings', { from: this.username, to: this.to, request_id: requestId, amount: amount + ' ' + this.tokenName, memo: this.memo }]])
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.$hiveStore.accounts[this.username] === undefined) { this.$hiveStore.getAccount(this.username) }
  }
}
</script>
