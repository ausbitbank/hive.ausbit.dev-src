<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="account !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      Delegate {{ tokenName }}
    </q-card-section>
    <q-card-section v-if="this.network === 'hive' & this.tokenName === 'HIVE'" class="text-center">
      <div>You currently have <b @click="amountVests = parseFloat(availableStake)" class="text-primary cursor-pointer">{{ tidyNumber(vestToHive(availableStake)) }}</b> {{ tokenName }} available for delegating.</div>
    </q-card-section>
    <q-card-section>
        <q-input v-model="to" label="Account to delegate to" style="max-width:250px; margin:auto"/>
        <q-card flat bordered v-if="alreadyDelegatedToUser" style="margin:auto; text-center" class="q-ma-sm q-pa-sm">
          Currently delegating <b class="text-primary cursor-pointer" @click="amountVests = alreadyDelegatedToUser">{{ tidyNumber(vestToHive(alreadyDelegatedToUser)) }}</b> {{ tokenName }} to {{ to }} since {{ timeDelta(alreadyDelegatedToUserDate) }}<br />
          <q-btn flat label="Cancel Delegation" @click="amountVests = 0.000000; delegateHive()" icon="cancel" color="red" v-close-popup/>
        </q-card>
        <q-slider label :label-value="'Hive: ' + amountHive" v-model="amountVests" markers :min="0" :max="availableStake" style="max-width: 350px;margin:auto" />
        <q-input v-model.number="amountVests" label="Delegation amount (VESTS)" style="max-width:250px; margin:auto" />
        <q-input readonly v-model.number="amountHive" label="Delegation amount (HIVE)" style="max-width:250px; margin:auto" />
        <q-btn flat :disable="delegationButtonDisabled" :label="delegationButtonLabel" :color="delegationButtonColor" @click="delegateHive()" v-close-popup/>
        <q-btn flat label="Close without changes" color="primary" v-close-popup />
    </q-card-section>
  </q-card>
</template>
<script>
import moment from 'moment'
export default {
  name: 'delegationDialog',
  data () {
    return {
      amountVests: this.amountVestsSuggest,
      memo: '',
      err: false,
      log: '',
      sent: false,
      to: this.toModify
    }
  },
  props: {
    tokenName: {
      type: String,
      required: true,
      default: 'HIVE'
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
    toModify: {
      type: String,
      required: false,
      default: ''
    },
    precision: {
      type: Number,
      required: false,
      default: 3
    },
    delegations: {
      type: Array,
      required: false,
      default () { return [] }
    },
    amountVestsSuggest: {
      type: Number,
      required: false,
      default: 0.000000
    }
  },
  components: {},
  computed: {
    delegationButtonLabel: function () {
      if (this.alreadyDelegatedToUser) {
        return 'Update Delegation'
      } else {
        return 'New Delegation'
      }
    },
    delegationButtonColor: function () {
      if (this.alreadyDelegatedToUser) {
        return 'red'
      } else {
        return 'green'
      }
    },
    delegationButtonDisabled: function () {
      if (this.to === '' || this.to.length < 3) { return true } else { return false }
    },
    availableStake: function () {
      if (this.network === 'hive' & this.tokenName === 'HIVE') {
        var vestedShares = parseFloat(this.$store.state.hive.accounts[this.username].vesting_shares.split(' ')[0])
        var vestsDelegatedOut = parseFloat(this.$store.state.hive.accounts[this.username].delegated_vesting_shares.split(' ')[0])
        return vestedShares - vestsDelegatedOut
      } else { return null }
    },
    alreadyDelegatedToUser: function () {
      if (this.to !== '' && this.delegations.length > 0) {
        var dele = this.delegations.find(d => d.delegatee === this.to)
        if (dele !== undefined) {
          return parseFloat(dele.vesting_shares.split(' ')[0])
        } else { return null }
      } else {
        return null
      }
    },
    alreadyDelegatedToUserDate: function () {
      if (this.to !== '' && this.delegations.length > 0) {
        var dele = this.delegations.find(d => d.delegatee === this.to)
        if (dele !== undefined) {
          return dele.min_delegation_time
        } else { return null }
      } else {
        return null
      }
    },
    account: function () { return this.$store.state.hive.accounts[this.username] },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    globalProps: function () { return this.$store.state.hive.globalProps },
    amountHive: function () { return this.vestToHive(this.amountVests) },
    amountHiveWeekly: function () { return (this.amountHive / 13).toFixed(3) },
    disableUnstake: function () { if (this.account.vesting_withdraw_rate !== '0.000000 VESTS') { return true } else { return false } }
  },
  methods: {
    setUsername (u) { this.toAccount = u },
    delegateHive () { this.$store.commit('hive/addToQueue', [this.username, 'active', ['delegate_vesting_shares', { delegator: this.username, delegatee: this.to, vesting_shares: parseFloat(this.amountVests).toFixed(6) + ' VESTS' }]]) },
    vestToHive (vests) { if (this.globalProps) { return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3) } else { return null } },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    cancelPowerdown () { this.unstakeHive('0.000') },
    unstakeHive () { this.$store.commit('hive/addToQueue', [this.username, 'active', ['withdraw_vesting', { account: this.username, vesting_shares: this.amountVests.toFixed(6) + ' VESTS' }]]) }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.$store.state.hive.accounts[this.username] === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
  }
}
</script>
