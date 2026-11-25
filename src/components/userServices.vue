<template>
  <div class="user-services">
    <span v-if="profile.pinned " title="Pinned Post"><a v-if="profile.pinned !== 'none'" :href="returnServiceLink('pinned', profile.pinned)" aria-label="Pinned post"><q-avatar><q-icon name="push_pin" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.email" title="Email"><a :href="returnServiceLink('email', profile.email)" aria-label="Email"><q-avatar><q-icon name="email" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.protonmail" title="Protonmail"><a :href="returnServiceLink('protonmail', profile.protonmail)" aria-label="Protonmail"><q-avatar><q-icon name="img:/statics/protonmail.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.ipfs" title="Inter Planetary File System"><a :href="returnServiceLink('ipfs', profile.ipfs)" aria-label="Inter Planetary File System"><q-avatar><q-icon name="img:/statics/ipfs.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.twitter" title="X"><a :href="returnServiceLink('twitter', profile.twitter)" target="_blank" rel="noopener noreferrer" aria-label="X"><q-avatar><q-icon name="img:/statics/x.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.twitch" title="Twitch"><a :href="returnServiceLink('twitch', profile.twitch)" target="_blank" rel="noopener noreferrer" aria-label="Twitch"><q-avatar><q-icon name="img:/statics/twitch.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.steam" title="Steam"><a :href="returnServiceLink('steam', profile.steam)" target="_blank" rel="noopener noreferrer" aria-label="Steam"><q-avatar><q-icon name="img:/statics/steam.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.xbox" title="Xbox"><a :href="returnServiceLink('xbox', profile.xbox)" target="_blank" rel="noopener noreferrer" aria-label="Xbox"><q-avatar><q-icon name="img:/statics/xbox.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.psn" title="Playstation Network (PSN)"><a :href="returnServiceLink('psn', profile.psn)" target="_blank" rel="noopener noreferrer" aria-label="PlayStation Network (PSN)"><q-avatar><q-icon name="img:/statics/psn.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.github" title="Github"><a :href="returnServiceLink('github', profile.github)" target="_blank" rel="noopener noreferrer" aria-label="Github"><q-avatar><q-icon name="img:/statics/github.svg"  class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.discord" title="Discord"><a :href="returnServiceLink('discord', profile.discord)" target="_blank" rel="noopener noreferrer" aria-label="Discord"><q-avatar><q-icon name="img:/statics/discord.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.telegram" title="Telegram"><a :href="returnServiceLink('telegram', profile.telegram)" target="_blank" rel="noopener noreferrer" aria-label="Telegram"><q-avatar><q-icon name="img:/statics/telegram.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.bitcoin" title="Bitcoin"><a :href="returnServiceLink('bitcoin', profile.bitcoin)" aria-label="Bitcoin"><q-avatar><q-icon name="img:/statics/bitcoin.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.lightning" title="Lightning"><a :href="returnServiceLink('lightning', profile.lightning)" aria-label="Lightning"><q-avatar><q-icon name="img:/statics/lightning.webp" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.litecoin" title="Litecoin"><a :href="returnServiceLink('litecoin', profile.litecoin)" aria-label="Litecoin"><q-avatar><q-icon name="img:/statics/litecoin.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.ethereum" title="Ethereum"><a :href="returnServiceLink('ethereum', profile.ethereum)" aria-label="Ethereum"><q-avatar><q-icon name="img:/statics/ethereum.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.dogecoin" title="Dogecoin"><a :href="returnServiceLink('dogecoin', profile.dogecoin)" aria-label="Dogecoin"><q-avatar><q-icon name="img:/statics/dogecoin.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    <span v-if="profile.tokens" title="Tokens">
      <span v-for="address in profile.tokens.btc" :key="address" title="Bitcoin"><a :href="returnServiceLink('bitcoin', address)" aria-label="Bitcoin address"><q-avatar><q-icon name="img:/statics/bitcoin.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
      <span v-for="address in profile.tokens.ltc" :key="address" title="Litecoin"><a :href="returnServiceLink('litecoin', address)" aria-label="Litecoin address"><q-avatar><q-icon name="img:/statics/litecoin.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
      <span v-for="address in profile.tokens.eth" :key="address" title="Ethereum"><a :href="returnServiceLink('ethereum', profile.ethereum)" aria-label="Ethereum address"><q-avatar><q-icon name="img:/statics/ethereum.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
      <span v-for="address in profile.tokens.doge" :key="address" title="Dogecoin"><a :href="returnServiceLink('dogecoin', profile.dogecoin)" aria-label="Dogecoin address"><q-avatar><q-icon name="img:/statics/dogecoin.svg" class="hvr" aria-hidden="true" /></q-avatar></a></span>
    </span>
    <span v-if="profile.flickr" title="Flickr"><a :href="returnServiceLink('flickr', profile.flickr)" aria-label="Flickr"><q-avatar><q-icon name="img:/statics/flickr.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.facebook" title="Facebook"><a :href="returnServiceLink('facebook', profile.facebook)" aria-label="Facebook"><q-avatar><q-icon name="img:/statics/facebook.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.tumblr" title="Tumblr"><a :href="returnServiceLink('tumblr', profile.tumblr)" aria-label="Tumblr"><q-avatar><q-icon name="img:/statics/tumblr.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.linkedin" title="LinkedIn"><a :href="returnServiceLink('linkedin', profile.linkedin)" aria-label="LinkedIn"><q-avatar><q-icon name="img:/statics/linkedin.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.instagram" title="Instagram"><a :href="returnServiceLink('instagram', profile.instagram)" aria-label="Instagram"><q-avatar><q-icon name="img:/statics/instagram.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.reddit" title="Reddit"><a :href="returnServiceLink('reddit', profile.reddit)" aria-label="Reddit"><q-avatar><q-icon name="img:/statics/reddit.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.tiktok" title="TikTok"><a :href="returnServiceLink('tiktok', profile.tiktok)" aria-label="TikTok"><q-avatar><q-icon name="img:/statics/tiktok.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.soundcloud" title="SoundCloud"><a :href="returnServiceLink('soundcloud', profile.ethereum)" aria-label="SoundCloud"><q-avatar><q-icon name="img:/statics/soundcloud.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.vimeo" title="Vimeo"><a :href="returnServiceLink('vimeo', profile.vimeo)" aria-label="Vimeo"><q-avatar><q-icon name="img:/statics/vimeo.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.spotify" title="Spotify"><a :href="returnServiceLink('spotify', profile.spotify)" aria-label="Spotify"><q-avatar><q-icon name="img:/statics/spotify.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.youtube" title="Youtube"><a :href="returnServiceLink('youtube', profile.youtube)" aria-label="Youtube"><q-avatar><q-icon name="img:/statics/youtube.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.bandcamp" title="Bandcamp"><a :href="returnServiceLink('bandcamp', profile.bandcamp)" aria-label="Bandcamp"><q-avatar><q-icon name="img:/statics/bandcamp.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.medium" title="Medium"><a :href="returnServiceLink('medium', profile.medium)" aria-label="Medium"><q-avatar><q-icon name="img:/statics/medium.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.keybase" title="KeyBase.io"><a :href="returnServiceLink('keybase', profile.keybase)" aria-label="KeyBase.io"><q-avatar><q-icon name="img:/statics/keybase.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.mastodon" title="Mastodon"><a :href="returnServiceLink('mastodon', profile.mastodon)" aria-label="Mastodon"><q-avatar><q-icon name="img:/statics/mastodon.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.vimm" title="Vimm.tv"><a :href="returnServiceLink('vimm', profile.vimm)" aria-label="Vimm.tv"><q-avatar><q-icon name="img:/statics/vimm.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.threespeak" title="3speak"><a :href="returnServiceLink('threespeak', profile.threespeak)" aria-label="3speak"><q-avatar><q-icon name="img:/statics/threespeak.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.gab" title="Gab"><a :href="returnServiceLink('gab', profile.gab)" aria-label="Gab"><q-avatar><q-icon name="img:/statics/gab.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.dbuzz" title="dBuzz"><a :href="returnServiceLink('dbuzz', profile.dbuzz)" aria-label="dBuzz"><q-avatar><q-icon name="img:/statics/dbuzz.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.wordpress" title="Wordpress"><a :href="returnServiceLink('wordpress', profile.wordpress)" aria-label="Wordpress"><q-avatar><q-icon name="img:/statics/wordpress.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.nftshowroom" title="NFTShowroom"><a :href="returnServiceLink('nftshowroom', profile.nftshowroom)" aria-label="NFTShowroom"><q-avatar><q-icon name="img:/statics/nftshowroom.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.palnet" title="PALnet"><a :href="returnServiceLink('palnet', profile.palnet)" aria-label="PALnet"><q-avatar><q-icon name="img:/statics/palnet.webp" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.leofinance" title="LEOFinance"><a :href="returnServiceLink('leofinance', profile.leofinance)" aria-label="LEOFinance"><q-avatar><q-icon name="img:/statics/leofinance.webp" class="hvr" aria-hidden="true"/></q-avatar></a></span>
    <span v-if="profile.pgp" title="PGP / GPG Key"><a :href="returnServiceLink('pgp', profile.pgp)" aria-label="PGP / GPG Key"><q-avatar><q-icon name="img:/statics/pgp.svg" class="hvr" aria-hidden="true"/></q-avatar></a></span>
  </div>
