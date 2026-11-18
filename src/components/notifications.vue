<template>
  <q-btn
    v-if="loggedInUser"
    flat
    icon="notifications"
    :aria-label="notificationButtonLabel"
    :title="notificationButtonLabel"
  >
    <q-badge color="primary" v-if="unreadNotificationCount > 0" floating>{{ unreadNotificationCount }}</q-badge>
    <q-popup-proxy @before-show="refreshOnOpen">
      <q-card flat bordered class="home-card home-panel notifications-panel">
        <q-card-section class="home-panel__head">
          <div>
            <div class="home-eyebrow">
              <span class="home-live-dot is-live" aria-hidden="true"></span>
              Inbox
            </div>
            <h2 class="home-panel__title">Notifications</h2>
          </div>
          <div class="home-panel__actions">
            <q-btn
              flat
              dense
              no-caps
              color="green"
              :icon="markQueued ? 'schedule' : 'done_all'"
              :label="markQueued ? 'Queued' : 'Mark read'"
              :disable="unreadNotificationCount === 0 || markQueued"
              aria-label="Mark all notifications as read"
              title="Mark all notifications as read"
              @click="markNotificationsRead"
            />
            <q-btn
              flat
              dense
              round
              icon="refresh"
              color="primary"
              :loading="loading"
              aria-label="Refresh notifications"
              title="Refresh notifications"
              @click="refreshOnOpen"
            />
          </div>
        </q-card-section>

        <div class="notifications-toolbar">
          <q-select
            v-model="filter"
            :options="filterOptions"
            dense
            outlined
            emit-value
            map-options
            options-dense
            label="Filter"
            aria-label="Filter notifications"
            class="notifications-filter"
          />
          <q-toggle v-model="unreadOnly" dense label="Unread only" class="notifications-unread" />
        </div>

        <q-separator />

        <div v-if="loadError" class="notifications-state notifications-state--error" role="status">
          <q-icon name="warning" size="20px" aria-hidden="true" />
          <span>{{ loadError }}</span>
          <q-btn flat dense no-caps color="primary" label="Retry" @click="refreshOnOpen" />
        </div>

        <div v-else-if="loading && notifications.length === 0" class="notifications-skeleton">
          <div v-for="i in 6" :key="i" class="notifications-skeleton__row">
            <q-skeleton type="circle" size="30px" />
            <div class="notifications-skeleton__body">
              <q-skeleton type="text" width="78%" />
              <q-skeleton type="text" width="38%" />
            </div>
          </div>
        </div>

        <q-scroll-area v-else class="notifications-scroll" :thumb-style="{ width: '5px', borderRadius: '5px', opacity: 0.25, backgroundColor: '#4fc3f7' }">
          <div v-if="filteredNotifications.length === 0" class="notifications-state">
            <q-icon name="notifications_none" size="26px" color="grey" aria-hidden="true" />
            <span v-if="unreadOnly">No unread notifications match this filter.</span>
            <span v-else>No notifications match this filter.</span>
          </div>

          <q-list v-else separator role="menu" aria-label="Notifications">
            <q-item
              v-for="notification in filteredNotifications"
              :key="notification.id"
              clickable
              v-close-popup
              role="menuitem"
              class="notification-row"
              @click="openNotification(notification)"
            >
              <q-item-section avatar>
                <q-avatar size="30px">
                  <q-img
                    v-if="actorFor(notification)"
                    :src="avatarUrl(actorFor(notification))"
                    :alt="'Avatar of @' + actorFor(notification)"
                  />
                  <q-icon v-else name="notifications" size="18px" aria-hidden="true" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <div class="notification-row__message">
                  <q-badge v-if="unreadIds.has(notification.id)" color="primary" class="notification-row__dot" aria-label="Unread" />
                  {{ plainMessage(notification.msg) }}
                </div>
                <div class="notification-row__meta">
                  <span>{{ typeLabel(notification) }}</span>
                  <span aria-hidden="true">·</span>
                  <time :datetime="notification.date">{{ timeAgo(notification.date) }}</time>
                </div>
              </q-item-section>

              <q-item-section side>
                <q-icon
                  name="circle"
                  :size="scoreSize(notification.score)"
                  :color="scoreColor(notification.score)"
                  :aria-label="'Score ' + notification.score"
                  :title="'Score ' + notification.score"
                />
              </q-item-section>
            </q-item>
          </q-list>

          <div class="notifications-load">
            <q-btn
              v-if="!reachedEnd"
              flat
              dense
              no-caps
              color="primary"
              icon="expand_more"
              label="Load more"
              :loading="loadingMore"
              @click="loadMore"
            />
            <span v-else class="notifications-end">End of notifications</span>
          </div>
        </q-scroll-area>

        <q-card-section class="home-panel__footer">
          <span>{{ unreadNotificationCount }} unread · {{ notifications.length }} loaded</span>
          <span v-if="markQueued" class="notifications-queued">Mark-read queued</span>
          <span v-else>Updates every 60 seconds</span>
        </q-card-section>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>

