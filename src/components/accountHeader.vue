<template>
    <div class="col-12 text-center full-wdith" :style='coverImageStyle'>
        <q-card flat bordered class="text-center text-subtitle q-pa-md q-ma-md float-right" v-if="showBalances">
            <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
            <div>{{ tidyNumber(account.balance.split(' ')[0]) }} HIVE</div>
            <div>{{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD</div>
            <div><router-link :to="getWalletLink(account.name)"><q-icon name="account_balance_wallet" title="View Wallet" /> View Wallet</router-link></div>
        </q-card>
      <div class="text-h4"><router-link :to="getAccountLink(account.name)"><q-avatar size="2.5em"><q-img :src="getHiveAvatarUrl(account.name)" /></q-avatar></router-link> {{ account.name }}</div>
      <div class="text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ postingJsonMeta.profile.about }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ postingJsonMeta.profile.location }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a :href="postingJsonMeta.profile.website"><q-icon name="link" /> {{ postingJsonMeta.profile.website }}</a></div>
            <span v-if="postingJsonMeta.profile.email" title="Email"><a :href="returnServiceLink('email', postingJsonMeta.profile.email)"><q-avatar><q-icon name="email" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.ipfs" title="Inter Planetary File System"><a :href="returnServiceLink('ipfs', postingJsonMeta.profile.ipfs)"><q-avatar><q-icon name="img:statics/ipfs.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.twitter" title="Twitter"><a :href="returnServiceLink('twitter', postingJsonMeta.profile.twitter)" target="_blank"><q-avatar><q-icon name="img:statics/twitter.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.twitch" title="Twitch"><a :href="returnServiceLink('twitch', postingJsonMeta.profile.twitch)" target="_blank"><q-avatar><q-icon name="img:statics/twitch.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.steam" title="Steam"><a :href="returnServiceLink('steam', postingJsonMeta.profile.steam)" target="_blank"><q-avatar><q-icon name="img:statics/steam.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.xbox" title="Xbox"><a :href="returnServiceLink('xbox', postingJsonMeta.profile.xbox)" target="_blank"><q-avatar><q-icon name="img:statics/xbox.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.psn" title="Playstation Network (PSN)"><a :href="returnServiceLink('psn', postingJsonMeta.profile.psn)" target="_blank"><q-avatar><q-icon name="img:statics/psn.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.github" title="Github"><a :href="returnServiceLink('github', postingJsonMeta.profile.github)" target="_blank"><q-avatar><q-icon name="img:statics/github.svg"  class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.discord" title="Discord"><a :href="returnServiceLink('discord', postingJsonMeta.profile.discord)" target="_blank"><q-avatar><q-icon name="img:statics/discord.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.telegram" title="Telegram"><a :href="returnServiceLink('telegram', postingJsonMeta.profile.telegram)" target="_blank"><q-avatar><q-icon name="img:statics/telegram.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.bitcoin" title="Bitcoin"><a :href="returnServiceLink('bitcoin', postingJsonMeta.profile.bitcoin)"><q-avatar><q-icon name="img:statics/bitcoin.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.litecoin" title="Litecoin"><a :href="returnServiceLink('litecoin', postingJsonMeta.profile.litecoin)"><q-avatar><q-icon name="img:statics/litecoin.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.flickr" title="Flickr"><a :href="returnServiceLink('flickr', postingJsonMeta.profile.flickr)"><q-avatar><q-icon name="img:statics/flickr.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.facebook" title="Facebook"><a :href="returnServiceLink('facebook', postingJsonMeta.profile.facebook)"><q-avatar><q-icon name="img:statics/facebook.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.tumblr" title="Tumblr"><a :href="returnServiceLink('tumblr', postingJsonMeta.profile.tumblr)"><q-avatar><q-icon name="img:statics/tumblr.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.linkedin" title="LinkedIn"><a :href="returnServiceLink('linkedin', postingJsonMeta.profile.linkedin)"><q-avatar><q-icon name="img:statics/linkedin.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.instagram" title="Instagram"><a :href="returnServiceLink('instagram', postingJsonMeta.profile.instagram)"><q-avatar><q-icon name="img:statics/instagram.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.reddit" title="Reddit"><a :href="returnServiceLink('reddit', postingJsonMeta.profile.reddit)"><q-avatar><q-icon name="img:statics/reddit.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.tiktok" title="TikTok"><a :href="returnServiceLink('tiktok', postingJsonMeta.profile.tiktok)"><q-avatar><q-icon name="img:statics/tiktok.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.soundcloud" title="SoundCloud"><a :href="returnServiceLink('soundcloud', postingJsonMeta.profile.ethereum)"><q-avatar><q-icon name="img:statics/soundcloud.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.vimeo" title="Vimeo"><a :href="returnServiceLink('vimeo', postingJsonMeta.profile.vimeo)"><q-avatar><q-icon name="img:statics/vimeo.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.spotify" title="Spotify"><a :href="returnServiceLink('spotify', postingJsonMeta.profile.spotify)"><q-avatar><q-icon name="img:statics/spotify.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.youtube" title="Youtube"><a :href="returnServiceLink('youtube', postingJsonMeta.profile.youtube)"><q-avatar><q-icon name="img:statics/youtube.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.bandcamp" title="Bandcamp"><a :href="returnServiceLink('bandcamp', postingJsonMeta.profile.bandcamp)"><q-avatar><q-icon name="img:statics/bandcamp.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.medium" title="Medium"><a :href="returnServiceLink('medium', postingJsonMeta.profile.medium)"><q-avatar><q-icon name="img:statics/medium.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.keybase" title="KeyBase"><a :href="returnServiceLink('keybase', postingJsonMeta.profile.keybase)"><q-avatar><q-icon name="img:statics/keybase.svg" class="hvr"/></q-avatar></a></span>
        </span>
      </div>
    </div>
</template>
<style scoped>
/* Grow Shadow */
.hvr {
  display: inline-block;
  vertical-align: middle;
  -webkit-transform: perspective(1px) translateZ(0);
  transform: perspective(1px) translateZ(0);
  box-shadow: 0 0 1px rgba(0, 0, 0, 0);
  -webkit-transition-duration: 0.3s;
  transition-duration: 0.3s;
  -webkit-transition-property: box-shadow, transform;
  transition-property: box-shadow, transform;
}
.hvr:hover, .hvr:focus, .hvr:active {
  box-shadow: 0 10px 10px -10px rgba(227, 19, 55, 0.5);
  -webkit-transform: scale(1.4);
  transform: scale(1.4) rotate(-355deg);
}
</style>
<script>
import hive from '@hiveio/hive-js'
import sanitize from 'sanitize-html'
export default {
  name: 'accountHeader',
  props: {
    account: {
      type: Object,
      required: true
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
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    vestToHive (vests) {
      if (this.globalProps) {
        return hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
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
    returnServiceLink (service, data) {
      switch (service) {
        case 'twitter':
          return 'https://twitter.com/' + sanitize(data)
        case 'twitch':
          return 'https://twitch.tv/' + sanitize(data)
        case 'github':
          return 'https://github.com/' + sanitize(data)
        case 'discord':
          if (!isNaN(data)) {
            return 'https://discordapp.com/users/' + sanitize(data) // If it's a number, its a user
          } else {
            return 'https://discord.gg/' + sanitize(data) // If not, it's an invite code
          }
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
        case 'steam':
          return 'https://steamcommunity.com/id/' + sanitize(data)
        case 'flickr':
          return 'https://www.flickr.com/photos/' + sanitize(data)
        case 'facebook':
          return 'https://facebook.com/' + sanitize(data)
        case 'tumblr':
          return 'https://' + sanitize(data) + '.tumblr.com'
        case 'linkedin':
          return 'https://linkedin.com/in/' + sanitize(data)
        case 'instagram':
          return 'https://instagram.com/' + sanitize(data)
        case 'reddit':
          return 'https://reddit.com/user/' + sanitize(data)
        case 'tiktok':
          return 'https://tiktok.com/@' + sanitize(data)
        case 'soundcloud':
          return 'https://soundcloud.com/' + sanitize(data)
        case 'vimeo':
          return 'https://vimeo.com/' + sanitize(data)
        case 'spotify':
          return 'https://open.spotify.com/artist/' + sanitize(data)
        case 'youtube':
          return 'https://youtube.com/channel/' + sanitize(data)
        case 'bandcamp':
          return 'https://' + sanitize(data) + '.bandcamp.com'
        case 'medium':
          return 'https://medium.com/@' + sanitize(data)
        case 'keybase':
          return 'https://keybase.io/' + sanitize(data)
        // case 'location':
          // TODO: This url doesnt exist yet, poke devs till it does :)
          // return 'https://pinmapple.com/search/' + sanitize(data)
      }
    }
  },
  computed: {
    coverImage: function () {
      var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      if (this.account === null) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          if (JSON.parse(this.account.posting_json_metadata).profile) {
            if (JSON.parse(this.account.posting_json_metadata).profile.cover_image) {
              console.log(JSON.parse(this.account.posting_json_metadata).profile.cover_image)
              return JSON.parse(this.account.posting_json_metadata).profile.cover_image
            } else {
              return defaultCover
            }
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
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center-center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
      } else {
        return null
      }
    },
    postingJsonMeta: function () {
      if (this.account.posting_json_metadata) {
        return JSON.parse(sanitize(this.account.posting_json_metadata))
      } else {
        return null
      }
    }
  }
}
</script>
