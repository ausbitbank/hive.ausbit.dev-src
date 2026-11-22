<template>
    <div class="col-12 text-center full-width account-header" :class="{ 'account-header--compact': compact }" :style='coverImageStyle' v-if="account !== undefined && globalProps !== undefined">
        <q-card flat bordered class="account-header__balances text-center text-subtitle q-pa-md q-ma-md float-right" v-if="showBalances && account !== undefined">
            <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
            <div>{{ tidyNumber(account.balance.split(' ')[0]) }} HIVE</div>
            <div>{{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD</div>
        </q-card>
      <router-link class="account-header__avatar" :to="getAccountLink(account.name)" :aria-label="'View @' + account.name + ' profile'"><q-avatar class="hvr"><q-img :src="avatarSrc" @error="avatarFailed = true" :alt="'Avatar of @' + account.name" /></q-avatar></router-link>
      <component :is="headingTag" class="account-header__name q-my-none">{{ account.name }}</component>
      <div class="account-header__profile text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ stripHtml(postingJsonMeta.profile.about) }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ stripHtml(postingJsonMeta.profile.location) }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a v-if="safeWebsite" :href="safeWebsite"><q-icon name="link" /> {{ stripHtml(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</a><span v-else><q-icon name="link" /> {{ stripHtml(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</span></div>
        </span>
        <div v-if="showFollowCount && followCount" class="text-caption">
          <span v-if="followCount.following_count > 0"><q-icon name="people" /><router-link :to="linkFollowing"> {{ tidyNumber(followCount.following_count) }} <span class="text-faint">following</span></router-link>&nbsp;</span>
          <span v-if="followCount.follower_count > 0"><q-icon name="people_alt" /><router-link :to="linkFollowers"> {{ tidyNumber(followCount.follower_count) }} <span class="text-faint">followers</span></router-link></span>
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
      <q-toolbar :dense="$q.screen.lt.md" class="account-tabs text-center" :class="{ 'account-tabs--overflow': tabsOverflow }" v-if="showNavBar">
        <q-tabs
          ref="tabs"
          :dense="$q.screen.lt.md"
          :mobile-arrows="$q.screen.lt.sm === false"
          :outside-arrows="$q.screen.lt.sm === false"
          align="center"
          icons
          no-caps
          inline-label
          indicator-color="secondary"
          class="text-soft full-width"
          aria-label="Account sections"
        >
          <template v-for="(tab, index) in navTabs" :key="tab.name">
            <span v-if="index === tabsPerRow" class="account-tabs__break" aria-hidden="true" />
            <q-route-tab :name="tab.name" :label="tab.label" :icon="tab.icon" :exact="tab.exact" :to="tab.to" />
          </template>
        </q-tabs>
      </q-toolbar>
    </div>
</template>
<style scoped>
.account-header {
  position: relative;
  padding: 1.25rem 0.75rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--c-text) 6%, transparent);
  background-color: var(--c-bg-deep);
  background-position: center, center;
  background-repeat: no-repeat;
  background-size: cover, cover;
}
.account-header__name {
  color: #fff;
  font-size: clamp(1.5rem, 3.2vw, 2.1rem);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 10px color-mix(in srgb, var(--c-shadow) 55%, transparent);
  overflow-wrap: anywhere;
}
.account-header__avatar {
  display: inline-block;
  margin-bottom: 0.35rem;
}
.account-header__avatar :deep(.q-avatar) {
  width: 88px;
  height: 88px;
  border: 2px solid color-mix(in srgb, var(--c-text) 60%, transparent);
  box-shadow: 0 4px 18px color-mix(in srgb, var(--c-shadow) 40%, transparent);
}
.account-header__profile {
  color: #fff;
  max-width: 720px;
  margin: 0.5rem auto 0;
  padding: 0 0.25rem;
  line-height: 1.55;
  text-shadow: 0 1px 8px color-mix(in srgb, var(--c-shadow) 55%, transparent);
}
.account-header__profile :deep(.q-icon) {
  font-size: 1.05em;
  vertical-align: -2px;
  margin-right: 2px;
  opacity: 0.85;
}
.account-header__profile .text-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 12px;
}
.account-header__profile .text-caption > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.account-header__balances {
  max-width: 210px;
  border-color: color-mix(in srgb, var(--c-text) 14%, transparent) !important;
  border-radius: var(--radius-card, 10px);
  background: color-mix(in srgb, var(--c-bg-deep) 78%, transparent) !important;
  box-shadow: var(--shadow-card, 0 6px 18px color-mix(in srgb, var(--c-shadow) 26%, transparent));
}
.account-tabs {
  max-width: 1100px;
  min-height: 48px;
  margin: 0.9rem auto 0.15rem;
  border: 1px solid color-mix(in srgb, var(--c-text) 8%, transparent);
  border-radius: var(--radius-card, 10px);
  /* The pill owns the horizontal overflow of its scrollable tab strip, but
     does not clip it: Quasar's outside arrows sit over the rounded corners. */
  overflow: visible;
  background: color-mix(in srgb, var(--c-bg-deep) 84%, transparent) !important;
  box-shadow: none;
}
.account-tabs :deep(.q-tabs) {
  border-radius: inherit;
}
.account-tabs :deep(.q-tab) {
  min-height: 44px;
}
/* On narrow screens the eight tabs do not fit on one row, and any one-row
   answer cuts a label at an edge (under the arrow or off-screen). Wrap them
   into two rows of four instead, so every label is whole. Quasar still
   reports the strip as scrollable, hence the `!important` overrides; the
   arrows are hidden because nothing is actually hidden. */
