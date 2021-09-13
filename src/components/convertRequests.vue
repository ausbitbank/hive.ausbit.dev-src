<template>
  <q-expansion-item dense dense-toggle expand-separator header-class="text-primary" icon="transform" :label="headingLabel" v-if="conversions.length > 0 || collateralized_conversions.length > 0">
  <q-list dense>
    <q-item v-for="conversion in conversions" :key="conversion.id" label="Conversions">
      <q-item-section>
        {{ conversion.amount }} to be converted to HIVE {{ timeDelta(conversion.conversion_date)}}
      </q-item-section>
    </q-item>
  </q-list>
  <q-list dense>
    <q-item v-for="conversion in collateralized_conversions" :key="conversion.id" label="Conversions">
      <q-item-section>
        {{ conversion.converted_amount }} converted, remaining {{ conversion.collateral_amount }} to be converted to HBD {{ timeDelta(conversion.conversion_date) }}
      </q-item-section>
    </q-item>
  </q-list>
  </q-expansion-item>
</template>
<script>
import moment from 'moment'
export default {
  name: 'convertRequests',
  props: ['username'],
  data () {
    return {
      conversions: [],
      collateralized_conversions: [],
      error: null
    }
  },
  components: {},
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    account: function () { return this.$store.state.hive.accounts[this.username] },
    headingLabel: function () { return (this.conversions.length + this.collateralized_conversions.length) + ' pending conversions requests' }
  },
  methods: {
    getConversions () {
      this.$hive.api.callAsync('condenser_api.get_collateralized_conversion_requests', [this.username])
        .then(response => { this.collateralized_conversions = response })
        .error(err => { this.error = err.cause.data })
      this.$hive.api.getConversionRequestsAsync(this.username)
        .then(response => { this.conversions = response })
        .error(err => { this.error = err.cause.data })
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    }
  },
  mounted () {
    this.getConversions()
  }
}
</script>
