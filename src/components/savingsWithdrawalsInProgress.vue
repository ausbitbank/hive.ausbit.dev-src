<template>
  <q-item v-if="withdrawsFrom !== null">
    <q-item-section avatar>
      <q-icon name="warning" color="orange" />
    </q-item-section>
    <q-item-section>
      <div class="text-bold">Withdrawals are pending from your savings account</div>
      <div v-for="request in withdrawsFrom" :key="request.id">
      <b>{{ request.amount }}</b>
      <span v-if="request.from === username && request.from === request.to">
      </span>
      <span v-else-if="request.to !== username">
        from {{ request.from }} to <b class="text-red">{{ request.to }}</b>
      </span>
      <span v-else>from {{ request.from }} to {{ request.to }}</span>
      <span v-if="request.memo">with memo: <b>{{ request.memo }}</b></span>
      due {{ timeDelta(request.complete) }}<br />
      <q-btn dense flat icon="cancel" color="red" label="Cancel" title="Cancel withdrawal request" @click="cancelTransferFromSavings(request.request_id)" v-if="loggedInUser === username" />
      </div>
    </q-item-section>
  </q-item>
</template>
<script>
import moment from 'moment'
export default {
  name: 'savingsDepositDialog',
  data () {
    return {
      err: false,
      log: '',
      sent: false,
      withdrawsFrom: null
    }
  },
  props: {
    username: {
      type: String,
      required: true
    }
  },
  components: {},
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username }
  },
  methods: {
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
    checkSavingsWithdrawTo (user) {
      this.$hive.api.getSavingsWithdrawFromAsync(user)
        .then(res => { if (res.length > 0) { this.withdrawsFrom = res } })
    },
    cancelTransferFromSavings (id) {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['cancel_transfer_from_savings', { from: this.username, request_id: id }]])
    }
  },
  mounted () {
    this.checkSavingsWithdrawTo(this.username)
  }
}
</script>
