<template>
  <q-card flat bordered style="min-width: 100px; max-width: 95%" v-if="account !== undefined">
    <q-card-section header class="text-h5 text-center text-bold">
      Unstake {{ tokenName }}
    </q-card-section>
    <q-card-section v-if="this.network === 'hiveEngine'" class="text-center">
      <div>Unstaking {{ tokenName }} takes {{ cooldown }} days total, split into {{ transactions }} transactions.</div>
      <div>You have <q-badge clickable color="primary" @click="unstakeAmount = stake">{{ stake }}</q-badge> staked {{ tokenName }}.</div>
      <div v-if="unstaking">You are already unstaking {{ unstaking }} {{ tokenName }}</div>
      <q-input v-model.number="unstakeAmount" outline :label="'Unstake how many ' + tokenName + ' ?'" />
      <q-btn label="Unstake" color="red" icon="lock_open" @click="unstakeHiveEngine()"/>
    </q-card-section>
    <q-card-section v-if="this.network === 'hive' & this.tokenName === 'HIVE'" class="text-center">
      <div>The unstaking process will convert your staked {{ tokenName }} (VESTS) into unstaked liquid {{ tokenName }} in 13 weekly payments.</div>
      <div>You currently have <b @click="amountVests = parseFloat(availableStake)" class="text-primary cursor-pointer">{{ tidyNumber(vestToHive(availableStake)) }}</b> {{ tokenName }} available for unstaking.</div>
      <q-card dense flat v-if="account.vesting_withdraw_rate !== '0.000000 VESTS'">
        <q-card-section header class="text-h5 text-red">
        You already have an unstake in progress.
        </q-card-section>
        <q-card-section>
        <div>Unstaking: <b>{{ tidyNumber(vestToHive(parseInt(account.to_withdraw / 1000000))) }}</b> Hive total</div>
        <div>Unstaked so far: <b>{{ tidyNumber(vestToHive(parseInt(account.withdrawn / 1000000))) }}</b> Hive</div>
        <div>Next payout: <b>{{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }}</b> Hive <span class="text-caption color-grey" :title="account.next_vesting_withdrawal">{{ timeDelta(account.next_vesting_withdrawal) }}</span></div>
        </q-card-section>
        <q-card-actions vertical>
          <q-btn label="Cancel Powerdown" color="red" flat icon="cancel" @click="cancelPowerdown()" />
        </q-card-actions>
      </q-card>
    </q-card-section>
    <q-card-section class="text-center" v-if="!disableUnstake">
      <div>
        <q-slider label label-always :label-value="'Hive: ' + amountHive" v-model="amountVests" markers :min="0" :max="availableStake" style="max-width: 350px;margin:auto" />
        <div class="text-caption">
          = <b class="text-primary">{{ amountHive }}</b> Hive total in 13 weekly payments of <b class="text-primary">{{ amountHiveWeekly }}</b> Hive each
        </div>
      </div>
      <div class="text-center q-ma-md">
        <div v-if="log !== ''"><q-icon name="error" color="red" v-if="err" />{{ this.log }}</div>
        <q-btn flat label="Unstake" icon="lock_open" color="red" @click="unstakeHive()" :disable="disableUnstake" v-if="!sent" />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import moment from 'moment'
export default {
  name: 'unstakingDialog',
  data () {
    return {
      amountVests: 0.000,
      memo: '',
      err: false,
      log: '',
      sent: false,
      unstakeAmount: 0
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
    transactions: {
      type: Number,
      required: false,
      default: null
    },
    cooldown: {
      type: Number,
      required: false,
      default: null
    },
    unstaking: {
      type: Number,
      required: false,
      default: null
    },
    stake: {
      type: Number,
      required: false,
      default: null
    }
  },
  components: {},
  computed: {
    availableStake: function () {
      if (this.network === 'hive' & this.tokenName === 'HIVE') {
        var vestedShares = parseFloat(this.$store.state.hive.accounts[this.username].vesting_shares.split(' ')[0])
        var vestsDelegatedOut = parseFloat(this.$store.state.hive.accounts[this.username].delegated_vesting_shares.split(' ')[0])
        return vestedShares - vestsDelegatedOut
      } else {
        return null
      }
    },
    account: function () { return this.$store.state.hive.accounts[this.username] },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    globalProps: function () { return this.$store.state.hive.globalProps },
    amountHive: function () { return this.vestToHive(this.amountVests) },
    amountHiveWeekly: function () { return (this.amountHive / 13).toFixed(3) },
    disableUnstake: function () {
      if (this.network === 'hive' & this.tokenName === 'HIVE') {
        if (this.account.vesting_withdraw_rate !== '0.000000 VESTS') { return true } else { return false }
      } else {
        return true
      }
    }
  },
  methods: {
    setUsername (u) { this.toAccount = u },
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
    unstakeHive () { this.$store.commit('hive/addToQueue', [this.username, 'active', ['withdraw_vesting', { account: this.username, vesting_shares: this.amountVests.toFixed(6) + ' VESTS' }]]) },
    unstakeHiveEngine () {
      var j = '{ "contractName": "tokens", "contractAction": "unstake", "contractPayload": { "symbol": "' + this.tokenName + '", "quantity": "' + this.unstakeAmount + '" } }'
      var cj = {
        required_auths: [this.username],
        required_posting_auths: [],
        id: 'ssc-mainnet-hive',
        json: j
      }
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['custom_json', cj]])
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.$store.state.hive.accounts[this.username] === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
  }
}
</script>
