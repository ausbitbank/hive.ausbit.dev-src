<template>
    <div class="col-12 text-center full-wdith" :style='coverImageStyle' v-if="account !== undefined && globalProps !== undefined">
        <q-card flat bordered class="text-center text-subtitle q-pa-md q-ma-md float-right" v-if="showBalances">
            <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
            <div>{{ tidyNumber(account.balance.split(' ')[0]) }} HIVE</div>
            <div>{{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD</div>
        </q-card>
      <router-link :to="getAccountLink(account.name)"><q-avatar class="hvr"><q-img :src="getHiveAvatarUrl(account.name)" /></q-avatar></router-link>
      <div class="text-h4">{{ account.name }}</div>
      <div v-if="this.relationship && this.account !== undefined">
        <q-btn v-if="relationship.follows" no-caps push dense label="Following" color="primary" icon="star" @click="unfollowUser(account.name)" />
        <q-btn v-if="!relationship.follows" no-caps push dense label="Follow" color="grey" icon="person_add" @click="followUser(account.name)" />
        <q-btn v-if="relationship.ignores" no-caps push dense label="Ignored" color="red" @click="unignoreUser(account.name)" />
        <q-btn v-if="!relationship.ignores && !relationship.follows" no-caps push dense label="Ignore" color="grey" icon="volume_off" @click="ignoreUser(account.name)" />
      </div>
      <div class="text-subtitle" v-if="account.posting_json_metadata && showProfile">
        <span v-if="postingJsonMeta.profile">
            <div v-if="postingJsonMeta.profile.about">{{ Sanitize(postingJsonMeta.profile.about) }}</div>
            <div v-if="postingJsonMeta.profile.location" title="Location"><q-icon name="location_on" /> {{ Sanitize(postingJsonMeta.profile.location) }}</div>
            <div v-if="postingJsonMeta.profile.website" title="Website"><a :href="postingJsonMeta.profile.website"><q-icon name="link" /> {{ Sanitize(postingJsonMeta.profile.website.replace('http://', '').replace('https://', '')) }}</a></div>
            <span v-if="postingJsonMeta.profile.pinned " title="Pinned Post"><a v-if="postingJsonMeta.profile.pinned !== 'none'" :href="returnServiceLink('pinned', postingJsonMeta.profile.pinned)"><q-avatar><q-icon name="push_pin" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.email" title="Email"><a :href="returnServiceLink('email', postingJsonMeta.profile.email)"><q-avatar><q-icon name="email" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.protonmail" title="Protonmail"><a :href="returnServiceLink('protonmail', postingJsonMeta.profile.protonmail)"><q-avatar><q-icon name="img:statics/protonmail.svg" class="hvr" /></q-avatar></a></span>
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
            <span v-if="postingJsonMeta.profile.lightning" title="Lightning"><a :href="returnServiceLink('lightning', postingJsonMeta.profile.lightning)"><q-avatar><q-icon name="img:statics/lightning.png" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.litecoin" title="Litecoin"><a :href="returnServiceLink('litecoin', postingJsonMeta.profile.litecoin)"><q-avatar><q-icon name="img:statics/litecoin.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.ethereum" title="Ethereum"><a :href="returnServiceLink('ethereum', postingJsonMeta.profile.ethereum)"><q-avatar><q-icon name="img:statics/ethereum.svg" class="hvr" /></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.dogecoin" title="Dogecoin"><a :href="returnServiceLink('dogecoin', postingJsonMeta.profile.dogecoin)"><q-avatar><q-icon name="img:statics/dogecoin.svg" class="hvr" /></q-avatar></a></span>
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
            <span v-if="postingJsonMeta.profile.keybase" title="KeyBase.io"><a :href="returnServiceLink('keybase', postingJsonMeta.profile.keybase)"><q-avatar><q-icon name="img:statics/keybase.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.mastodon" title="Mastodon"><a :href="returnServiceLink('mastodon', postingJsonMeta.profile.mastodon)"><q-avatar><q-icon name="img:statics/mastodon.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.vimm" title="Vimm.tv"><a :href="returnServiceLink('vimm', postingJsonMeta.profile.vimm)"><q-avatar><q-icon name="img:statics/vimm.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.threespeak" title="3speak"><a :href="returnServiceLink('threespeak', postingJsonMeta.profile.threespeak)"><q-avatar><q-icon name="img:statics/threespeak.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.gab" title="Gab"><a :href="returnServiceLink('gab', postingJsonMeta.profile.gab)"><q-avatar><q-icon name="img:statics/gab.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.dbuzz" title="dBuzz"><a :href="returnServiceLink('dbuzz', postingJsonMeta.profile.dbuzz)"><q-avatar><q-icon name="img:statics/dbuzz.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.wordpress" title="Wordpress"><a :href="returnServiceLink('wordpress', postingJsonMeta.profile.wordpress)"><q-avatar><q-icon name="img:statics/wordpress.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.nftshowroom" title="NFTShowroom"><a :href="returnServiceLink('nftshowroom', postingJsonMeta.profile.nftshowroom)"><q-avatar><q-icon name="img:statics/nftshowroom.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.palnet" title="PALnet"><a :href="returnServiceLink('palnet', postingJsonMeta.profile.palnet)"><q-avatar><q-icon name="img:statics/palnet.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.leofinance" title="LEOFinance"><a :href="returnServiceLink('leofinance', postingJsonMeta.profile.leofinance)"><q-avatar><q-icon name="img:statics/leofinance.svg" class="hvr"/></q-avatar></a></span>
            <span v-if="postingJsonMeta.profile.pgp" title="PGP / GPG Key"><a :href="returnServiceLink('pgp', postingJsonMeta.profile.pgp)"><q-avatar><q-icon name="img:statics/pgp.svg" class="hvr"/></q-avatar></a></span>
        </span>
      </div>
<q-toolbar dense class="rounded-borders bg-dark text-white text-center" v-if="showNavBar">
  <q-tabs v-model="tab" dense animated shrink inline-label active-color="white" indicator-color="secondary" align="justify" class="text-center" style="margin:auto">
    <q-route-tab name="posts" class="text-deep-purple" label="posts" icon="library_books" :to="'/@' + account.name + '/posts'"/>
    <q-route-tab name="blog" class="text-purple" label="blog" icon="menu_book" :to="'/@' + account.name + '/blog'"/>
    <q-route-tab name="feed" class="text-orange" label="feed" icon="rss_feed" :to="'/@' + account.name + '/feed'"/>
    <q-route-tab name="replies" class="text-blue-grey" label="replies" icon="comment" :to="'/@' + account.name + '/replies'"/>
    <q-route-tab name="comments" label="comments" icon="message" :to="'/@' + account.name + '/comments'"/>
    <q-route-tab name="communities" class="text-teal" label="communities" icon="forum" :to="'/@' + account.name + '/communities'"/>
    <q-route-tab name="wallet" class="text-green" label="wallet" icon="account_balance" :to="'/@' + account.name + '/wallet'"/>
    <q-route-tab name="explorer" class="text-indigo" icon="perm_identity" label="profile" :to="'/@' + account.name"/>
    <q-route-tab v-if="this.$route.path.endsWith('/tip')" name="tip" label="tip" :to="'/@' + account.name + '/tip'"/>
  </q-tabs>
    </q-toolbar>
    </div>
</template>
<script>
import sanitize from 'sanitize-html'
export default {
  name: 'accountHeader',
  data () {
    return {
      tab: 'posts',
      relationship: null
    }
  },
  props: {
    account: {
      required: false
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
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
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
    Sanitize (input) {
      return sanitize(input)
    },
    getRelationshipBetweenAccounts (account1, account2) {
      var method = 'bridge.get_relationship_between_accounts'
      var params = [account1, account2]
      this.$hive.api.callAsync(method, params)
        .then(response => {
          this.relationship = response
        })
    },
    followUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["blog"] }]'
      this.relationship.follows = true
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    unfollowUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": [] }]'
      this.relationship.follows = false
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    ignoreUser (who) {
      var json = '["follow", { "follower": "' + this.loggedInUser + '", "following": "' + who + '", "what": ["ignore"] }]'
      this.relationship.ignores = true
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    unignoreUser (who) {
      this.relationship.ignores = false
      this.unfollowUser(who)
    },
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
  computed: {
    coverImage: function () {
      var defaultCover = 'https://files.peakd.com/file/peakd-hive/ausbitbank/8xq5izkP-cover-1.jpg'
      if (this.account === null) {
        return defaultCover
      } else {
        if (this.account.posting_json_metadata) {
          if (JSON.parse(this.account.posting_json_metadata).profile) {
            if (JSON.parse(this.account.posting_json_metadata).profile.cover_image) {
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
        return { 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(10, 10, 10, 0.75) 100%), url(' + this.coverImage + ')', 'background-position': 'center, center', 'background-repeat': 'no-repeat', 'background-size': 'cover', 'background-clip': 'border-box, border-box', 'background-color': 'rgba(0, 0, 0, 0)', 'background-attachment': 'scroll, scroll' }
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
    },
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
  mounted () {
    if (this.loggedInUser !== undefined && this.loggedInUser !== this.account.name) {
      this.getRelationshipBetweenAccounts(this.loggedInUser, this.account.name)
    }
  }
}
</script>
