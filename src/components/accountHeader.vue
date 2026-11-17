<template>
    <div class="col-12 text-center full-width account-header" :style='coverImageStyle' v-if="account !== undefined && globalProps !== undefined">
        <q-card flat bordered class="account-header__balances text-center text-subtitle q-pa-md q-ma-md float-right" v-if="showBalances && account !== undefined">
            <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
            <div>{{ tidyNumber(account.balance.split(' ')[0]) }} HIVE</div>
            <div>{{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD</div>
        </q-card>
      <router-link class="account-header__avatar" :to="getAccountLink(account.name)" :aria-label="'View @' + account.name + ' profile'"><q-avatar class="hvr"><q-img :src="getHiveAvatarUrl(account.name)" :alt="'Avatar of @' + account.name" /></q-avatar></router-link>
      <component :is="headingTag" class="account-header__name q-my-none">{{ account.name }}</component>
      <div class="account-header__profile text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ stripHtml(postingJsonMeta.profile.about) }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ stripHtml(postingJsonMeta.profile.location) }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a v-if="safeWebsite" :href="safeWebsite"><q-icon name="link" /> {{ stripHtml(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</a><span v-else><q-icon name="link" /> {{ stripHtml(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</span></div>
        </span>
        <div v-if="showFollowCount && followCount" class="text-caption">
          <span v-if="followCount.following_count > 0"><q-icon name="people" /><router-link :to="linkFollowing"> {{ tidyNumber(followCount.following_count) }} <span class="text-grey">following</span></router-link>&nbsp;</span>
          <span v-if="followCount.follower_count > 0"><q-icon name="people_alt" /><router-link :to="linkFollowers"> {{ tidyNumber(followCount.follower_count) }} <span class="text-grey">followers</span></router-link></span>
        </div>
        <div v-if="showRelationship && relationship && account !== undefined">
          <q-btn v-if="relationship.follows" no-caps push dense label="Following" color="primary" icon="star" @click="unfollowUser(account.name)" />
          <q-btn v-if="!relationship.follows" no-caps push dense label="Follow" color="grey" icon="person_add" @click="followUser(account.name)" />
          <q-btn v-if="relationship.ignores" no-caps push dense label="Ignored" color="red" @click="unignoreUser(account.name)" />
          <q-btn v-if="!relationship.ignores && !relationship.follows" no-caps push dense label="Ignore" color="grey" icon="volume_off" @click="ignoreUser(account.name)" />
        </div>
        <div class="service-strip" v-if="postingJsonMeta.profile">
          <user-services :username="account.name" />
        </div>
      </div>
      <q-toolbar :dense="$q.screen.lt.md" class="account-tabs bg-dark text-white text-center" style="max-width: 100%; overflow: hidden" v-if="showNavBar">
        <q-tabs
          :dense="$q.screen.lt.md"
          :mobile-arrows="$q.screen.lt.sm"
          :align="$q.screen.lt.sm ? 'left' : 'center'"
          no-caps
          inline-label
          active-color="white"
          indicator-color="secondary"
          class="text-grey-4 full-width"
        >
          <q-route-tab name="posts" label="posts" icon="library_books" :to="'/@' + account.name + '/posts'"/>
          <q-route-tab name="blog" label="blog" icon="menu_book" :to="'/@' + account.name + '/blog'"/>
          <q-route-tab name="feed" label="feed" icon="rss_feed" :to="'/@' + account.name + '/feed'"/>
          <q-route-tab name="replies" label="replies" icon="comment" :to="'/@' + account.name + '/replies'"/>
          <q-route-tab name="comments" label="comments" icon="message" :to="'/@' + account.name + '/comments'"/>
          <q-route-tab name="communities" label="communities" icon="forum" :to="'/@' + account.name + '/communities'"/>
          <q-route-tab name="wallet" label="wallet" icon="account_balance" :to="'/@' + account.name + '/wallet'"/>
          <q-route-tab exact name="explorer" icon="perm_identity" label="profile" :to="'/@' + account.name"/>
          <q-route-tab v-if="$route.path.endsWith('/tip')" name="tip" label="tip" :to="'/@' + account.name + '/tip'"/>
        </q-tabs>
      </q-toolbar>
    </div>
</template>
<style scoped>
.account-header {
  position: relative;
  padding: 1.25rem 0.75rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background-color: #0b1014;
  background-position: center, center;
  background-repeat: no-repeat;
  background-size: cover, cover;
}
.account-header__name {
  font-size: clamp(1.5rem, 3.2vw, 2.1rem);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.55);
  overflow-wrap: anywhere;
}
.account-header__avatar {
  display: inline-block;
  margin-bottom: 0.35rem;
}
.account-header__avatar :deep(.q-avatar) {
  width: 88px;
  height: 88px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}
.account-header__profile {
  max-width: 720px;
  margin: 0.5rem auto 0;
  padding: 0 0.25rem;
  line-height: 1.5;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}
.account-header__profile :deep(.q-icon) {
  font-size: 1.05em;
  vertical-align: -2px;
  margin-right: 2px;
  opacity: 0.85;
}
.account-header__balances {
  max-width: 210px;
  border-color: rgba(255, 255, 255, 0.14) !important;
  border-radius: var(--radius-card, 10px);
  background: rgba(8, 13, 17, 0.78) !important;
  box-shadow: var(--shadow-card, 0 6px 18px rgba(0, 0, 0, 0.26));
}
.account-tabs {
  max-width: 1100px;
  min-height: 48px;
  margin: 0.9rem auto 0.15rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-card, 10px);
  background: rgba(8, 13, 17, 0.84) !important;
  box-shadow: none;
}
.account-tabs :deep(.q-tab) {
  min-height: 44px;
}
.service-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.6rem;
}
@media (max-width: 599px) {
  .account-header {
    padding: 0.9rem 0.5rem 0.6rem;
  }
  .account-header__balances {
    float: none;
    display: inline-block;
    margin: 0.5rem auto;
  }
  .account-header__avatar :deep(.q-avatar) {
    width: 72px;
    height: 72px;
  }
  .account-tabs {
    margin-top: 0.6rem;
  }
}
</style>
<script>
import { defineAsyncComponent } from 'vue'
import { stripHtml, safeJsonParse } from 'src/utils/safeHtml'
import { safeExternalUrl } from 'src/utils/safeUrl'
export default {
  name: 'accountHeader',
  data () {
    return {
      relationship: null
    }
  },
  props: {
    account: {
      required: false
    },
    headingTag: {
      type: String,
      default: 'h1'
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
    userServices: defineAsyncComponent(() => import('components/userServices.vue'))
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
    stripHtml,
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
      this.$hiveStore.getFollowCount(who)
    },
    followUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["blog"] }]'
      this.relationship.follows = true
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    unfollowUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": [] }]'
      this.relationship.follows = false
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    ignoreUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["ignore"] }]'
      this.relationship.ignores = true
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
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
      if (this.account === undefined) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          const meta = safeJsonParse(this.account.posting_json_metadata)
          if (meta.profile && meta.profile.cover_image) {
            return meta.profile.cover_image
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
        return { 'background-image': 'linear-gradient(rgba(6, 10, 14, 0.2) 0%, rgba(6, 10, 14, 0.32) 40%, rgba(8, 12, 16, 0.86) 100%), url(' + this.coverImage + ')', 'background-position': 'center, center', 'background-repeat': 'no-repeat', 'background-size': 'cover, cover', 'background-clip': 'border-box, border-box', 'background-color': '#0b1014', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    postingJsonMeta: function () {
      if (this.account && this.account.posting_json_metadata) {
        return safeJsonParse(this.account.posting_json_metadata)
      } else {
        return null
      }
    },
    safeWebsite: function () {
      if (this.postingJsonMeta && this.postingJsonMeta.profile) {
        return safeExternalUrl(this.postingJsonMeta.profile.website)
      }
      return null
    },
    loggedInUser: {
      get () { return this.$hiveStore.user.username || null }
    },
    followCount: {
      get () { return this.account ? (this.$hiveStore.followCounts[this.account.name] || null) : null }
    },
    linkFollowers: { get () { return this.account ? '/@' + this.account.name + '/followers' : '#' } },
    linkFollowing: { get () { return this.account ? '/@' + this.account.name + '/following' : '#' } }
  },
  mounted () {
    if (!this.account) return
    if (this.showRelationship && this.loggedInUser && this.loggedInUser !== this.account.name && this.relationship === null) {
      this.getRelationshipBetweenAccounts(this.loggedInUser, this.account.name)
    }
    if (this.showFollowCount) {
      this.getFollowCount(this.account.name)
    }
  }
}
</script>
