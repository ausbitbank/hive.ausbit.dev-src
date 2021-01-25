<template>
  <span v-if="account !== undefined">
    <div class="col-12 text-center full-wdith" :style='coverImageStyle'>
      <router-link :to="getAccountLink(account.name)"><q-avatar class="hvr"><q-img :src="getHiveAvatarUrl(account.name)" /></q-avatar></router-link>
      <div v-if="communityInfo" class="text-h4">{{ communityInfo.title }}</div>
      <div v-else-if="postingJsonMeta && postingJsonMeta.name" class="text-h4" :title="account.name">{{ postingJsonMeta.profile.name }}</div>
      <div v-else class="text-h4">{{ account.name }}</div>
      <div class="text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ postingJsonMeta.profile.about }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ postingJsonMeta.profile.location }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a :href="postingJsonMeta.profile.website"><q-icon name="link" /> {{ postingJsonMeta.profile.website }}</a></div>
            <span v-if="postingJsonMeta.profile.pinned " title="Pinned Post"><a v-if="postingJsonMeta.profile.pinned !== 'none'" :href="returnServiceLink('pinned', postingJsonMeta.profile.pinned)"><q-avatar><q-icon name="push_pin" class="hvr" /></q-avatar></a></span>
        </span>
        <span v-if="communityInfo">
          <div v-if="communityInfo.about">{{ communityInfo.about }}</div>
          <q-btn @click="tab = 'subscribers'" flat v-if="communityInfo.subscribers"> <q-icon name="groups" title="Subscribers (Active Users)" /> {{ tidyNumber(communityInfo.subscribers) }} ({{ tidyNumber(communityInfo.num_authors) }})</q-btn>
          <q-btn flat icon="forum" title="Weekly Interactions"> {{ tidyNumber(communityInfo.num_pending) }}</q-btn>
          <q-btn flat icon="military_tech" title="Pending Payouts"> {{ tidyNumber(communityInfo.sum_pending) }}</q-btn>
        </span>
      </div>
    </div>
    <q-toolbar class="bg-dark text-white" v-if="communityInfo">
      <q-tabs v-model="tab" shrink stretch dense>
        <q-tab name="posts" label="Posts" />
        <q-tab name="about" label="About" />
        <q-tab name="subscribers" label="Subscribers" />
        <q-tab name="activities" label="Activities" />
      </q-tabs>
    </q-toolbar>
    <q-tab-panels v-model="tab" animated v-if="communityInfo">
      <q-tab-panel name="posts">
        <q-tabs v-model="postTab" dense animated shrink stretch>
          <q-route-tab name="created" icon="fiber_new" label="created" :to="'/c/' + account.name + '/created'"/>
          <q-route-tab name="trending" icon="trending_up" color="red" label="trending" :to="'/c/' + account.name + '/trending'"/>
          <q-route-tab name="hot" icon="whatshot" label="hot" :to="'/c/' + account.name + '/hot'"/>
          <q-space />
        </q-tabs>
      </q-tab-panel>
      <q-tab-panel name="about" v-if="communityInfo">
        <div class="text-h6">{{ communityInfo.title }}</div>
        <div>{{ communityInfo.about }}</div>
        <div class="text-h6">Description</div>
        <div v-if="communityInfo.description !== undefined" v-html="communityDescription" />
        <div class="text-h6">Rules</div>
        <div v-if="communityRules" v-html="communityRules" />
        <q-separator />
        <div class="text-h6">Team</div>
        <q-list>
        <q-item v-for="member in communityInfo.team" :key="member.index">
          <q-item-section avatar>
            <router-link :to="getAccountLink(member[0])"><q-avatar><img :src="getHiveAvatarUrl(member[0])" /></q-avatar></router-link>
          </q-item-section>
          <q-item-section>
          <q-item-label>
            {{ member[0] }}
          </q-item-label>
          <q-item-label caption>
            {{ member[2] }}
          </q-item-label>
          <q-item-label>
            <q-badge :color="getRoleColor(member[1])"> {{ member[1] }}</q-badge>
          </q-item-label>
          </q-item-section>
        </q-item>
        </q-list>
      </q-tab-panel>
      <q-tab-panel name="subscribers" v-if="subscribers">
        <div class="text-h6">Subscribers</div>
        <q-spinner-pie color="primary" size="md" v-if="loadingSubscribers" />
        <q-list>
        <q-item v-for="subscriber in subscribers" :key="subscriber.index">
          <q-item-section avatar>
            <router-link :to="getAccountLink(subscriber[0])"><q-avatar><img :src="getHiveAvatarUrl(subscriber[0])" /></q-avatar></router-link>
          </q-item-section>
          <q-item-section>
          <q-item-label>
            <router-link :to="getAccountLink(subscriber[0])">{{ subscriber[0] }}</router-link>
          </q-item-label>
          <q-item-label caption>
            {{ subscriber[1] }} since {{ timeDelta(subscriber[3]) }}
          </q-item-label>
          </q-item-section>
        </q-item>
        </q-list>
      </q-tab-panel>
      <q-tab-panel name="activities" v-if="activities">
        <div class="text-h6">Activities</div>
        <div>Latest activities for this community</div>
        <q-card dense flat bordered>
          <q-card-section>
          <q-spinner-pie color="primary" size="md" v-if="loadingActivities" />
          <q-list separator dense v-if="this.activities !== null">
          <q-item v-for="n in this.activities" :key="n.index" clickable dense>
            <q-item-section avatar>
              <router-link :to="n.url">
                <q-avatar size="lg">
                  <q-img :src="getHiveAvatarUrl(getUserFromMention(n.msg))" />
                </q-avatar>
              </router-link>
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ n.msg.substr(1) }}
              </q-item-label>
              <q-item-label caption>
                {{ timeDelta(n.date) }}
              </q-item-label>
            </q-item-section>
          </q-item>
          </q-list>
          </q-card-section>
          <q-separator />
          <q-card-actions v-if="false">
            <q-btn flat label="Load more notifications" v-if="unreadNotificationCount > notifications.length"/>
          </q-card-actions>
        </q-card>
      </q-tab-panel>
    </q-tab-panels>
  </span>
