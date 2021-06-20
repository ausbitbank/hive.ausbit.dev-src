<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="account !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      <span v-if="tokenName === 'HIVE'">Convert {{ tokenName }} to HBD</span>
      <span v-else-if="tokenName === 'HBD'">Convert {{ tokenName }} to HIVE</span>
    </q-card-section>
    <q-card-section v-if="tokenName === 'HBD'" class="text-center">
      <q-icon name="info" color="primary" size="md" /><br />
      Conversions from HBD to Hive will take 3 days to complete<br />
      You will receive $1 worth of Hive for each converted HBD
    </q-card-section>
    <q-card-section class="text-center">
      <div style="max-width: 350px;margin:auto">
        <q-input label="Amount to convert" v-model="amount" /><br />
        <q-slider dense label v-model.number="amount" markers :min="0" :max="availableBalance" :step="0.001" style="max-width: 350px;margin:auto" /><br />
        Available Balance: <b class="text-primary cursor-pointer" @click="amount = availableBalance">{{ availableBalance }}</b> {{ tokenName }}
      </div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ this.log }}</div>
        <q-btn flat :label="buttonLabel" icon="warning" color="red" @click="doTheThing()" v-close-popup />
        <q-btn flat label="Cancel and Close" icon="cancel" color="primary" v-close-popup />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
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
    buttonLabel: function () { if (this.tokenName === 'HIVE') { return 'Convert HIVE to HBD' } else { return 'Convert HBD to HIVE' } },
    account: function () { return this.$store.state.hive.accounts[this.username] },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    globalProps: function () { return this.$store.state.hive.globalProps }
  },
  methods: {
    doTheThing () { if (this.tokenName === 'HIVE') { this.convertHiveToHbd() } else { this.convertHbdToHive() } },
    vestToHive (vests) { if (this.globalProps) { return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3) } else { return null } },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    convertHiveToHbd () {
      // this.$store.commit('hive/addToQueue', [this.username, 'active', ['transfer_to_savings', { from: this.username, to: this.to, amount: this.amount.toFixed(3) + ' ' + this.tokenName, memo: this.memo }]])
    },
    convertHbdToHive () {
      var requestid = Math.floor((Math.random() * 10000) + 1)
      var a = parseFloat(this.amount).toFixed(3) + ' ' + this.tokenName
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['convert', { owner: this.username, requestid: requestid, amount: a }]])
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.$store.state.hive.accounts[this.username] === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
  }
}
</script>
