<template>
  <div class="dw-notify">
    <q-card-section class="home-panel__head dw-notify__head">
      <div>
        <div class="home-eyebrow">Notifications</div>
        <h2 class="home-panel__title">
          <template v-if="targetAccount">@{{ targetAccount }}</template>
          <template v-else>Notifications</template>
        </h2>
      </div>
    </q-card-section>

    <dashboard-widget-state
      :state="state"
      :error="loadError"
      guest-title="Log in to see your notifications"
      guest-text="Replies, votes and mentions for your own account."
      @retry="reload"
    />

    <template v-if="state === 'ready' || state === 'stale'">
      <q-card-section class="dw-notify__body">
        <div v-if="loading && !items.length" class="dw-notify__list">
          <div v-for="i in Math.min(limit, 4)" :key="i" class="dw-notify__skeleton">
            <q-skeleton type="circle" size="24px" />
            <q-skeleton type="text" width="70%" />
          </div>
        </div>

        <p v-else-if="!items.length" class="dw-notify__empty">No notifications yet.</p>

        <ul v-else class="dw-notify__list" role="list">
          <li v-for="item in items" :key="item.id">
            <router-link :to="item.to" class="dw-notify__row">
              <span class="dw-notify__icon" :class="'is-' + item.category">
                <q-icon :name="iconFor(item.category)" size="14px" aria-hidden="true" />
              </span>
              <span class="dw-notify__text" v-text="item.message"></span>
              <span class="dw-notify__time">{{ item.time }}</span>
            </router-link>
          </li>
        </ul>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link to="/notifications">Open notifications</router-link>
        <span>{{ unreadLabel }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-notify__body {
  padding: 0.45rem 1rem 0.35rem;
}

.dw-notify__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-notify__row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.4rem 0.15rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-soft);
  font-size: 0.78rem;
  line-height: 1.35;
  text-decoration: none;
}

.dw-notify__row:first-child {
  border-top: 0;
}

.dw-notify__row:hover {
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  text-decoration: none;
}

.dw-notify__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-subtle);
}

.dw-notify__icon.is-votes {
  color: var(--c-positive);
}

.dw-notify__icon.is-replies,
.dw-notify__icon.is-mentions {
  color: var(--c-link-hover);
}

.dw-notify__text {
  flex: 1;
  min-width: 0;
}

.dw-notify__time {
  flex: none;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  white-space: nowrap;
}

.dw-notify__empty {
  margin: 0;
  padding: 0.4rem 0;
  color: var(--c-text-faint);
  font-size: 0.78rem;
}

.dw-notify__skeleton {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0;
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { notifyAccountNotifications } from 'src/services/notifications'
import { notificationRows } from 'src/services/dashboardWidgets'

const ICONS = {
  votes: 'thumb_up',
  replies: 'reply',
  mentions: 'alternate_email',
  other: 'notifications'
}

export default {
  name: 'WidgetNotifications',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    limit: { type: Number, default: 5 }
  },
  data () {
    return {
      notifications: [],
      unreadCount: 0,
      feedError: '',
      feedRequest: 0
    }
  },
  computed: {
    items () {
      return notificationRows(this.notifications, { limit: this.limit })
    },
    unreadLabel () {
      return this.unreadCount > 0 ? this.unreadCount + ' unread' : 'All caught up'
    }
  },
  watch: {
    targetAccount () {
      this.notifications = []
      this.unreadCount = 0
      this.feedError = ''
    }
  },
  methods: {
    applyAccountData () {
      this.notifications = []
      this.unreadCount = 0
      this.loadFeed()
    },
    iconFor (category) {
      return ICONS[category] || ICONS.other
    },
    async loadFeed () {
      const account = this.accountName
      if (!account) return
      const token = ++this.feedRequest
      this.feedError = ''
      try {
        const feed = await notifyAccountNotifications(account, { limit: this.limit })
        if (token !== this.feedRequest || account !== this.accountName) return
        this.notifications = feed.items
        this.unreadCount = feed.unread
      } catch (error) {
        if (token !== this.feedRequest || account !== this.accountName) return
        console.error('Failed to load dashboard notifications', error)
        this.notifications = []
        this.unreadCount = 0
        this.feedError = 'Notifications could not be loaded.'
        this.loadError = this.feedError
      }
    }
  }
}
</script>
