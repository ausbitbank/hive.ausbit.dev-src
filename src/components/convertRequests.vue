<template>
  <q-expansion-item dense dense-toggle expand-separator header-class="text-primary" icon="transform" :label="headingLabel" v-if="conversions.length > 0">
  <q-list dense>
    <q-item v-for="conversion in conversions" :key="conversion.id" label="Conversions">
      <q-item-section>
        {{ conversion.amount }} due {{ timeDelta(conversion.conversion_date)}}
      </q-item-section>
      <q-item-section side v-if="false & username === loggedInUser">
        <q-btn flat color="red" icon="cancel" title="Cancel Conversion" />
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
      error: null
    }
  },
  components: {},
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    account: function () { return this.$store.state.hive.accounts[this.username] },
    headingLabel: function () { return this.conversions.length + ' pending conversions requests' }
  },
  methods: {
    getConversions () {
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
