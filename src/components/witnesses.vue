<template>
    <span>
    <q-spinner-grid size="2em" color="primary" v-if="witnesses === null" />
    <q-card flat bordered v-if="witnesses !== null">
        <q-card-section class="text-center">
            <div class="text-h5">
                <q-icon name="emoji_people" /> Witnesses
            </div>
            <div v-for="witness in witnesses" :key="witness.index">
                <div>
                    <span class="text-bold" v-if="!alertSigningDisabled(witness.signing_key)">
                      {{ witness.owner }}
                    </span>
                    <span class="text-strike" v-else>
                      {{ witness.owner }}
                    </span>
                    <q-badge outline :color="getVersionColor(witness.running_version)">
                      v{{ witness.running_version }}
                    </q-badge>
                    <div>
                      <div v-if="alertPricefeedAge(witness.last_hbd_exchange_update) === true && alertSigningDisabled(witness.signing_key) == false">
                        <q-badge dense outline><q-icon name="error" color="orange" /> Pricefeed : {{ timeDelta(witness.last_hbd_exchange_update) }}</q-badge>
                      </div>
                      <div v-if="alertNewAccount(witness.created)">
                        <q-badge dense outline><q-icon name="fiber_new" color="green" /> New witness : {{ timeDelta(witness.created) }}</q-badge>
                      </div>
                    </div>
                    <div v-if="witness.props.hbd_interest_rate !== 0 && alertSigningDisabled(witness.signing_key) == false">
                      <q-badge dense outline><q-icon name="account_balance" color="blue" /> HBD APR {{ witness.props.hbd_interest_rate / 100 }}%</q-badge>
                    </div>
                    <q-tooltip content-class="bg-dark">
                      <vue-json-pretty :data="witness" :custom-value-formatter="customLinkFormatter" />
                    </q-tooltip>
                    </div>
                </div>
        </q-card-section>
        <q-card-section style="text-center">
            <a href="https://peakd.com/me/witnesses"><q-btn dense icon="info" color="primary" label="Vote Witnesses" /></a>
            <div class="text-center">
              <router-link to="witnesses" v-if="this.$route.path !== '/witnesses'"><q-btn dense push icon="link" /></router-link>
              <q-btn dense push icon="unfold_more" @click="limit = 200; witnesses = null; getWitnessesByVote()" v-if="limit === 40 "/>
              <q-btn dense push icon="unfold_less" @click="limit = 40; witnesses = null; getWitnessesByVote()" v-if="limit === 200 "/>
            </div>
        </q-card-section>
    </q-card>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import hive from '@hiveio/hive-js'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import moment from 'moment'
import DOMPurify from 'dompurify'
export default {
  name: 'witnesses',
  props: [],
  components: { VueJsonPretty },
  data () {
    return {
      witnesses: null,
      hardforkVersion: null,
      limit: 40
    }
  },
  computed: {
  },
  methods: {
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    getWitnessesByVote () {
      hive.api.getWitnessesByVoteAsync('', this.limit)
        .then((response) => { this.witnesses = response })
    },
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (key === 'head_block_number' || key === 'last_irreversible_block_num' || key === 'last_confirmed_block_num') {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else {
        return DOMPurify.sanitize(defaultFormatted)
      }
    },
    votesToHp (votes) {
      return this.numberWithCommas(((votes * this.hivePerMvests) / 1000000000000).toFixed(0))
    },
    votesToHpRaw (votes) {
      return ((votes * this.hivePerMvests) / 1000000000000).toFixed(0)
    },
    getVersionColor (version) {
      if (this.hardforkVersion) {
        if (this.hardforkVersion.substr(0, 4) === version.substr(0, 4)) {
          return 'green'
        } else {
          return 'grey'
        }
      } else {
        return 'grey'
      }
    },
    getHardforkVersion () {
      hive.api.getHardforkVersionAsync()
        .then((res) => { this.hardforkVersion = res })
    },
    alertPricefeedAge (age) {
      if (moment(age).isBefore(moment().subtract(1, 'd'))) {
        return true
      } else {
        return false
      }
    },
    alertSigningDisabled (key) {
      if (key === 'STM1111111111111111111111111111111114T1Anm') {
        return true
      } else {
        return false
      }
    },
    alertNewAccount (created) {
      if (moment(created).isAfter(moment().subtract(6, 'months'))) {
        return true
      } else {
        return false
      }
    }
  },
  mounted () {
    this.getWitnessesByVote()
    this.getHardforkVersion()
  }
}
</script>