</template>
<script>
import sanitize from 'sanitize-html'
import moment from 'moment'
import { renderPostBody } from '@ecency/render-helper'
export default {
  name: 'accountHeader',
  data () {
    return {
      communityInfo: null,
      tab: 'posts',
      postTab: 'created',
      subscribers: null,
      activities: null,
      loading: false,
      loadingSubscribers: false,
      loadingActivities: false
    }
  },
  watch: {
    account: function (newData, oldData) {
      this.getCommunity()
      this.getCommunitySubscribers()
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
    showProfile: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    getUserFromMention (mention) { return mention.split(' ')[0].substr(1) },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    },
    getUrl (permlink) { return '/' + permlink },
    getRoleColor (role) {
      if (role === 'owner') { return 'red' }
      if (role === 'admin') { return 'green' }
      if (role === 'mod') { return 'orange' }
    },
    async getCommunity () {
      this.loading = true
      var params = { observer: this.observer, name: this.account.name }
      this.$hive.api.callAsync('bridge.get_community', params)
        .then(response => {
          this.communityInfo = response
          this.loading = false
        })
    },
    async getCommunitySubscribers () {
      this.loadingSubscribers = true
      var params = { community: this.account.name }
      this.$hive.api.callAsync('bridge.list_subscribers', params)
        .then(response => {
          this.subscribers = response
          this.loadingSubscribers = false
        }).bind(this)
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    async getCommunityActivities () {
      var params = { account: this.account.name, limit: 100 }
      this.$hive.api.callAsync('bridge.account_notifications', params)
        .then(response => {
          this.activities = response
          this.loading = false
        })
    }
  },
  computed: {
    communityDescription: function () {
      if (this.communityInfo.description) {
        return renderPostBody(this.communityInfo.description)
      } else {
        return null
      }
    },
    communityRules: function () {
      if (this.communityInfo.flag_text) {
        return renderPostBody(this.communityInfo.flag_text)
      } else {
        return null
      }
    },
    coverImage: function () {
      var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
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
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center-center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
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
    }
  },
  mounted () {
    this.getCommunity()
    // this.$store.hive.commit('hive/getCommunityInfo', this.account.name)
    this.getCommunitySubscribers()
    this.getCommunityActivities()
  }
}
</script>