</template>
<style scoped>
.user-services {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.user-services a {
  display: inline-flex;
}
</style>
<script>
import { stripHtml, safeJsonParse } from 'src/utils/safeHtml'
import { hiveAvatarUrl } from 'src/utils/avatar'
export default {
  name: 'userServices',
  props: ['username'],
  data () {
    return {
    }
  },
  components: {},
  methods: {
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    returnServiceLink (service, data) {
      const raw = stripHtml(data).trim()
      const seg = encodeURIComponent(raw)
      const schemeValue = raw.replace(/[\s<>"'`\\]/g, '')
      const mailValue = raw.replace(/[\s<>"'`\\]/g, '').split(/[?#]/)[0]
      switch (service) {
        case 'twitter':
          return 'https://x.com/' + seg
        case 'twitch':
          return 'https://twitch.tv/' + seg
        case 'github':
          return 'https://github.com/' + seg
        case 'discord':
          if (!isNaN(raw)) {
            return 'https://discordapp.com/users/' + seg // If it's a number, its a user
          } else {
            return 'https://discord.gg/' + seg // If not, it's an invite code
          }
        case 'telegram':
          return 'https://www.t.me/' + seg
        case 'email':
          return 'mailto:' + mailValue
        case 'protonmail':
          return 'mailto:' + mailValue
        case 'bitcoin':
          return 'bitcoin:' + schemeValue
        case 'lightning':
          return 'lightning:' + schemeValue
        case 'litecoin':
          return 'litecoin:' + schemeValue
        case 'ethereum':
          return 'ethereum:' + schemeValue
        case 'dogecoin':
          return 'dogecoin:' + schemeValue
        case 'ipfs':
          return 'https://ipfs.io/ipfs/' + seg
        case 'xbox':
          return 'https://account.xbox.com/en-us/profile?gamertag=' + seg
        case 'psn':
          return 'https://my.playstation.com/profile/' + seg
        case 'steam':
          return 'https://steamcommunity.com/id/' + seg
        case 'flickr':
          return 'https://www.flickr.com/photos/' + seg
        case 'facebook':
          return 'https://facebook.com/' + seg
        case 'tumblr':
          return 'https://' + seg + '.tumblr.com'
        case 'linkedin':
          return 'https://linkedin.com/in/' + seg
        case 'instagram':
          return 'https://instagram.com/' + seg
        case 'reddit':
          return 'https://reddit.com/user/' + seg
        case 'tiktok':
          return 'https://tiktok.com/@' + seg
        case 'soundcloud':
          return 'https://soundcloud.com/' + seg
        case 'vimeo':
          return 'https://vimeo.com/' + seg
        case 'spotify':
          return 'https://open.spotify.com/artist/' + seg
        case 'youtube':
          return 'https://youtube.com/channel/' + seg
        case 'bandcamp':
          return 'https://' + seg + '.bandcamp.com'
        case 'medium':
          return 'https://medium.com/@' + seg
        case 'keybase':
          return 'https://keybase.io/' + seg
        case 'mastodon': {
          // Accept @user@server, user@server, or a bare username. The server
          // must look like a hostname; the username is always encoded so it
          // cannot inject a different host or path.
          const handle = raw.replace(/^@/, '')
          const at = handle.indexOf('@')
          const user = at === -1 ? handle : handle.slice(0, at)
          const host = at === -1 ? '' : handle.slice(at + 1)
          if (!user) return 'https://mstdn.social/@' + seg
          if (!host) return 'https://mstdn.social/@' + encodeURIComponent(user)
          if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return 'https://mstdn.social/@' + seg
          return 'https://' + host.toLowerCase() + '/@' + encodeURIComponent(user)
        }
        case 'vimm':
          return 'https://vimm.tv/@' + seg
        case 'threespeak':
          return 'https://3speak.co/user/' + seg
        case 'gab':
          return 'https://gab.com/' + seg
        case 'dbuzz':
          return 'https://d.buzz/#/@' + seg
        case 'wordpress':
          return 'https://' + seg + '.wordpress.com'
        case 'nftshowroom':
          return 'https://nftshowroom.com/' + seg
        case 'palnet':
          return 'https://palnet.io/@' + seg
        case 'leofinance':
          return 'https://leofinance.io/@' + seg
        case 'pgp':
          if (raw.indexOf('0x') === 0) { // Key fingerprint, link to server
            return 'https://keys.openpgp.org/search?q=' + seg
          } else { // Assume hive post authperm to full key, link it  (@username/permlink)
            return 'https://hive.ausbit.dev/' + seg
          }
        case 'pinned':
          return 'https://hive.ausbit.dev/@' + this.account.name + '/' + seg
      }
    }

  },
  mounted () {},
  computed: {
    account: function () { return this.$hiveStore.accounts[this.username] },
    meta: function () {
      if (this.account !== undefined) {
        if (this.account.posting_json_metadata) {
          return safeJsonParse(this.account.posting_json_metadata)
        } else if (this.account.json_metadata) {
          return safeJsonParse(this.account.json_metadata)
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
