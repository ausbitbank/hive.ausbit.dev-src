<template>
  <q-page class="flex">
    <q-dialog v-model="error" persistent>
      <q-icon size="lg" name="error" color="yellow" /><br />
      {{ errorMessage }}
    </q-dialog>
    <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && account !== undefined && globalProps !== null && !error">
      <account-header :globalProps="globalProps" :account="account" :showBalances="true" v-if="globalProps !== null && account !== null"/>
        <div class="col-xs-12 col-sm-12 col-md-4" style="max-width: 500px">
          <q-card flat bordered class="text-center q-pa-sm q-ma-md">
            <q-card-section>
                <div class="text-subtitle">Vote Weight</div>
                <div class="text-h6">{{ effectiveHPTidy }} HP</div>
                <div class="text-caption text-grey">
                    {{ vestToHive(parseInt(account.vesting_shares.split(' ')[0])) }} + {{ vestToHive(parseInt(account.received_vesting_shares.split(' ')[0])) }} - {{ vestToHive(parseInt(account.delegated_vesting_shares.split(' ')[0])) }}
                </div>
                <div v-if="parseInt(account.vesting_withdraw_rate.split(' ')[0]) !== 0">
                    <div>Next powerdown: {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }} HIVE</div>
                    <div class="text-caption color-grey">{{ timeDelta(account.next_vesting_withdrawal) }}</div>
                </div>
                <div class="text-bold">
                    Voting Power
                </div>
                <div>
                    <q-linear-progress dark stripe rounded size="20px" :value="votePower / 100" color="blue" class="q-mt-sm">
                      <div class="absolute-full flex flex-center">
                          <q-badge color="black" text-color="primary" :label="votePower" />
                      </div>
                    </q-linear-progress>
                </div>
                <div class="text-bold">
                    Downvote Power
                </div>
                <div>
                    <q-linear-progress dark stripe rounded size="20px" :value="this.downvotePowerPct / 100" color="red" class="q-mt-sm">
                      <div class="absolute-full flex flex-center">
                          <q-badge color="black" text-color="primary" :label="this.downvotePowerPct" />
                      </div>
                    </q-linear-progress>
                </div>
                <div class="text-bold">
                    Resource Credits
                </div>
                <div>
                    <rc :username="account.name" />
                </div>
            </q-card-section>
            <q-card-section>
                <div class="row">
                  <div class="col">
                      <div>
                          Reputation
                    </div>
                      <div class="text-h5">
                          {{ getReputation(account.reputation) }}
                      </div>
                      <div class="text-caption text-grey">
                          {{ account.post_count }} posts
                      </div>
                  </div>
                  <div class="col">
                      <div>
                          Created
                      </div>
                      <div class="text-h5">
                          {{ accountAge }}
                      </div>
                      <div class="text-caption text-grey">
                          {{ accountAgeShort }}
                      </div>
                  </div>
                </div>
                <div>
                  View <router-link :to="linkBlog(username)">Blog</router-link> , <router-link :to="linkPosts(username)">Posts</router-link>, <router-link :to="linkComments(username)">Comments</router-link>, <router-link :to="linkReplies(username)">Replies</router-link>
                </div>
                <div>
                  View in : <a :href="linkHiveBlog(username)">hive.blog</a> , <a :href="linkPeakd(username)">peakd</a>
                </div>
            </q-card-section>
        </q-card>
        <recent-posts-carousel :account="username" v-if="account.post_count > 0" type="posts" />
        <!-- <recent-voted-posts-carousel :account="username" v-if="account.last_vote_time !== '1970-01-01T00:00:00'" /> -->
        <q-card flat bordered class="q-pa-sm q-ma-md">
            <q-card-section>
                <props-list :obj="account" :ignoreKeys="['owner', 'active', 'posting', 'memo_key', 'json_metadata', 'posting_json_metadata', 'voting_manabar', 'downvote_manabar', 'witness_votes']"/>
            </q-card-section>
        </q-card>
        <q-card flat bordered class="q-pa-sm q-ma-md" v-if="account.json_metadata">
            <q-card-section>
                <div class="text-h6">JSON Metadata</div>
                <json-viewer :data="JSON.parse(account.json_metadata)" />
            </q-card-section>
        </q-card>
        <q-card flat bordered class="q-pa-sm q-ma-md" v-if="account.posting_json_metadata">
            <q-card-section>
                <div id="posting_meta" class="text-h6">Posting JSON Metadata</div>
                <q-btn icon="edit" label="Edit Posting JSON Metadata" color="primary" @click="editPostingJson = !editPostingJson" dense push />
                <json-viewer v-if="editPostingJson === false" :data="JSON.parse(account.posting_json_metadata)" />
                <props-editor v-if="editPostingJson" :json="account.posting_json_metadata" :username="username" type="postingMeta" />
            </q-card-section>
        </q-card>
        <q-card flat bordered class="q-pa-sm q-ma-md">
            <q-card-section>
              <div class="text-h5 text-center">Authorities</div>
            </q-card-section>
            <q-card-section v-if="witness">
                <div class="text-h6">Signing</div>
                <q-list bordered seperator dense>
                    <q-item>
                        <q-item-section avatar>
                          <q-icon name="lock" />
                        </q-item-section>
                        <q-item-section class="wrap">
                            {{ witness.signing_key }}
                        </q-item-section>
                      <q-item-section side>
                          1
                      </q-item-section>
                    </q-item>
                </q-list>
            </q-card-section>
            <q-card-section>
                <div class="text-h6">Owner</div>
                <q-list bordered seperator dense>
                  <q-item v-for="auth in account.owner.key_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="lock" />
                      </q-item-section>
                      <q-item-section class="wrap">
                          {{ auth[0] }}
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                  <q-item v-for="auth in account.owner.account_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="person" />
                      </q-item-section>
                      <q-item-section>
                          <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                </q-list>
            </q-card-section>
            <q-card-section>
                <div class="text-h6">Active</div>
                <q-list bordered seperator dense class="wrap">
                  <q-item v-for="auth in account.active.key_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="lock" />
                      </q-item-section>
                      <q-item-section class="wrap">
                          {{ auth[0] }}
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                  <q-item v-for="auth in account.active.account_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="person" />
                      </q-item-section>
                      <q-item-section>
                          <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                </q-list>
            </q-card-section>
            <q-card-section>
                <div class="text-h6">Posting</div>
                <q-list bordered seperator dense>
                  <q-item v-for="auth in account.posting.key_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="lock" />
                      </q-item-section>
                      <q-item-section class="wrap">
                          {{ auth[0] }}
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                  <q-item v-for="auth in account.posting.account_auths" :key="auth.index">
                      <q-item-section avatar>
                          <q-icon name="person" />
                      </q-item-section>
                      <q-item-section>
                          <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
                      </q-item-section>
                      <q-item-section side>
                          {{ auth[1] }}
                      </q-item-section>
                  </q-item>
                </q-list>
            </q-card-section>
            <q-card-section>
                <div class="text-h6">Memo</div>
                <q-list bordered seperator dense>
                  <q-item>
                      <q-item-section avatar>
                          <q-icon name="lock" />
                      </q-item-section>
                      <q-item-section class="wrap">
                          {{ account.memo_key }}
                      </q-item-section>
                      <q-item-section side>
                          1
                      </q-item-section>
                  </q-item>
                </q-list>
            </q-card-section>
        </q-card>
        <q-card flat bordered class="q-pa-sm q-ma-md" v-if="witness">
            <q-card-section>
                <div class="text-h6">
                    Witness
                </div>
                <props-list :obj="witness" :ignoreKeys="[]"/>
            </q-card-section>
        </q-card>
        <q-card flat bordered class="q-pa-sm q-ma-md text-center" v-if="account.witness_votes.length > 0">
            <q-card-section>
              <div class="text-h6">@{{ username }} votes for :</div>
                <ol>
                  <li v-for="witness in account.witness_votes" :key="witness.index"><router-link :to="accountLink(witness)">{{ witness }}</router-link></li>
                </ol>
            </q-card-section>
        </q-card>
      </div>
      <div class="col-xs-12 col-sm-12 col-md-8 q-pa-md" style="max-width: 1000px">
        <account-operations :accountOperations="accountOperations" />
        <q-card class="text-center">
            <q-card-section>
                <q-btn icon="keyboard_backspace" color="primary" dense push @click="page = 1; accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); page = getAccountHistory(username)" v-if="page > 2"/>
                <q-btn icon="keyboard_arrow_left" color="primary" dense push @click="page = (parseInt(page) - 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); page = getAccountHistory(username)" v-if="page > 1"/>
                Page {{ this.page }} <q-spinner-grid size="2em" color="primary" v-if="accountOperations.length < 1" />
                <q-btn icon="keyboard_arrow_right" color="primary" dense push @click="page = (parseInt(page) + 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); getAccountHistory(username)" v-if="page !== (( accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0)"/>
                <q-btn icon="keyboard_tab" color="primary" dense push @click="page = ((accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); getAccountHistory(username)" v-if="page !== ((accountOperationsMarker / accountOperationsLimit) + 1).toFixed(0)" />
            </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
