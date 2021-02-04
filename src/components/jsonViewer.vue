<template>
    <vue-json-pretty :data="data" :customValueFormatter="customLinkFormatter" :deep="deep" :showLength="showLength" />
</template>
<script>
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import sanitize from 'sanitize-html'
export default {
  name: 'jsonViewer',
  data () {
    return {
      supportedServices: ['website', 'twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'bitcoin', 'litecoin', 'ethereum', 'ipfs', 'psn', 'steam', 'xbox', 'flickr', 'facebook', 'tumblr', 'linkedin', 'instagram', 'reddit', 'tiktok', 'soundcloud', 'vimeo', 'spotify', 'youtube', 'bandcamp', 'medium', 'keybase', 'mastodon', 'threespeak', 'vimm', 'gab', 'dbuzz', 'wordpress', 'nftshowroom', 'palnet', 'leofinance', 'protonmail']
    }
  },
  components: { VueJsonPretty },
  computed: {
  },
  props: {
    data: {
      // type: Object,
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
  methods: {
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (['head_block_number', 'last_irreversible_block_num', 'last_confirmed_block_num'].includes(key)) {
        return `<a href="/block/${sanitize(data)}">${sanitize(data)}</a>`
      } else if (['url', 'profile_image', 'cover_image'].includes(key)) {
        return `<a href="${sanitize(data)}">${sanitize(data)}</a>`
      } else if (['to', 'from', 'comment_author', 'curator', 'author', 'parent_author', 'voter', 'account', 'producer', 'from_account', 'to_account', 'new_account_name', 'creator', 'producer', 'receiver', 'payer', 'treasury'].includes(key)) {
        return `<a href="/@${sanitize(data)}">${sanitize(data)}</a>`
      } else if (['permlink', 'parent_permlink'].includes(key)) {
        return `<a href="/@${sanitize(parent.author)}/${sanitize(parent.permlink)}">${sanitize(data)}</a>`
      } else if (['json_metadata', 'json'].includes(key)) {
        return sanitize(defaultFormatted)
      } else if (['comment_permlink'].includes(key)) {
        return `<a href="/@${sanitize(parent.comment_author)}/${sanitize(parent.comment_permlink)}">${sanitize(data)}</a>`
      } else if (this.supportedServices.includes(key)) {
        return `<a href="${this.returnServiceLink(key, data)}">${sanitize(data)}</a>`
      } else {
        return sanitize(defaultFormatted)
      }
    },
    // TODO reduce redundant code, import this from elsewhere
    returnServiceLink (service, data) {
      var d = sanitize(data)
      switch (service) {
        case 'twitter':
          return 'https://twitter.com/' + d
        case 'twitch':
          return 'https://twitch.tv/' + d
        case 'github':
          return 'https://github.com/' + d
        case 'discord':
          if (!isNaN(data)) {
            return 'https://discordapp.com/users/' + d // If it's a number, its a user
          } else {
            return 'https://discord.gg/' + d // If not, it's an invite code
          }
        case 'telegram':
          return 'https://www.t.me/' + d
        case 'email':
          return 'mailto:' + d
        case 'protonmail':
          return 'mailto:' + d
        case 'bitcoin':
          return 'bitcoin:' + d
        case 'litecoin':
          return 'litecoin:' + d
        case 'ethereum':
          return 'ethereum:' + d
        case 'ipfs':
          return 'https://cloudflare-ipfs.com/ipfs/' + d
        case 'xbox':
          return 'https://account.xbox.com/en-us/profile?gamertag=' + d
        case 'psn':
          return 'https://my.playstation.com/profile/' + d
        case 'steam':
          return 'https://steamcommunity.com/id/' + d
        case 'flickr':
          return 'https://www.flickr.com/photos/' + d
        case 'facebook':
          return 'https://facebook.com/' + d
        case 'tumblr':
          return 'https://' + d + '.tumblr.com'
        case 'linkedin':
          return 'https://linkedin.com/in/' + d
        case 'instagram':
          return 'https://instagram.com/' + d
        case 'reddit':
          return 'https://reddit.com/user/' + d
        case 'tiktok':
          return 'https://tiktok.com/@' + d
        case 'soundcloud':
          return 'https://soundcloud.com/' + d
        case 'vimeo':
          return 'https://vimeo.com/' + d
        case 'spotify':
          return 'https://open.spotify.com/artist/' + d
        case 'youtube':
          return 'https://youtube.com/channel/' + d
        case 'bandcamp':
          return 'https://' + d + '.bandcamp.com'
        case 'medium':
          return 'https://medium.com/@' + d
        case 'keybase':
          return 'https://keybase.io/' + d
        case 'mastodon':
          // Officially, a full mastodon identifier is in this format @[Username]@[Server]  -> https://MastodonInstance.Domain/@Username
          switch (d.indexOf('@')) {
            case -1: // No @, assuming just username on largest server
              return 'https://mstdn.social/@' + d
            case 0:
              if (d.indexOf('@', (d.indexOf('@') + 1)) === -1) { // Only one @ at index 0, asssume just username
                return 'https://mstdn.social/' + d
              } else { // Assume official format of @[Username]@[Server]
                return 'https://' + d.substr(d.indexOf('@', 1) + 1, d.length) + '/@' + d.substr(1, (d.indexOf('@', 1) - 1), 2)
              }
            default: // Assuming shortened format of [Username]@[Server]
              return 'https://' + d.substr(d.indexOf('@', 1) + 1, d.length) + '/@' + d.substr(0, (d.indexOf('@', 1)), 2)
          }
        case 'vimm':
          return 'https://vimm.tv/@' + d
        case 'threespeak':
          return 'https://3speak.co/user/' + d
        case 'gab':
          return 'https://gab.com/' + d
        case 'dbuzz':
          return 'https://d.buzz/#/@' + d
        case 'wordpress':
          return 'https://' + d + '.wordpress.com'
        case 'nftshowroom':
          return 'https://nftshowroom.com/' + d
        case 'palnet':
          return 'https://palnet.io/@' + d
        case 'leofinance':
          return 'https://leofinance.io/@' + d
        case 'pgp':
          if (d.indexOf('0x') === 0) { // Key fingerprint, link to server
            return 'https://keys.openpgp.org/search?q=' + d
          } else { // Assume hive post authperm to full key, link it  (@username/permlink)
            return 'https://hive.ausbit.dev/' + d
          }
      }
    }
  },
  mounted () {
  }
}
</script>
