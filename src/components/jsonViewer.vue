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
      supportedServices: ['twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'bitcoin', 'litecoin', 'ethereum', 'ipfs', 'psn', 'location']
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
      switch (service) {
        case 'twitter':
          return 'https://twitter.com/' + sanitize(data)
        case 'twitch':
          return 'https://twitch.tv/' + sanitize(data)
        case 'github':
          return 'https://github.com/' + sanitize(data)
        case 'discord':
          // TODO Expand to support both userid (integer) and server invite links (hex string)
          // Server invite format : https://discord.gg/INVITECODE
          return 'https://discordapp.com/users/' + sanitize(data)
        case 'telegram':
          return 'https://www.t.me/' + sanitize(data)
        case 'email':
          return 'mailto:' + sanitize(data)
        case 'bitcoin':
          return 'bitcoin:' + sanitize(data)
        case 'litecoin':
          return 'litecoin:' + sanitize(data)
        case 'ethereum':
          return 'ethereum:' + sanitize(data)
        case 'ipfs':
          return 'https://cloudflare-ipfs.com/ipfs/' + sanitize(data)
        case 'xbox':
          return 'https://account.xbox.com/en-us/profile?gamertag=' + sanitize(data)
        case 'psn':
          return 'https://my.playstation.com/profile/' + sanitize(data)
        case 'location':
          // TODO: This url doesnt exist yet, poke devs till it does :)
          return 'https://pinmapple.com/search/' + sanitize(data)
      }
    }

  },
  mounted () {
    // console.log(this.data)
    // console.log(DOMPurify.sanitize(JSON.parse(this.data)))
  }
}
</script>