@media (max-width: 959px) {
  .account-tabs {
    min-height: 0;
  }
  .account-tabs :deep(.q-tabs) {
    flex-wrap: wrap;
  }
  .account-tabs :deep(.q-tabs__content) {
    flex-wrap: wrap;
    justify-content: center !important;
    overflow: visible !important;
    /* Quasar would otherwise scroll the strip to reveal the active tab,
       sliding a row sideways out of the pill. */
    scroll-behavior: auto !important;
  }
  /* Two rows of four, sized so the longest label ("communities") still fits
     without the icons. Icons come back above this breakpoint. */
  .account-tabs :deep(.q-tab) {
    flex: 0 1 24% !important;
    min-width: 0 !important;
    min-height: 36px;
    padding: 0;
  }
  .account-tabs :deep(.q-tab__content) {
    padding: 0;
  }
  .account-tabs :deep(.q-tab__icon) {
    display: none;
  }
  .account-tabs :deep(.q-tab__label) {
    font-size: 12px;
    padding-left: 0;
    white-space: nowrap;
  }
  .account-tabs :deep(.q-tabs__arrow) {
    display: none;
  }
  /* A full-width spacer before the fifth tab forces the second row. */
  .account-tabs :deep(.q-tabs__content) .account-tabs__break {
    display: block;
    flex: 0 0 100%;
    height: 0;
  }
}
/* A shaded, clickable edge makes the overflow obvious: the strip fades under
   the arrow instead of cutting a label mid-character. */
.account-tabs :deep(.q-tabs__arrow) {
  top: 0;
  bottom: 0;
  min-width: 32px;
  height: auto;
  align-items: center;
  justify-content: center;
  display: flex;
  color: var(--c-text-soft);
  font-size: 26px;
  text-shadow: none;
  opacity: 0.95;
  transition: opacity 0.2s ease;
}
.account-tabs :deep(.q-tabs__arrow--left) {
  background: linear-gradient(to right, var(--c-bg-deep) 55%, color-mix(in srgb, var(--c-bg-deep) 0%, transparent));
}
.account-tabs :deep(.q-tabs__arrow--right) {
  background: linear-gradient(to left, var(--c-bg-deep) 55%, color-mix(in srgb, var(--c-bg-deep) 0%, transparent));
}
.account-tabs :deep(.q-tabs__arrow:hover:not(.q-tabs__arrow--faded)) {
  color: var(--c-text-strong);
}
/* A faded arrow means there is nothing more in that direction. */
.account-tabs :deep(.q-tabs__arrow--faded) {
  opacity: 0;
}
/* Quasar keeps the arrow elements mounted even when the strip fits. Hide them
   entirely until our measurement says there is real overflow. */
.account-tabs:not(.account-tabs--overflow) :deep(.q-tabs__arrow) {
  display: none !important;
}
.account-tabs :deep(.q-tabs__content) {
  scrollbar-width: none;
}
.service-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.6rem;
}
.account-header--compact {
  padding: 0.7rem 0.75rem 0.45rem;
}

.account-header--compact .account-header__avatar :deep(.q-avatar) {
  width: 56px;
  height: 56px;
}

.account-header--compact .account-header__name {
  color: #fff;
  font-size: 1.3rem;
}

.account-header--compact .account-tabs {
  margin-top: 0.5rem;
}

