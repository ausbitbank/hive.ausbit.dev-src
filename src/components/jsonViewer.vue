<template>
  <vue-json-pretty
    :data="parsedData"
    :deep="deep"
    :show-length="showLength"
    :render-node-value="renderNodeValue"
    theme="dark"
  />
</template>

<style>
.vjs-value { word-wrap: break-word; word-break: break-all; }
.vjs-tree__node { background: none !important; }
.vjs-tree__node:hover { background: none !important; }
</style>

<script>
import { h } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

export default {
  name: 'jsonViewer',
  components: { VueJsonPretty },
  props: {
    data: {
      required: true
    },
    deep: {
      type: Number,
      required: false,
      default: Infinity
    },
    showLength: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data () {
    return {
      supportedServices: ['website', 'twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'bitcoin', 'lightning', 'litecoin', 'ethereum', 'ipfs', 'psn', 'steam', 'xbox', 'flickr', 'facebook', 'tumblr', 'linkedin', 'instagram', 'reddit', 'tiktok', 'soundcloud', 'vimeo', 'spotify', 'youtube', 'bandcamp', 'medium', 'keybase', 'mastodon', 'threespeak', 'vimm', 'gab', 'dbuzz', 'wordpress', 'nftshowroom', 'palnet', 'leofinance', 'protonmail']
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    parsedData () {
      let data
      try {
        data = JSON.parse(JSON.stringify(this.data ?? {}))
      } catch {
        data = this.data
      }
      if (data && typeof data === 'object') {
        for (const key of ['json', 'json_metadata', 'posting_json_metadata']) {
          if (typeof data[key] === 'string') {
            try { data[key] = JSON.parse(data[key]) } catch { /* keep raw */ }
          }
        }
        if (Array.isArray(data.operations)) {
          data.operations = data.operations.map(op => {
            if (op?.[0] === 'custom_json' && typeof op[1]?.json === 'string') {
              try { op[1].json = JSON.parse(op[1].json) } catch { /* keep raw */ }
            }
            return op
          })
        }
      }
      return data
    }
  },
  methods: {
    safeHref (href) {
      if (typeof href !== 'string') return null
      if (/^(https?:|mailto:|bitcoin:|lightning:|litecoin:|ethereum:)/i.test(href)) return href
      if (href.startsWith('/') && !href.startsWith('//')) return href
      return null
    },

    renderNodeValue ({ node, defaultValue }) {
      const key = node?.key
      const value = node?.value
      if (typeof value !== 'string' || value.length === 0) return defaultValue

      const link = this.valueLink(key, value)
      if (!link) return defaultValue

      const href = this.safeHref(link.href)
      if (!href) return defaultValue

      return h('a', {
        href,
        title: link.title,
        target: href.startsWith('/') ? undefined : '_blank',
        rel: href.startsWith('/') ? undefined : 'noopener noreferrer'
      }, link.text)
    },

    valueLink (key, value) {
      if (['head_block_number', 'last_irreversible_block_num', 'last_confirmed_block_num'].includes(key)) {
        return { href: '/b/' + encodeURIComponent(value), text: value }
      }
      if (['url', 'profile_image', 'cover_image'].includes(key)) {
        return { href: value, text: value }
      }
      if (['to', 'from', 'comment_author', 'curator', 'author', 'parent_author', 'voter', 'account', 'producer', 'from_account', 'to_account', 'new_account_name', 'creator', 'receiver', 'payer', 'treasury', 'publisher', 'witness', 'current_witness'].includes(key)) {
        return { href: '/@' + encodeURIComponent(value), text: value }
      }
      if (key === 'permlink' && this.parsedData?.author) {
        return { href: '/@' + this.parsedData.author + '/' + value, text: value }
      }
      if (key === 'parent_permlink' && this.parsedData?.parent_author) {
        return { href: '/@' + this.parsedData.parent_author + '/' + value, text: value }
      }
      if (key === 'comment_permlink' && this.parsedData?.comment_author) {
        return { href: '/@' + this.parsedData.comment_author + '/' + value, text: value }
      }
      if (['vesting_shares', 'reward', 'reward_vests', 'withdrawn', 'vesting_shares_received', 'total_vesting_shares', 'pending_rewarded_vesting_shares'].includes(key)) {
        if (value.split(' ')[1] === 'VESTS' && !this.globalProps.empty) {
          const hp = this.vestToHive(value.split(' ')[0])
          return hp ? { href: '/@' + (this.parsedData?.account || this.parsedData?.owner || ''), text: value, title: '≈ ' + hp + ' HP' } : null
        }
        return null
      }
      if (this.supportedServices.includes(key)) {
        const href = this.returnServiceLink(key, value)
        if (href) return { href, text: value }
      }
      return null
    },

    vestToHive (vests) {
      if (this.globalProps?.total_vesting_fund_hive) {
        return this.$hive.formatter.vestToHive(
          vests,
          this.globalProps.total_vesting_shares,
          this.globalProps.total_vesting_fund_hive
        ).toFixed(3)
      }
      return null
    },

    returnServiceLink (service, data) {
      const d = encodeURIComponent(data)
      switch (service) {
        case 'twitter': return 'https://twitter.com/' + d
        case 'twitch': return 'https://twitch.tv/' + d
        case 'github': return 'https://github.com/' + d
        case 'discord': return isNaN(data) ? 'https://discord.gg/' + d : 'https://discordapp.com/users/' + d
        case 'telegram': return 'https://www.t.me/' + d
        case 'email':
        case 'protonmail': return 'mailto:' + d
        case 'bitcoin': return 'bitcoin:' + d
        case 'lightning': return 'lightning:' + d
        case 'litecoin': return 'litecoin:' + d
        case 'ethereum': return 'ethereum:' + d
        case 'ipfs': return 'https://ipfs.io/ipfs/' + d
        case 'xbox': return 'https://account.xbox.com/en-us/profile?gamertag=' + d
        case 'psn': return 'https://my.playstation.com/profile/' + d
        case 'steam': return 'https://steamcommunity.com/id/' + d
        case 'flickr': return 'https://www.flickr.com/photos/' + d
        case 'facebook': return 'https://facebook.com/' + d
        case 'tumblr': return 'https://' + d + '.tumblr.com'
        case 'linkedin': return 'https://linkedin.com/in/' + d
        case 'instagram': return 'https://instagram.com/' + d
        case 'reddit': return 'https://reddit.com/user/' + d
        case 'tiktok': return 'https://tiktok.com/@' + d
        case 'soundcloud': return 'https://soundcloud.com/' + d
        case 'vimeo': return 'https://vimeo.com/' + d
        case 'spotify': return 'https://open.spotify.com/artist/' + d
        case 'youtube': return 'https://youtube.com/channel/' + d
        case 'bandcamp': return 'https://' + d + '.bandcamp.com'
        case 'medium': return 'https://medium.com/@' + d
        case 'keybase': return 'https://keybase.io/' + d
        case 'mastodon': {
          if (!data.includes('@')) return 'https://mstdn.social/@' + d
          const parts = data.replace(/^@/, '').split('@')
          return parts.length === 2 ? 'https://' + parts[1] + '/@' + parts[0] : 'https://mstdn.social/@' + d
        }
        case 'vimm': return 'https://vimm.tv/@' + d
        case 'threespeak': return 'https://3speak.tv/user/' + d
        case 'gab': return 'https://gab.com/' + d
        case 'dbuzz': return 'https://d.buzz/#/@' + d
        case 'wordpress': return 'https://' + d + '.wordpress.com'
        case 'nftshowroom': return 'https://nftshowroom.com/' + d
        case 'palnet': return 'https://palnet.io/@' + d
        case 'leofinance': return 'https://leofinance.io/@' + d
        case 'pgp': return data.startsWith('0x')
          ? 'https://keys.openpgp.org/search?q=' + d
          : 'https://hive.ausbit.dev/' + d
        default: return null
      }
    }
  }
}
</script>
