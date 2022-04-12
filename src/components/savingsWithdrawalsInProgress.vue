<template>
  <q-item v-if="withdrawsFrom !== null">
    <q-item-section avatar>
      <q-icon name="savings" color="red" />
    </q-item-section>
    <q-item-section>
      <div class="text-bold">Withdrawal<span v-if="withdrawsFrom.length > 1">s</span> pending from savings account</div>
      <div v-for="request in withdrawsFrom" :key="request.id">
        <b>{{ tidyNumber(request.amount.split(' ')[0]) }}</b> {{ request.amount.split(' ')[1] }}
        <span v-if="request.from === username && request.from === request.to">
        </span>
        <span v-else-if="request.to !== username">
          from {{ request.from }} to <b class="text-red">{{ request.to }}</b>
        </span>
        <span v-else>from {{ request.from }} to {{ request.to }}</span>
        <span v-if="request.memo">with memo: <b>{{ request.memo }}</b></span>
        due {{ timeDelta(request.complete) }}
        <q-btn dense flat icon="cancel" color="red" title="Cancel withdrawal request" v-if="loggedInUser === username">
          <q-popup-proxy>
            <q-card flat bordered class="text-center">
              <q-card-header class="text-h5">Cancel withdrawal request ?</q-card-header>
              <q-card-section>Id {{ request.request_id }} : {{ tidyNumber(request.amount.split(' ')[0]) }} {{ request.amount.split(' ')[1] }} <span v-if="request.from !== request.to">from {{ request.from }} </span>to {{ request.to }}</q-card-section>
              <q-card-actions>
                <q-btn icon="check" label="Yes" color="green" @click="cancelTransferFromSavings(request.request_id)" />
                <q-btn icon="cancel" label="No" color="red" v-close-popup />
              </q-card-actions>
            </q-card>
          </q-popup-proxy>
        </q-btn>
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
