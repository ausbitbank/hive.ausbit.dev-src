<template>
  <article class="user-card">
    <router-link :to="'/@' + username" class="user-card__avatar" :aria-label="'Open @' + username">
      <q-avatar size="46px">
        <q-img :src="avatarSrc" :alt="'Avatar of @' + username" @error="avatarFailed = true" />
      </q-avatar>
    </router-link>

    <div class="user-card__body">
      <div class="user-card__head">
        <router-link :to="'/@' + username" class="user-card__name">{{ displayName }}</router-link>
        <span v-if="displayName !== username" class="user-card__handle">@{{ username }}</span>
      </div>

      <p v-if="about" class="user-card__about">{{ about }}</p>

      <div class="user-card__meta">
        <span v-if="hpLabel" :title="'Hive Power: ' + hpLabel">
          <q-icon name="bolt" size="12px" aria-hidden="true" /> {{ hpLabel }}
        </span>
        <span v-if="location" :title="'Location: ' + location">
          <q-icon name="place" size="12px" aria-hidden="true" /> {{ location }}
        </span>
        <span v-if="lastActiveLabel" :title="'Last active ' + lastActiveLabel">
          <q-icon name="schedule" size="12px" aria-hidden="true" /> {{ lastActiveLabel }}
        </span>
      </div>
    </div>

    <q-btn
      v-if="canFollow"
      class="user-card__follow"
      dense
      no-caps
      outline
      :color="isFollowing ? 'grey-6' : 'primary'"
      :label="isFollowing ? 'Following' : 'Follow'"
      :loading="followBusy"
      :aria-label="(isFollowing ? 'Unfollow @' : 'Follow @') + username"
      @click.prevent.stop="toggleFollow"
    />
  </article>
</template>

<script>
import moment from 'src/utils/time'
import { stripHtml } from 'src/utils/safeHtml'

export default {
  name: 'userCard',
  props: {
    username: { type: String, required: true },
    // Kept for callers that still pass it; the compact card never shows cover art.
    showCover: { type: Boolean, default: true }
  },
  data () {
    return {
      relationship: null,
      avatarFailed: false,
      followBusy: false
    }
  },
  computed: {
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    profile () {
      if (!this.account || !this.account.posting_json_metadata) return null
      try {
        const metadata = JSON.parse(this.account.posting_json_metadata)
        return metadata && metadata.profile ? metadata.profile : null
      } catch {
        return null
      }
    },
    displayName () {
      const name = this.profile && typeof this.profile.name === 'string' ? this.profile.name.trim() : ''
      return stripHtml(name, 60) || '@' + this.username
    },
    about () {
      return stripHtml(this.profile && this.profile.about, 180)
    },
    location () {
      return stripHtml(this.profile && this.profile.location, 40)
    },
    avatarSrc () {
      return this.avatarFailed ? '/statics/member.png' : 'https://images.hive.blog/u/' + this.username + '/avatar'
    },
    hpLabel () {
      if (!this.account || !this.$hiveStore.globalProps) return ''
      const vests = parseFloat(String(this.account.vesting_shares || '').split(' ')[0])
      if (!Number.isFinite(vests)) return ''
      const hp = this.$hive.formatter.vestToHive(
        vests,
        this.$hiveStore.globalProps.total_vesting_shares,
        this.$hiveStore.globalProps.total_vesting_fund_hive
      )
      if (!Number.isFinite(hp) || hp <= 0) return ''
      return Math.round(hp).toLocaleString('en-US') + ' HP'
    },
    lastActiveLabel () {
      const stamp = this.account && (this.account.last_post || this.account.last_vote_time)
      if (!stamp || stamp === '1970-01-01T00:00:00') return ''
      return moment.utc(stamp).fromNow()
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    canFollow () {
      return Boolean(this.loggedInUser) && this.loggedInUser !== this.username
    },
    isFollowing () {
      return Boolean(this.relationship && this.relationship.follows)
    }
  },
  watch: {
    username () {
      this.avatarFailed = false
      this.relationship = null
    }
  },
  methods: {
    getRelationshipBetweenAccounts (account1, account2) {
      return this.$hive.api.callAsync('bridge.get_relationship_between_accounts', [account1, account2])
        .then(response => {
          this.relationship = response || { follows: false }
          return this.relationship
        })
        .catch(() => {
          this.relationship = { follows: false }
          return this.relationship
        })
    },
    async toggleFollow () {
      if (this.followBusy || !this.canFollow) return
      this.followBusy = true
      try {
        if (!this.relationship) {
          await this.getRelationshipBetweenAccounts(this.loggedInUser, this.username)
        }
        if (this.relationship && this.relationship.follows) this.unfollowUser(this.username)
        else this.followUser(this.username)
      } finally {
        this.followBusy = false
      }
    },
    followUser (who) {
      const json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["blog"] }]'
      this.relationship = { ...(this.relationship || {}), follows: true }
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json }]])
    },
    unfollowUser (who) {
      const json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": [] }]'
      this.relationship = { ...(this.relationship || {}), follows: false }
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json }]])
    }
  }
}
</script>

<style scoped>
.user-card {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  height: 100%;
  min-width: 0;
}

.user-card__avatar {
  flex: none;
  line-height: 0;
  text-decoration: none;
}

.user-card__avatar :deep(.q-avatar) {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #10181d;
}

.user-card__body {
  flex: 1;
  min-width: 0;
}

.user-card__head {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex-wrap: wrap;
  min-width: 0;
}

.user-card__name {
  overflow: hidden;
  color: #e4eaed;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__name:hover {
  color: #81d4fa;
}

.user-card__handle {
  color: #78909c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.user-card__about {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0.2rem 0 0;
  color: #90a4ae;
  font-size: 0.74rem;
  line-height: 1.4;
}

.user-card__meta {
  display: flex;
  align-items: center;
  gap: 0.25rem 0.65rem;
  flex-wrap: wrap;
  margin-top: 0.3rem;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.3;
}

.user-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  white-space: nowrap;
}

.user-card__follow {
  flex: none;
  align-self: flex-start;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 0.68rem;
  font-weight: 600;
}
</style>
