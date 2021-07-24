<template>
  <div class="text-center" :style='coverImageStyle'>
    <router-link :to="'/@' + username" v-if="profile"><q-avatar size="6rem" v-if="profile.profile_image" class="q-pt-xs hvr"><q-img :src="getHiveAvatarUrl(username)" /></q-avatar></router-link>
    <div v-if="!profile"><router-link :to="'/@' + username">@{{ username }}</router-link></div>
    <div v-if="profile">
      <div v-if="profile.name" class="text-title text-bold">{{ profile.name }}</div><router-link :to="'/@' + username">@{{username}}</router-link>
      <div v-if="profile.about" class="text-caption">{{ profile.about }}</div>
      <div v-if="profile.location" class="text-subtitle text-grey"><q-icon name="place" class="q-mr-xs" />{{ profile.location }}</div>
      <div v-if="profile.website" class="text-caption"><q-icon name="open_in_browser" class="q-mr-xs" /><a :href="profile.website" target="_blank" class="text-primary">{{ profile.website.replace('https://','').replace('http://','').replace('www.','') }}</a></div>
      <user-services :username="username" />
    </div>
    <div class="text-center">
        <span v-if="account && roundedHPTidy !== '0' && roundedHPTidy !== null" title="Hive Power (rounded)" class="q-mr-md"><q-icon name="img:statics/hive.svg" /> {{ roundedHPTidy }}</span>
        <span class="q-mr-md text-caption" v-if="account && account.last_post !== '1970-01-01T00:00:00'">Posted: <router-link :to="linkPosts(account.name)"><span :title="account.last_post">{{ timeDelta(account.last_post) }}</span></router-link></span>
        <span v-if="account && account.last_vote_time !== '1970-01-01T00:00:00'" class="text-caption">Voted: {{ timeDelta(account.last_vote_time) }}</span>
        <q-fab flat dense v-if="loggedInUser && username !== loggedInUser" color="primary" icon="settings" direction="left" :persistent="false" size="xs" @click="getRelationship(username)">
            <q-spinner-grid v-if="relationship === null" color="primary" />
            <span v-if="relationship">
            <q-fab-action v-if="relationship.follows" no-caps push dense label="Following" color="primary" icon="star" @click="unfollowUser(account.name)" />
            <q-fab-action v-if="!relationship.follows" no-caps push dense label="Follow" color="grey" icon="person_add" @click="followUser(account.name)" />
            <q-fab-action v-if="relationship.ignores" no-caps push dense label="Ignored" color="red" @click="unignoreUser(account.name)" />
            <q-fab-action v-if="!relationship.ignores && !relationship.follows" no-caps push dense label="Ignore" color="grey" icon="volume_off" @click="ignoreUser(account.name)" />
            </span>
        </q-fab>
    </div>
    <q-separator color="primary" />
  </div>
</template>
<script>
import moment from 'moment'
export default {
  name: 'userCard',
  props: ['username'],
  data () {
    return {
      relationship: null
    }
  },
  components: {
    userServices: () => import('components/userServices.vue')
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    timeDelta (timestamp) { var now = moment.utc(); var stamp = moment.utc(timestamp); var diff = stamp.diff(now, 'minutes'); return moment.duration(diff, 'minutes').humanize(true) },
    linkPost (author, permlink) { return '/@' + author + '/' + permlink },
    linkPosts (author) { return '/@' + author + '/posts' },
    vestToHive (vests) { if (this.globalProps) { return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3) } else { return null } },
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    getRelationshipBetweenAccounts (account1, account2) {
      var method = 'bridge.get_relationship_between_accounts'
      var params = [account1, account2]
      this.$hive.api.callAsync(method, params)
        .then(response => {
          this.relationship = response
        })
    },
    getRelationship (account) { this.getRelationshipBetweenAccounts(this.loggedInUser, account) },
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
  mounted () {},
  computed: {
    account: function () { return this.$store.state.hive.accounts[this.username] },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    meta: function () {
      if (this.account !== undefined) {
        if (this.account.posting_json_metadata) {
          return JSON.parse(this.account.posting_json_metadata)
        } else if (this.account.json_metadata) {
          return JSON.parse(this.account.json_metadata)
        } else {
          return null
        }
      } else { return null }
    },
    profile: function () {
      if (this.account !== undefined && this.meta) {
        if (this.meta.profile) { return this.meta.profile } else { return null }
      } else { return null }
    },
    coverImage: function () {
      // var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      var defaultCover = ''
      if (this.account === undefined) {
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
    roundedHPTidy: function () {
      if (this.account !== undefined) {
        return this.tidyNumber(parseInt(this.vestToHive(this.account.vesting_shares.split(' ')[0])))
      } else {
        return null
      }
    },
    coverImageStyle: function () {
      if (this.coverImage) {
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center, center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    globalProps: function () { return this.$store.state.hive.globalProps }
  }
}
</script>
