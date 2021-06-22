<template>
    <span>
    <q-card flat bordered v-if="witnesses !== null">
        <q-card-section class="text-center">
            <div class="text-h5">
                <q-icon name="emoji_people" color="teal" /> Witnesses
            </div>
            <q-list separator dense>
              <q-item v-for="(witness, rank) in witnesses" :key="witness.id">
                <q-item-section avatar class="text-center">
                  <router-link class="text-primary" :to="linkAccount(witness.owner)">
                  <q-avatar size="xl">
                    <q-img :src="getHiveAvatarUrl(witness.owner)" />
                  </q-avatar>
                  </router-link>
                </q-item-section>
                <q-item-section>
                  <span class="text-bold" v-if="!alertSigningDisabled(witness.signing_key)">
                    <router-link class="text-primary" :to="linkAccount(witness.owner)">{{ witness.owner }}</router-link>
                    <span v-if="rank < 20" class="q-ml-sm text-white" title="Consensus Witness">#{{ rank + 1 }}</span>
                    <span v-else class="q-ml-sm text-grey" title="Backup Witness">#{{ rank + 1 }}</span>
                  </span>
                  <span class="text-strike" v-else>
                    {{ witness.owner }}
                  </span>
                  <q-btn dense flat title="Click to show full witness properties">
                    <q-badge dense outline :color="getVersionColor(witness.running_version)">
                      v{{ witness.running_version }}
                    </q-badge>
                    <q-popup-proxy>
                      <q-card flat bordered>
                        <q-card-section header class="text-center">
                          <div class="text-h5"><router-link :to="linkAccount(witness.owner)" class="text-primary"><q-avatar class="q-mr-sm"><q-img :src="getHiveAvatarUrl(witness.owner)" /></q-avatar>{{ witness.owner }}</router-link></div>
                          <div>Currently in rank <b>#{{ rank + 1 }}</b> with <b>{{ tidyNumber((witness.votes / 1000000000000).toFixed(0)) }}</b> MVests of approval</div>
                          <div>Last pricefeed update was <b>{{ timeDelta(witness.last_hbd_exchange_update) }}</b></div>
                          <div v-if="witness.created !== '1970-01-01T00:00:00'">{{ witness.owner }} first registered their witness <b>{{ timeDelta(witness.created) }}</b></div>
                          <div v-else>{{ witness.owner }} has been a witness for <b>at least 5 years.</b></div>
                          <div v-if="loggedInUser === witness.owner"><q-btn flat icon="edit" color="orange" @click="$router.push('/witness')" label="Edit witness properties" /></div>
                          <div><router-link :to="linkAccount(witness.owner)">Profile</router-link>, <router-link :to="linkAccountBlog(witness.owner)">Blog</router-link>, <router-link :to="linkAccountPosts(witness.owner)">Posts</router-link>, <router-link :to="linkAccountWallet(witness.owner)">Wallet</router-link></div>
                        </q-card-section>
                        <json-viewer :data="witness" class="q-ml-md" />
                      </q-card>
                    </q-popup-proxy>
                  </q-btn>
                  <div v-if="showMissed">
                    <q-badge dense outline><q-icon name="info" color="blue" /> Missed: {{ witness.total_missed }}</q-badge>
                  </div>
                  <div v-if="showLastBlock">
                    <q-badge dense outline><q-icon name="info" color="blue" v-if="(globalProps.head_block_number - witness.last_confirmed_block_num) < 22" /><q-icon name="info" color="orange" v-else /> Blocks Since Last: {{ globalProps.head_block_number - witness.last_confirmed_block_num }}</q-badge>
                  </div>
                  <div v-if="alertPricefeedAge(witness.last_hbd_exchange_update) === true && alertSigningDisabled(witness.signing_key) == false">
                    <q-badge dense outline><q-icon name="error" color="orange" /> Pricefeed : {{ timeDelta(witness.last_hbd_exchange_update) }}</q-badge>
                  </div>
                  <div v-if="alertNewAccount(witness.created)">
                    <q-badge dense outline><q-icon name="fiber_new" color="green" /> New witness : {{ timeDelta(witness.created) }}</q-badge>
                  </div>
                  <div v-if="witness.props.hbd_interest_rate !== 0 && alertSigningDisabled(witness.signing_key) == false">
                    <q-badge dense outline><q-icon name="account_balance" color="blue" /> HBD APR {{ witness.props.hbd_interest_rate / 100 }}%</q-badge>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
        </q-card-section>
        <q-separator />
        <q-card-actions align="center">
          <router-link to="witnesses" v-if="this.$route.path !== '/witnesses'"><q-btn dense flat icon="link" /></router-link>
          <q-btn dense flat icon="unfold_more" @click="limit = 200; witnesses = null; getWitnessesByVote()" v-if="limit < 200 "/>
          <q-btn dense flat icon="unfold_less" @click="limit = 25; witnesses = null; getWitnessesByVote()" v-if="limit === 200 "/>
        </q-card-actions>
    </q-card>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import moment from 'moment'
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'witnesses',
  props: {
    showMissed: {
      required: false,
      type: Boolean,
      default: false
    },
    showLastBlock: {
      required: false,
      type: Boolean,
      default: false
    },
    globalProps: {
      required: false,
      type: Object,
      default: null
    },
    limit: {
      required: false,
      type: Number,
      default: 25
    }
  },
  components: { jsonViewer },
  data () {
    return {
      witnesses: null,
      hardforkVersion: null
    }
  },
  computed: {
    loggedInUser: { get () { return this.$store.state.hive.user.username } }
  },
  methods: {
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    getWitnessesByVote () {
      this.$hive.api.getWitnessesByVoteAsync('', this.limit)
        .then((response) => { this.witnesses = response })
    },
    votesToHp (votes) {
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
      this.$hive.api.getHardforkVersionAsync()
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
    },
    linkAccount (username) { return '/@' + username },
    linkAccountBlog (username) { return '/@' + username + '/blog' },
    linkAccountPosts (username) { return '/@' + username + '/posts' },
    linkAccountWallet (username) { return '/@' + username + '/wallet' },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    }
  },
  mounted () {
    this.getWitnessesByVote()
    this.getHardforkVersion()
  }
}
</script>
