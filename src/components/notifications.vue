<template>
  <q-btn v-if="loggedInUser && this.$store.state.hive.user.unreadNotificationCount > 0" flat icon="notifications">
    <q-badge color="red" floating>{{ this.$store.state.hive.user.unreadNotificationCount }}</q-badge>
    <q-popup-proxy>
    <q-card flat bordered class="text-center">
      <q-card-section class="text-h6">
        Notifications <q-btn flat icon="check_circle" color="green" title="Mark all notifications as read" @click="markNotificationsRead()"/>
      </q-card-section>
      <q-separator />
      <q-card-section>
      <q-spinner-pie color="secondary" size="5em" v-if="loading" />
      <div v-if="this.notifications !== null">
      <q-item v-for="n in this.notifications" :key="n.index">
        <q-item-section avatar>
          <router-link :to="n.url">
            <q-avatar>
              <q-img :src="getHiveAvatarUrl(getUserFromMention(n.msg))" />
            </q-avatar>
          </router-link>
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ n.msg.substr(1) }}
          </q-item-label>
          <q-item-label caption>
            <router-link :to="getUrl(n.url)">{{ n.url.substr(0,40) }}</router-link> ..
          </q-item-label>
          <q-item-label caption>
            {{ timeDelta(n.date) }}
          </q-item-label>
        </q-item-section>
      </q-item>
      </div>
      </q-card-section>
      <q-separator />
      <q-card-actions v-if="false">
        <q-btn flat label="Load more notifications" v-if="unreadNotificationCount > notifications.length"/>
      </q-card-actions>
    </q-card>
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
          if (this.unreadNotificationCount > 0) {
            this.getNotifications()
          }
        })
    },
    markedNotificationsRead (x) {
      console.log(x)
    },
    async markNotificationsRead () {
      var json = '[ "setLastRead",{"date":"' + moment.utc().format('YYYY-MM-DDTHH:mm:ss') + '"}]'
      window.hive_keychain.requestCustomJson(this.loggedInUser, 'notify', 'Posting', json, 'Mark notifications as read', function (response) {
        console.log(response)
      })
      /* window.hive_keychain.requestCustomJson(username, id, KeyType, json of request, friendly message for user, callback (res) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestCustomJson', this.loggedInUser, json, 'Posting', 'Mark Notifications as read')
      if (success) {
        this.notifications = []
        this.getUnreadNotificationCount()
      }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
        } else if (notInstalled) { // alert('Please install Keychain')
          console.error('Keychain not available')
        } else {
          console.info(msg)
        }
      } */
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
    }
  },
  mounted () {
    this.getUnreadNotificationCount()
  }
}
</script>
