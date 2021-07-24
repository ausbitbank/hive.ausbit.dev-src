<template>
  <div>
    <span v-if="profile.pinned " title="Pinned Post"><a v-if="profile.pinned !== 'none'" :href="returnServiceLink('pinned', profile.pinned)"><q-avatar><q-icon name="push_pin" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.email" title="Email"><a :href="returnServiceLink('email', profile.email)"><q-avatar><q-icon name="email" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.protonmail" title="Protonmail"><a :href="returnServiceLink('protonmail', profile.protonmail)"><q-avatar><q-icon name="img:statics/protonmail.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.ipfs" title="Inter Planetary File System"><a :href="returnServiceLink('ipfs', profile.ipfs)"><q-avatar><q-icon name="img:statics/ipfs.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.twitter" title="Twitter"><a :href="returnServiceLink('twitter', profile.twitter)" target="_blank"><q-avatar><q-icon name="img:statics/twitter.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.twitch" title="Twitch"><a :href="returnServiceLink('twitch', profile.twitch)" target="_blank"><q-avatar><q-icon name="img:statics/twitch.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.steam" title="Steam"><a :href="returnServiceLink('steam', profile.steam)" target="_blank"><q-avatar><q-icon name="img:statics/steam.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.xbox" title="Xbox"><a :href="returnServiceLink('xbox', profile.xbox)" target="_blank"><q-avatar><q-icon name="img:statics/xbox.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.psn" title="Playstation Network (PSN)"><a :href="returnServiceLink('psn', profile.psn)" target="_blank"><q-avatar><q-icon name="img:statics/psn.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.github" title="Github"><a :href="returnServiceLink('github', profile.github)" target="_blank"><q-avatar><q-icon name="img:statics/github.svg"  class="hvr"/></q-avatar></a></span>
    <span v-if="profile.discord" title="Discord"><a :href="returnServiceLink('discord', profile.discord)" target="_blank"><q-avatar><q-icon name="img:statics/discord.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.telegram" title="Telegram"><a :href="returnServiceLink('telegram', profile.telegram)" target="_blank"><q-avatar><q-icon name="img:statics/telegram.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.bitcoin" title="Bitcoin"><a :href="returnServiceLink('bitcoin', profile.bitcoin)"><q-avatar><q-icon name="img:statics/bitcoin.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.lightning" title="Lightning"><a :href="returnServiceLink('lightning', profile.lightning)"><q-avatar><q-icon name="img:statics/lightning.png" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.litecoin" title="Litecoin"><a :href="returnServiceLink('litecoin', profile.litecoin)"><q-avatar><q-icon name="img:statics/litecoin.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.ethereum" title="Ethereum"><a :href="returnServiceLink('ethereum', profile.ethereum)"><q-avatar><q-icon name="img:statics/ethereum.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.dogecoin" title="Dogecoin"><a :href="returnServiceLink('dogecoin', profile.dogecoin)"><q-avatar><q-icon name="img:statics/dogecoin.svg" class="hvr" /></q-avatar></a></span>
    <span v-if="profile.flickr" title="Flickr"><a :href="returnServiceLink('flickr', profile.flickr)"><q-avatar><q-icon name="img:statics/flickr.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.facebook" title="Facebook"><a :href="returnServiceLink('facebook', profile.facebook)"><q-avatar><q-icon name="img:statics/facebook.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.tumblr" title="Tumblr"><a :href="returnServiceLink('tumblr', profile.tumblr)"><q-avatar><q-icon name="img:statics/tumblr.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.linkedin" title="LinkedIn"><a :href="returnServiceLink('linkedin', profile.linkedin)"><q-avatar><q-icon name="img:statics/linkedin.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.instagram" title="Instagram"><a :href="returnServiceLink('instagram', profile.instagram)"><q-avatar><q-icon name="img:statics/instagram.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.reddit" title="Reddit"><a :href="returnServiceLink('reddit', profile.reddit)"><q-avatar><q-icon name="img:statics/reddit.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.tiktok" title="TikTok"><a :href="returnServiceLink('tiktok', profile.tiktok)"><q-avatar><q-icon name="img:statics/tiktok.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.soundcloud" title="SoundCloud"><a :href="returnServiceLink('soundcloud', profile.ethereum)"><q-avatar><q-icon name="img:statics/soundcloud.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.vimeo" title="Vimeo"><a :href="returnServiceLink('vimeo', profile.vimeo)"><q-avatar><q-icon name="img:statics/vimeo.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.spotify" title="Spotify"><a :href="returnServiceLink('spotify', profile.spotify)"><q-avatar><q-icon name="img:statics/spotify.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.youtube" title="Youtube"><a :href="returnServiceLink('youtube', profile.youtube)"><q-avatar><q-icon name="img:statics/youtube.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.bandcamp" title="Bandcamp"><a :href="returnServiceLink('bandcamp', profile.bandcamp)"><q-avatar><q-icon name="img:statics/bandcamp.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.medium" title="Medium"><a :href="returnServiceLink('medium', profile.medium)"><q-avatar><q-icon name="img:statics/medium.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.keybase" title="KeyBase.io"><a :href="returnServiceLink('keybase', profile.keybase)"><q-avatar><q-icon name="img:statics/keybase.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.mastodon" title="Mastodon"><a :href="returnServiceLink('mastodon', profile.mastodon)"><q-avatar><q-icon name="img:statics/mastodon.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.vimm" title="Vimm.tv"><a :href="returnServiceLink('vimm', profile.vimm)"><q-avatar><q-icon name="img:statics/vimm.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.threespeak" title="3speak"><a :href="returnServiceLink('threespeak', profile.threespeak)"><q-avatar><q-icon name="img:statics/threespeak.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.gab" title="Gab"><a :href="returnServiceLink('gab', profile.gab)"><q-avatar><q-icon name="img:statics/gab.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.dbuzz" title="dBuzz"><a :href="returnServiceLink('dbuzz', profile.dbuzz)"><q-avatar><q-icon name="img:statics/dbuzz.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.wordpress" title="Wordpress"><a :href="returnServiceLink('wordpress', profile.wordpress)"><q-avatar><q-icon name="img:statics/wordpress.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.nftshowroom" title="NFTShowroom"><a :href="returnServiceLink('nftshowroom', profile.nftshowroom)"><q-avatar><q-icon name="img:statics/nftshowroom.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.palnet" title="PALnet"><a :href="returnServiceLink('palnet', profile.palnet)"><q-avatar><q-icon name="img:statics/palnet.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.leofinance" title="LEOFinance"><a :href="returnServiceLink('leofinance', profile.leofinance)"><q-avatar><q-icon name="img:statics/leofinance.svg" class="hvr"/></q-avatar></a></span>
    <span v-if="profile.pgp" title="PGP / GPG Key"><a :href="returnServiceLink('pgp', profile.pgp)"><q-avatar><q-icon name="img:statics/pgp.svg" class="hvr"/></q-avatar></a></span>
  </div>
</template>
<script>
import sanitize from 'sanitize-html'
export default {
  name: 'userServices',
  props: ['username'],
  data () {
    return {
    }
  },
  components: {},
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    Sanitize (input) { return sanitize(input) },
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
          if (!isNaN(d)) {
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
        case 'lightning':
          return 'lightning:' + d
        case 'litecoin':
          return 'litecoin:' + d
        case 'ethereum':
          return 'ethereum:' + d
        case 'dogecoin':
          return 'dogecoin:' + d
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
        case 'pinned':
          return 'https://hive.ausbit.dev/@' + this.account.name + '/' + d
      }
    }

  },
  mounted () {},
  computed: {
    account: function () { return this.$store.state.hive.accounts[this.username] },
    meta: function () {
      if (this.account !== undefined) {
        if (this.account.posting_json_metadata) {
          return JSON.parse(sanitize(this.account.posting_json_metadata))
        } else if (this.account.json_metadata) {
          return JSON.parse(sanitize(this.account.json_metadata))
        } else {
          return null
        }
      } else { return null }
    },
    profile: function () {
      if (this.meta) {
        if (this.meta.profile) { return this.meta.profile } else { return null }
      } else { return null }
    }
  }
}
</script>
