<template>
    <span>
    <q-card flat bordered v-if="witnesses !== null">
        <q-card-section class="text-center">
            <div class="text-h5">
                <q-icon name="emoji_people" color="teal" /> Witnesses
            </div>
            <div class="text-caption" v-if="loggedInUser && account !== undefined">
              <div v-if="viewAll">
                <q-btn flat dense label="My votes only"  @click="viewAll = false" color="primary" icon="face" v-if="viewAll" /><br />
                Viewing all witnesses:
              </div>
              <div v-else>
                <q-btn flat dense label="Show all"  @click="viewAll = true" color="primary" icon="clear_all" /><br />
                <div v-if="account.proxy !== ''">Voting Proxy: <q-btn size="sm" flat dense icon-right="cancel" color="red" title="Remove voting proxy" :label="account.proxy" @click="setProxy('')" /></div>
                Viewing my votes ({{ witnessVotes.length }}/30):
              </div>
            </div>
            <q-list separator dense>
              <q-item v-for="(witness, rank) in witnessList" :key="witness.id">
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
                      v{{ witness.running_version }} &nbsp; <q-icon color="info" size="xs" name="info" title="View more information, vote or unvote this witness" />
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
                          <div v-if="loggedInUser && votingAccount && loggedInUser === votingAccount.name">
                            <q-btn flat dense label="Unvote this witness" color="red" icon="cancel" @click="unvoteWitness(witness.owner)" v-if="witnessVotes.includes(witness.owner)" />
                            <q-btn flat dense label="Vote this witness" color="orange" icon="how_to_vote" @click="voteWitness(witness.owner)" v-if="!witnessVotes.includes(witness.owner)" />
                          </div>
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
          <q-btn dense flat icon="more_horiz" v-if="loggedInUser">
            <q-menu>
              <q-list bordered separator>
                <q-item clickable @click="proxyDialog = true" class="text-primary" title="Voting Proxy">
                  <q-item-section avatar><q-icon name="add" /></q-item-section>
                  <q-item-section>Voting Proxy</q-item-section>
                </q-item>
                <q-item clickable @click="init()" class="text-green" title="Refresh data" v-close-popup>
                  <q-item-section avatar><q-icon name="refresh" /></q-item-section>
                  <q-item-section>Refresh</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-card-actions>
        <q-dialog v-model="proxyDialog">
          <q-card flat bordered>
            <q-card-section header class="text-h5 text-center">
              Set a voting proxy
            </q-card-section>
            <q-card-section>
              <div>
                <q-icon name="info" color="info" size="md" style="float:left" class="q-ma-md" />
                Enter a username here to select a proxy that will vote for witnesses and proposals on your behalf.
              </div>
              <q-input label="proxy account" v-model="newProxy" />
            </q-card-section>
            <q-card-actions class="text-center">
              <q-btn flat label="Set Proxy" icon="edit" color="orange" @click="setProxy(newProxy)" v-close-popup />
              <q-btn flat label="Cancel and close" icon="cancel" color="primary" v-close-popup/>
            </q-card-actions>
          </q-card>
        </q-dialog>
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
import { debounce } from 'quasar'
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
      hardforkVersion: null,
      viewAll: true,
      proxyDialog: false,
      newProxy: ''
    }
  },
  watch: {
    loggedInUser: function () { if (this.loggedInUser) { debounce(this.init(), 400) } },
    account: function () {
      if (this.account === undefined && this.loggedInUser) { debounce(this.$store.dispatch('hive/getAccount', this.loggedInUser), 500) }
      if (this.account !== undefined) {
        if (this.account.proxy !== '') { debounce(this.$store.dispatch('hive/getAccount', this.account.proxy), 500) }
      }
    }
  },
  computed: {
    loggedInUser: { get () { return this.$store.state.hive.user.username } },
    account: {
      get () {
        if (this.loggedInUser) {
          return this.$store.state.hive.accounts[this.loggedInUser]
        } else {
          return undefined
        }
      }
    },
    witnessVotes: {
      get () {
        if (this.loggedInUser && this.account !== undefined && this.votingAccount !== undefined) {
          return this.votingAccount.witness_votes
        } else {
          return []
        }
      }
    },
    myWitnesses: {
      get () {
        if (this.loggedInUser && this.account !== undefined && this.witnesses.length > 0) {
          return this.witnesses.filter(w => this.witnessVotes.includes(w.owner))
        } else {
          return []
        }
      }
    },
    witnessList: {
      get () {
        if (this.viewAll) { return this.witnesses } else { return this.myWitnesses }
      }
    },
    votingAccount: {
      get () {
        if (this.account !== undefined) {
          if (this.account.proxy === '') {
            return this.account
          } else {
            return this.$store.state.hive.accounts[this.account.proxy]
          }
        } else {
          return undefined
        }
      }
    }
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
    votesToHp (votes) { return ((votes * this.hivePerMvests) / 1000000000000).toFixed(0) },
    getVersionColor (version) { if (this.hardforkVersion) { if (this.hardforkVersion.substr(0, 4) === version.substr(0, 4)) { return 'green' } else { return 'grey' } } else { return 'grey' } },
    getHardforkVersion () {
      this.$hive.api.getHardforkVersionAsync()
        .then((res) => { this.hardforkVersion = res })
    },
    alertPricefeedAge (age) { if (moment(age).isBefore(moment().subtract(1, 'd'))) { return true } else { return false } },
    alertSigningDisabled (key) { if (key === 'STM1111111111111111111111111111111114T1Anm') { return true } else { return false } },
    alertNewAccount (created) { if (moment(created).isAfter(moment().subtract(6, 'months'))) { return true } else { return false } },
    voteWitness (witness) { this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['account_witness_vote', { account: this.loggedInUser, witness: witness, approve: 'true' }]]) },
    unvoteWitness (witness) { this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['account_witness_vote', { account: this.loggedInUser, witness: witness, approve: 'false' }]]) },
    setProxy (proxy) { this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', ['account_witness_proxy', { account: this.loggedInUser, proxy: proxy }]]) },
    linkAccount (username) { return '/@' + username },
    linkAccountBlog (username) { return '/@' + username + '/blog' },
    linkAccountPosts (username) { return '/@' + username + '/posts' },
    linkAccountWallet (username) { return '/@' + username + '/wallet' },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    init () {
      this.getWitnessesByVote()
      this.getHardforkVersion()
      if (this.loggedInUser) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
      if (this.account !== undefined) {
        if (this.account.proxy !== '') {
          this.$store.dispatch('hive/getAccount', this.account.proxy)
        }
      }
    }
  },
  mounted () {
    this.init()
  }
}
</script>
