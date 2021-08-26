<template>
    <div class="col-12 text-center full-width" :style='coverImageStyle' v-if="account !== undefined && globalProps !== undefined">
        <q-card flat bordered class="text-center text-subtitle q-pa-md q-ma-md float-right" v-if="showBalances">
            <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
            <div>{{ tidyNumber(account.balance.split(' ')[0]) }} HIVE</div>
            <div>{{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD</div>
        </q-card>
      <router-link :to="getAccountLink(account.name)"><q-avatar class="hvr"><q-img :src="getHiveAvatarUrl(account.name)" /></q-avatar></router-link>
      <div class="text-h4">{{ account.name }}</div>
      <div class="text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ Sanitize(postingJsonMeta.profile.about) }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ Sanitize(postingJsonMeta.profile.location) }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a :href="postingJsonMeta.profile.website"><q-icon name="link" /> {{ Sanitize(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</a></div>
        </span>
        <div v-if="showFollowCount && followCount" class="text-caption">
          <span v-if="followCount.following_count > 0"><q-icon name="people" /><router-link :to="linkFollowing"> {{ tidyNumber(followCount.following_count) }} <span class="text-grey">following</span></router-link>&nbsp;</span>
          <span v-if="followCount.follower_count > 0"><q-icon name="people_alt" /><router-link :to="linkFollowers"> {{ tidyNumber(followCount.follower_count) }} <span class="text-grey">followers</span></router-link></span>
        </div>
        <div v-if="showRelationship && this.relationship && this.account !== undefined">
          <q-btn v-if="relationship.follows" no-caps push dense label="Following" color="primary" icon="star" @click="unfollowUser(account.name)" />
          <q-btn v-if="!relationship.follows" no-caps push dense label="Follow" color="grey" icon="person_add" @click="followUser(account.name)" />
          <q-btn v-if="relationship.ignores" no-caps push dense label="Ignored" color="red" @click="unignoreUser(account.name)" />
          <q-btn v-if="!relationship.ignores && !relationship.follows" no-caps push dense label="Ignore" color="grey" icon="volume_off" @click="ignoreUser(account.name)" />
        </div>
        <span v-if="postingJsonMeta.profile">
          <user-services :username="account.name" />
        </span>
      </div>
      <q-toolbar :dense="$q.screen.lt.md" class="rounded-borders bg-dark text-white text-center" v-if="showNavBar">
        <q-tabs v-model="tab" :dense="$q.screen.lt.md" animated shrink inline-label active-color="white" indicator-color="secondary" align="justify" class="text-center" style="margin:auto">
          <q-route-tab name="posts" class="text-deep-purple" label="posts" icon="library_books" :to="'/@' + account.name + '/posts'"/>
          <q-route-tab name="blog" class="text-purple" label="blog" icon="menu_book" :to="'/@' + account.name + '/blog'"/>
          <q-route-tab name="feed" class="text-orange" label="feed" icon="rss_feed" :to="'/@' + account.name + '/feed'"/>
          <q-route-tab name="replies" class="text-blue-grey" label="replies" icon="comment" :to="'/@' + account.name + '/replies'"/>
          <q-route-tab name="comments" label="comments" icon="message" :to="'/@' + account.name + '/comments'"/>
          <q-route-tab name="communities" class="text-teal" label="communities" icon="forum" :to="'/@' + account.name + '/communities'"/>
          <q-route-tab name="wallet" class="text-green" label="wallet" icon="account_balance" :to="'/@' + account.name + '/wallet'"/>
          <q-route-tab exact name="explorer" class="text-indigo" icon="perm_identity" label="profile" :to="'/@' + account.name"/>
          <q-route-tab v-if="this.$route.path.endsWith('/tip')" name="tip" label="tip" :to="'/@' + account.name + '/tip'"/>
        </q-tabs>
      </q-toolbar>
    </div>
</template>
<script>
import sanitize from 'sanitize-html'
export default {
  name: 'accountHeader',
  data () {
    return {
      tab: 'posts',
      relationship: null
    }
  },
  props: {
    account: {
      required: false
    },
    globalProps: {
      type: Object,
      required: true
    },
    showBalances: {
      type: Boolean,
      required: false,
      default: true
    },
    showProfile: {
      type: Boolean,
      required: false,
      default: true
    },
    showNavBar: {
      type: Boolean,
      required: false,
      default: true
    },
    showRelationship: {
      type: Boolean,
      required: false,
      default: true
    },
    showFollowCount: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  components: {
    userServices: () => import('components/userServices.vue')
  },
  methods: {
    getUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
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
    Sanitize (input) {
      return sanitize(input)
    },
    getRelationshipBetweenAccounts (account1, account2) {
      var method = 'bridge.get_relationship_between_accounts'
      var params = [account1, account2]
      this.$hive.api.callAsync(method, params)
        .then(response => {
          this.relationship = response
        })
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getFollowCount (who) {
      this.$store.dispatch('hive/getFollowCount', who)
    },
    followUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["blog"] }]'
      this.relationship.follows = true
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    unfollowUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": [] }]'
      this.relationship.follows = false
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    ignoreUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["ignore"] }]'
      this.relationship.ignores = true
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    unignoreUser (who) {
      this.relationship.ignores = false
      this.unfollowUser(who)
    }
  },
  computed: {
    coverImage: function () {
      // var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      var defaultCover = ''
      if (this.account === null) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          if (JSON.parse(this.account.posting_json_metadata).profile) {
            if (JSON.parse(this.account.posting_json_metadata).profile.cover_image) {
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
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center, center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    postingJsonMeta: function () {
      if (this.account.posting_json_metadata) {
        return JSON.parse(sanitize(this.account.posting_json_metadata))
      } else {
        return null
      }
    },
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    followCount: {
      get () { return this.$store.state.hive.followCounts[this.account.name] }
    },
    linkFollowers: { get () { return '/@' + this.account.name + '/followers' } },
    linkFollowing: { get () { return '/@' + this.account.name + '/following' } }
  },
  mounted () {
    if (this.showRelationship && this.loggedInUser !== undefined && this.loggedInUser !== null && this.loggedInUser !== this.account.name && this.relationship === null) {
      this.getRelationshipBetweenAccounts(this.loggedInUser, this.account.name)
    }
    if (this.showFollowCount && this.followCount === undefined) { this.getFollowCount(this.account.name) }
  }
}
</script>
