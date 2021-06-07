<template>
  <q-btn v-if="loggedInUser" flat icon="notifications">
    <q-badge color="red" v-if="this.$store.state.hive.user.unreadNotificationCount > 0" floating>{{ this.$store.state.hive.user.unreadNotificationCount }}</q-badge>
    <q-popup-proxy>
    <transition appear enter-active-class="animated fadeInDown" leave-active-class="animated fadeOutUp">
    <q-card dense flat bordered class="text-center q-pa-none q-ma-none">
      <q-card-section horizontal dense class="text-title flex-center text-center">
        Notifications <q-btn flat icon="check_circle" size="sm" color="green" title="Mark all notifications as read" @click="markNotificationsRead()" v-if="this.$store.state.hive.user.unreadNotificationCount > 0"/><q-btn flat icon="refresh" size="sm" color="blue" title="Refresh notifications" @click="getUnreadNotificationCount()"/>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-ma-none q-pa-none" v-if="this.$store.state.hive.user.unreadNotificationCount > 0">
      <q-list separator dense v-if="this.notifications !== null" class="q-pa-none q-ma-none">
      <q-item v-for="n in this.notifications" :key="n.index" clickable @click="$router.push(n.url)" dense>
        <q-item-section avatar>
          <router-link :to="n.url">
            <q-avatar size="md" v-if="n.msg">
              <q-img :src="getHiveAvatarUrl(getUserFromMention(n.msg))" />
            </q-avatar>
          </router-link>
        </q-item-section>
        <q-item-section v-if="n.msg">
          <q-item-label>
            {{ n.msg.substr(1) }}
          </q-item-label>
          <q-item-label caption>
            <router-link :to="getUrl(n.url)">{{ n.url.substr(0,40) }}</router-link>
          </q-item-label>
          <q-item-label caption>
            {{ timeDelta(n.date) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="circle" :size="returnScoreSize(n.score)" :color="returnScoreColor(n.score)" :title="n.score" />
        </q-item-section>
      </q-item>
      </q-list>
      </q-card-section>
      <q-card-actions v-if="false">
        <q-btn flat label="Load more notifications" v-if="unreadNotificationCount > notifications.length"/>
      </q-card-actions>
    </q-card>
    </transition>
    </q-popup-proxy>
  </q-btn>
</template>
<script>
import moment from 'moment'
// import { keychain } from '@hiveio/keychain'
export default {
  name: 'notifications',
  props: [],
  data () {
    return {
      loading: false,
      last_id: null,
      limit: 100
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    notifications: {
      get () { return this.$store.state.hive.user.notifications },
      set (val) { this.$store.commit('hive/updateNotifications', val) }
    },
    unreadNotificationCount: {
      get () { return this.$store.state.hive.user.unreadNotificationCount },
      set (val) { this.$store.commit('hive/updateUnreadNotificationCount', val) }
    }
  },
  watch: {
    loggedInUser: function (newState, oldState) {
      if (newState !== '') {
        this.getUnreadNotificationCount()
      }
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    async getNotifications () {
      this.loading = true
      var params = { account: this.loggedInUser, last_id: this.last_id, limit: Math.min(this.unreadNotificationCount, this.limit) }
      this.$hive.api.callAsync('bridge.account_notifications', params)
        .then(response => {
          this.notifications = response
          this.loading = false
        })
    },
    async getUnreadNotificationCount () {
      this.loading = true
      var params = { account: this.loggedInUser }
      this.$hive.api.callAsync('bridge.unread_notifications', params)
        .then(res => {
          this.unreadNotificationCount = res.unread
          this.loading = false
          if (this.unreadNotificationCount === 0) { this.notifications = null }
          if (this.unreadNotificationCount > 0) { this.getNotifications() }
        })
    },
    async markNotificationsRead () {
      var json = '[ "setLastRead",{"date":"' + moment.utc().format('YYYY-MM-DDTHH:mm:ss') + '"}]'
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'notify', json: json }]])
    },
    filterMentions (n) {
      if (n.type === 'mention') {
        return true
      } else {
        return false
      }
    },
    getRelativeTime (time) {
      return moment(time).fromNow()
    },
    getUrl (permlink) {
      return '/' + permlink
    },
    getUserFromMention (mention) {
      return mention.split(' ')[0].substr(1)
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    returnScoreColor (score) {
      var s = parseInt(score)
      if (s >= 90) { return 'red-14' } else
      if (s >= 75) { return 'deep-purple' } else
      if (s >= 60) { return 'indigo' } else
      if (s >= 45) { return 'blue' } else
      if (s >= 30) { return 'light-blue' } else { return 'grey' }
    },
    returnScoreSize (score) {
      var s = parseInt(score)
      if (s >= 90) { return 'lg' } else
      if (s >= 60) { return 'md' } else
      if (s >= 20) { return 'sm' } else
      if (s >= 0) { return 'xs' }
    }
  },
  mounted () {
    if (this.loggedInUser !== '') {
      console.log('getting unread notification count for ' + this.loggedInUser)
      this.getUnreadNotificationCount()
    }
  }
}
</script>
