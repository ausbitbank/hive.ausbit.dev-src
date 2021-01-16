<template>
  <div class="text-center">
    Show notifications for {{ loggedInUser }} here<br />
    {{ notifications }}
  </div>
</template>
<script>
export default {
  name: 'notifications',
  props: [],
  data () {
    return {
      loading: false,
      params: {
        account: this.loggedInUser,
        limit: 1000
      }
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    async getNotifications () {
      this.loading = true
      this.$hive.api.callAsync('bridge.account_notifications', this.params)
        .then(res => {
          this.notifications = res
          this.loading = false
        })
    }
  },
  mounted () {
    this.getNotifications()
  }
}
</script>