<script>
import moment from 'src/utils/time'
import {
  NOTIFICATION_FILTERS,
  filterNotifications,
  mergeNotifications,
  notificationActor,
  notificationPath,
  notificationTypeLabel,
  plainNotificationMessage,
  unreadNotificationIds
} from 'src/services/notifications'

export default {
  name: 'notifications',
  data () {
    return {
      loading: false,
      loadingMore: false,
      loadError: '',
      filter: 'all',
      unreadOnly: false,
      reachedEnd: false,
      markQueued: false,
      limit: 20,
      pollTimer: null,
      initialRefreshHandle: null
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    notifications () {
      return this.$hiveStore.user.notifications || []
    },
    unreadNotificationCount () {
      return this.$hiveStore.user.unreadNotificationCount || 0
    },
    lastReadAt () {
      return this.$hiveStore.user.notificationsLastRead || null
    },
    filterOptions () {
      return NOTIFICATION_FILTERS
    },
    unreadIds () {
      return unreadNotificationIds(this.notifications, this.lastReadAt, this.unreadNotificationCount)
    },
    filteredNotifications () {
      return filterNotifications(this.notifications, {
        filter: this.filter,
        unreadOnly: this.unreadOnly,
        unreadIds: this.unreadIds
      })
    },
    notificationButtonLabel () {
      const count = this.unreadNotificationCount
      return count > 0 ? count + ' unread notification' + (count === 1 ? '' : 's') : 'Notifications'
    }
  },
  watch: {
    loggedInUser (value, previous) {
      if (value === previous) return
      this.resetInbox()
      if (value) {
        this.scheduleInitialRefresh()
      } else {
        this.cancelInitialRefresh()
        this.stopPolling()
      }
    },
    unreadNotificationCount (value) {
      if (value === 0) this.markQueued = false
    }
  },
  mounted () {
    if (this.loggedInUser) this.scheduleInitialRefresh()
  },
  beforeUnmount () {
    this.cancelInitialRefresh()
    this.stopPolling()
  },
  methods: {
    scheduleInitialRefresh () {
      if (typeof window === 'undefined') {
        if (this.loggedInUser) {
          this.startPolling()
          this.refreshUnreadCount()
        }
        return
      }
      if (this.initialRefreshHandle) return
      const run = () => {
        this.initialRefreshHandle = null
        if (!this.loggedInUser) return
        this.startPolling()
        this.refreshUnreadCount()
      }
      if (typeof window.requestIdleCallback === 'function') {
        this.initialRefreshHandle = window.requestIdleCallback(run, { timeout: 2500 })
      } else {
        this.initialRefreshHandle = window.setTimeout(run, 1200)
      }
    },
    cancelInitialRefresh () {
      if (!this.initialRefreshHandle) return
      if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(this.initialRefreshHandle)
      } else {
        clearTimeout(this.initialRefreshHandle)
      }
      this.initialRefreshHandle = null
    },
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + encodeURIComponent(user || 'null') + '/avatar'
    },
    actorFor (notification) {
      return notificationActor(notification?.msg)
    },
    plainMessage (message) {
      return plainNotificationMessage(message)
    },
    typeLabel (notification) {
      return notificationTypeLabel(notification)
    },
    timeAgo (value) {
      return value ? moment.utc(value).fromNow() : '—'
    },
    scoreColor (score) {
      const value = parseInt(score, 10)
      if (value >= 90) return 'red-14'
      if (value >= 75) return 'deep-purple'
      if (value >= 60) return 'indigo'
      if (value >= 45) return 'blue'
      if (value >= 30) return 'light-blue'
      return 'grey'
    },
    scoreSize (score) {
      const value = parseInt(score, 10)
      if (value >= 90) return 'lg'
      if (value >= 60) return 'md'
      if (value >= 20) return 'sm'
      return 'xs'
    },
    openNotification (notification) {
      this.$router.push(notificationPath(notification?.url))
    },
    resetInbox () {
      this.$hiveStore.updateNotifications([])
      this.$hiveStore.updateUnreadNotificationCount(0)
      this.$hiveStore.updateNotificationsLastRead(null)
      this.reachedEnd = false
      this.loadError = ''
      this.markQueued = false
    },
    async refreshOnOpen () {
      if (!this.loggedInUser) return
      this.loadError = ''
      await Promise.allSettled([
        this.refreshUnreadCount(),
        this.loadNotifications({ reset: true })
      ])
    },
    async refreshUnreadCount () {
      if (!this.loggedInUser) return
      try {
        const response = await this.$hive.api.callAsync('bridge.unread_notifications', { account: this.loggedInUser })
        const unread = Number(response?.unread) || 0
        this.$hiveStore.updateUnreadNotificationCount(unread)
        if (response?.lastread) this.$hiveStore.updateNotificationsLastRead(response.lastread)
      } catch (error) {
        console.error('Failed to load unread notification count', error)
      }
    },
    async loadNotifications ({ reset = false } = {}) {
      if (!this.loggedInUser) return
      if (reset) this.loading = true
      else this.loadingMore = true
      this.loadError = ''

      const lastId = reset ? null : this.notifications[this.notifications.length - 1]?.id
      const params = { account: this.loggedInUser, limit: this.limit }
      if (lastId) params.last_id = lastId

      try {
        const response = await this.$hive.api.callAsync('bridge.account_notifications', params)
        const page = Array.isArray(response) ? response : []
        this.$hiveStore.updateNotifications(reset
          ? mergeNotifications([], page)
          : mergeNotifications(this.notifications, page))
        this.reachedEnd = page.length < this.limit
      } catch (error) {
        console.error('Failed to load notifications', error)
        this.loadError = 'Notifications could not be loaded. Try again in a moment.'
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    loadMore () {
      this.loadNotifications()
    },
    markNotificationsRead () {
      if (!this.loggedInUser || this.unreadNotificationCount === 0) return
      const date = moment.utc().format('YYYY-MM-DDTHH:mm:ss')
      const json = JSON.stringify(['setLastRead', { date }])
      this.$hiveStore.addToQueue([
        this.loggedInUser,
        'posting',
        ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'notify', json }]
      ])
      this.markQueued = true
      this.$q.notify({
        message: 'Mark-all-read queued with posting authority. It applies when the queue broadcasts it.',
        color: 'orange',
        icon: 'schedule',
        position: 'top'
      })
    },
    startPolling () {
      this.stopPolling()
      if (typeof window === 'undefined') return
      this.pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') this.refreshUnreadCount()
      }, 60000)
      document.addEventListener('visibilitychange', this.onVisibility)
    },
    stopPolling () {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.onVisibility)
      }
    },
    onVisibility () {
      if (document.visibilityState === 'visible') this.refreshUnreadCount()
    }
  }
}
</script>