<style>
</style>
<script>
import moment from 'moment'
import { debounce } from 'quasar'
import jsonViewer from 'components/jsonViewer.vue'
import recentPostsCarousel from 'components/recentPostsCarousel.vue'
// import recentVotedPostsCarousel from 'components/recentVotedPostsCarousel.vue'
import propsList from 'components/propsList.vue'
import propsEditor from 'components/propsEditor.vue'
import accountOperations from 'components/accountOperations.vue'
import accountHeader from 'components/accountHeader.vue'
import rc from 'components/rc.vue'
export default {
  name: 'accountPage',
  components: {
    jsonViewer,
    recentPostsCarousel,
    propsList,
    propsEditor,
    accountOperations,
    accountHeader,
    rc
    // recentVotedPostsCarousel
  },
  data () {
    return {
      username: this.$route.params.username,
      votingPowerPct: 0.5,
      downvotingPowerPct: 0.5,
      resourceCreditsPct: 0.5,
      accountValue: null,
      RC: { max: null, current: null, percent: null },
      witness: null,
      accountOperations: [],
      accountOperationsLimit: 100,
      accountOperationsMarker: null,
      page: this.$router.currentRoute.query.page || 1,
      editPostingJson: false,
      error: false,
      errorMessage: ''
    }
  },
  watch: {
    username: function () {
      debounce(function () { this.accountOperationsMarker = null; this.init() }, 200)
    },
    $route: function () {
      this.init()
    }
  },
  computed: {
    globalProps: {
      get () {
        return this.$store.state.hive.globalProps
      }
    },
    account: {
      cache: false,
      get () {
        return this.$store.state.hive.accounts[this.username]
      }
    },
    accountAge: function () {
      return moment(this.account.created).fromNow()
    },
    accountAgeShort: function () {
      return moment(this.account.created).format('MMMM YYYY')
    },
    votePower: function () {
      var secondsago = (new Date() - new Date(this.account.last_vote_time + 'Z')) / 1000
      var vpow = this.account.voting_power + (10000 * secondsago / 432000)
      return Math.min(vpow / 100, 100).toFixed(2)
    },
    effectiveHPTidy: function () {
      return this.tidyNumber(this.effectiveHP)
    },
    effectiveHP: function () {
      return this.vestToHive(this.effectiveVests)
    },
    effectiveVests: function () {
      if (this.account !== undefined && this.account !== null) {
        return parseInt(this.account.vesting_shares.split(' ')[0]) + parseInt(this.account.received_vesting_shares.split(' ')[0]) - parseInt(this.account.delegated_vesting_shares.split(' ')[0]) - parseInt(this.account.vesting_withdraw_rate.split(' ')[0])
      } else {
        return null
      }
    },
    downvotePower: function () {
      return (this.account.downvote_manabar.current_mana / ((this.effectiveVests / 4) * 1e4)) * 100
    },
    downvotePowerPct: function () {
      var pct = (this.downvotePower / 100).toFixed(2)
      if (pct > 100) { pct = 100.00 }
      return pct
    },
    coverImage: function () {
      var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      if (this.account === null) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          if (JSON.parse(this.account.posting_json_metadata).profile) {
            if (JSON.parse(this.account.posting_json_metadata).profile.cover_image) {
              console.log(JSON.parse(this.account.posting_json_metadata).profile.cover_image)
              return JSON.parse(this.account.posting_json_metadata).profile.cover_image
            } else {
              return defaultCover
            }
          } else {
            return defaultCover
          }
        } else {
          return defaultCover
        }
      }
    },
    coverImageStyle: function () {
      if (this.coverImage) {
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center-center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    recentVotes: function () {
      if (this.accountOperations) {
        var last10votes = this.accountOperations.filter(this.filterOpsVotes).slice(0, 10)
        var votesArr = []
        for (var op in last10votes) {
          votesArr.push({ author: last10votes[op][1].op[1].author, permlink: last10votes[op][1].op[1].permlink })
        }
        return votesArr
      } else {
        return null
      }
    },
    resourceBudgetComments: function () {
      if (this.RC.current) {
        var cost = (0.866099987 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetVotes: function () {
      if (this.RC.current) {
        var cost = (0.098893838 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetTransfers: function () {
      if (this.RC.current) {
        var cost = (0.476452196 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    }
  },
  methods: {
    filterOpsVotes (op) { if (op[1].op[0] === 'vote') { return true } else { return false } },
    getAccountHistory (username) {
      var limit = this.accountOperationsLimit
      var page = this.$router.currentRoute.query.page || 1
      var pageReq = this.accountOperationsMarker - (limit * page)
      pageReq = pageReq + limit
      if (pageReq <= (limit - 1)) { pageReq = limit - 1 } // Catch the last (first) page results
      if (page === null || page === 1) { pageReq = -1 } // Get most recent activities on page 1
      this.$hive.api.getAccountHistory(this.username, pageReq, this.accountOperationsLimit, function (err, response) {
        if (err) { console.log(err) }
        this.accountOperations = response.reverse()
      }.bind(this))
    },
    getAccountHistoryMarker (username) {
      this.$hive.api.getAccountHistory(username, -1, 1, function (err, response) {
        if (err) { console.log(err) }
        this.accountOperationsMarker = response[0][0]
        this.getAccountHistory(username)
      }.bind(this))
    },
    accountLink (username) {
      return '/@' + username
    },
    linkBlog (username) { return '/@' + username + '/blog' },
    linkPosts (username) { return '/@' + username + '/posts' },
    linkComments (username) { return '/@' + username + '/comments' },
    linkReplies (username) { return '/@' + username + '/replies' },
    linkFeed (username) { return '/@' + username + '/feed' },
    linkHiveBlog (username) {
      return 'https://hive.blog/@' + username
    },
    linkPeakd (username) {
      return 'https://peakd.com/@' + username
    },
    linkHiveWorld (username) {
      return '/hiveworld/@' + username
    },
    linkTx (txid) {
      return '/tx/' + txid
    },
    getReputation (rep) {
      return this.$hive.formatter.reputation(rep)
    },
    getAccount (username) {
      if (this.$store.state.hive.accounts[username] === undefined) {
        console.log('dispatch sent to get account info for ' + this.username)
        this.$store.dispatch('hive/getAccount', this.username)
      }
    },
    getWitness (username) {
      this.$hive.api.getWitnessByAccountAsync(username)
        .then((response) => {
          this.witness = response
        })
        .catch(() => console.log('Failed to load witness data'))
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getGlobalProps () {
      console.log(this.globalProps)
      console.log(this.globalProps.length)
      if (this.globalProps.empty) {
        this.$store.dispatch('hive/getGlobalProps')
      }
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    },
    getRC (username) { // TODO update this to use hivejs
      var url = 'https://anyx.io/v1/rc_api/find_rc_accounts?accounts=' + username
      this.$axios.get(url)
        .then((res) => {
          res = res.data
          this.RC.max = res.rc_accounts[0].max_rc
          this.RC.current = res.rc_accounts[0].rc_manabar.current_mana
          var percent = parseFloat((this.RC.current / this.RC.max) * 100).toFixed(2)
          if (percent > 100.00) { percent = 100 }
          this.RC.percent = percent
        })
        .catch(() => {
          console.log('error loading RC from anyx.io')
        })
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnBlockLink (blockNum, txId) { return '/b/' + blockNum + '#' + txId },
    init () {
      this.getGlobalProps()
      this.page = this.$router.currentRoute.query.page || 1
      this.username = this.$route.params.username
      document.title = this.username
      if (this.account === undefined || this.account.name !== this.username) {
        this.getAccount(this.username)
        this.getRC(this.username)
        this.getWitness(this.username)
      }
      this.getAccountHistoryMarker(this.username)
    }
  },
  created () {
    this.init()
  }
}
</script>
