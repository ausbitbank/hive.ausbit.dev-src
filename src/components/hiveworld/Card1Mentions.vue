<template>
  <div>
    <q-spinner-pie color="secondary" size="5em" v-if="loading.notifications" />
    <div v-if="this.notifications !== null">
    <q-item v-for="n in this.notifications.filter(filterMentions)" :key="n.index">
      <q-item-section avatar>
        <a :href="getUrl(n.url)" target="_blank">
          <q-avatar>
            <q-img :src="getHiveAvatarUrl(getUserFromMention(n.msg))" />
          </q-avatar>
        </a>
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ n.msg.substr(1) }}
        </q-item-label>
        <q-item-label caption>
          <a :href="getUrl(n.url)" target="_blank">{{ n.url.substr(0,100) }}</a> ..
        </q-item-label>
        <q-item-label caption>
          {{ getRelativeTime(n.date) }}
        </q-item-label>
      </q-item-section>
    </q-item>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
export default {
  name: 'Card1Mentions',
  props: ['username'],
  data () {
    return {
      api: 'https://api.hive.blog',
      notifications: null,
      loading: {
        notifications: false
      }
    }
  },
  methods: {
    filterMentions (n) {
      if (n.type === 'mention') {
        return true
      } else {
        return false
      }
    },
    getRelativeTime (time) {
      return moment.utc(time).fromNow()
    },
    getUrl (permlink) {
      return 'https://peakd.com/' + permlink
    },
    getHiveAvatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    getUserFromMention (mention) {
      return mention.split(' ')[0].substr(1)
    },
    getNotifications () {
      this.loading.notifications = true
      this.$axios.post(this.api, {
        jsonrpc: '2.0',
        method: 'bridge.account_notifications',
        params: {
          account: this.username,
          limit: 100
        },
        id: 1
      })
        .then((res) => {
          this.notifications = res.data.result
          this.loading.notifications = false
        })
    }
  },
  mounted () {
    this.getNotifications()
  }
}
</script>