<style scoped>
.notifications-panel {
  width: 440px;
  max-width: 94vw;
  background: #1d1d1d;
}

.notifications-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}

.notifications-filter {
  flex: 1 1 170px;
  min-width: 0;
}

.notifications-unread {
  flex: 0 0 auto;
  color: #b0bec5;
  font-size: 0.75rem;
}

.notifications-scroll {
  height: 52vh;
  max-height: 500px;
  min-height: 140px;
}

.notifications-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.8rem 1rem;
}

.notifications-skeleton__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.notifications-skeleton__body {
  flex: 1;
}

.notifications-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.5rem 1rem;
  color: #b0bec5;
  font-size: 0.78rem;
  text-align: center;
}

.notifications-state--error {
  color: #ffb74d;
}

.notification-row__message {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  color: #e4eaed;
  font-size: 0.78rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.notification-row__dot {
  flex: none;
  width: 7px;
  height: 7px;
  min-width: 7px;
  padding: 0;
  border-radius: 50%;
}

.notification-row__meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.1rem;
  color: #78909c;
  font-size: 0.66rem;
}

.notifications-load {
  display: flex;
  justify-content: center;
  padding: 0.45rem 0 0.6rem;
}

.notifications-end {
  color: #78909c;
  font-size: 0.68rem;
}

.notifications-queued {
  color: #ffb74d;
  font-weight: 600;
}

@media (max-width: 599px) {
  .notifications-toolbar {
    padding: 0.5rem 0.7rem;
  }

  .notifications-panel :deep(.home-panel__head) {
    padding: 0.7rem 0.7rem 0.55rem;
  }
}
</style>