@media (max-width: 599px) {
  .account-header {
    padding: 0.9rem 0.5rem 0.6rem;
  }

  .account-header--compact {
    padding: 0.6rem 0.5rem 0.35rem;
  }

  .account-header--compact .account-header__avatar :deep(.q-avatar) {
    width: 46px;
    height: 46px;
  }

  .account-header--compact .account-header__name {
    font-size: 1.15rem;
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
import { vestToHive } from 'src/services/wallet'
import { safeExternalUrl } from 'src/utils/safeUrl'
import { hiveAvatarUrl } from 'src/utils/avatar'
import { previewImageUrl } from 'src/utils/postPreview'
export default {
  name: 'accountHeader',
  data () {
    return {
      relationship: null,
      avatarFailed: false,
      // Arrows are only mounted once the strip actually overflows. Quasar's
      // own check can leave a faded arrow visible on a one-pixel rounding
      // difference, which looks like a dead control.
      tabsOverflow: false,
      tabsObserver: null
    }
  },
  watch: {
    'account.name' () {
      this.avatarFailed = false
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
    },
    compact: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  components: {
    userServices: defineAsyncComponent(() => import('components/userServices.vue'))
  },
  methods: {
    observeTabs () {
      const content = this.$refs.tabs?.$el?.querySelector('.q-tabs__content')
      if (!content) return
      this.measureTabs(content)
      if (typeof ResizeObserver === 'undefined') return
      this.tabsObserver = new ResizeObserver(() => this.measureTabs(content))
      this.tabsObserver.observe(content)
      for (const child of content.children) this.tabsObserver.observe(child)
      // Web fonts can change tab widths after the first measurement.
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        document.fonts.ready.then(() => this.measureTabs(content)).catch(() => {})
      }
    },
    measureTabs (content) {
      const overflow = content.scrollWidth - content.clientWidth > 2
      if (this.tabsOverflow !== overflow) this.tabsOverflow = overflow
    },
    getUrl (user) { return hiveAvatarUrl(user, 'medium') },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    vestToHive (vests) {
      if (this.globalProps) {
        return vestToHive(vests, this.globalProps).toFixed(3)
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
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user, 'medium') },
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
    avatarSrc: function () {
      return this.avatarFailed ? '/statics/member.webp' : this.getHiveAvatarUrl(this.account.name)
    },
    // Kept just above the eight default tabs so the narrow-screen spacer
    // lands before the fifth one; the extra tip tab only exists on /tip.
    tabsPerRow: function () {
      return 4
    },
    navTabs: function () {
      const name = this.account.name
      const tabs = [
        { name: 'posts', label: 'posts', icon: 'library_books', to: '/@' + name + '/posts' },
        { name: 'blog', label: 'blog', icon: 'menu_book', to: '/@' + name + '/blog' },
        { name: 'feed', label: 'feed', icon: 'rss_feed', to: '/@' + name + '/feed' },
        { name: 'replies', label: 'replies', icon: 'comment', to: '/@' + name + '/replies' },
        { name: 'comments', label: 'comments', icon: 'message', to: '/@' + name + '/comments' },
        { name: 'communities', label: 'communities', icon: 'forum', to: '/@' + name + '/communities' },
        { name: 'wallet', label: 'wallet', icon: 'account_balance', to: '/@' + name + '/wallet' },
        { name: 'explorer', label: 'profile', icon: 'perm_identity', to: '/@' + name, exact: true }
      ]
      if (this.$route.path.endsWith('/tip')) tabs.push({ name: 'tip', label: 'tip', to: '/@' + name + '/tip' })
      return tabs
    },
    coverImage: function () {
      // var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      var defaultCover = ''
      if (this.account === undefined) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          const meta = safeJsonParse(this.account.posting_json_metadata)
          if (meta.profile && meta.profile.cover_image) {
            return previewImageUrl(meta.profile.cover_image, 1280)
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
    this.$nextTick(this.observeTabs)
    if (!this.account) return
    if (this.showRelationship && this.loggedInUser && this.loggedInUser !== this.account.name && this.relationship === null) {
      this.getRelationshipBetweenAccounts(this.loggedInUser, this.account.name)
    }
    if (this.showFollowCount) {
      this.getFollowCount(this.account.name)
    }
  },
  beforeUnmount () {
    if (this.tabsObserver) {
      this.tabsObserver.disconnect()
      this.tabsObserver = null
    }
  }
}
</script>
