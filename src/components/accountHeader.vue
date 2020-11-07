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
        <span v-if="JSON.parse(account.posting_json_metadata).profile">
            <div v-if="JSON.parse(account.posting_json_metadata).profile.about">{{ JSON.parse(account.posting_json_metadata).profile.about }}</div>
            <div v-if="JSON.parse(account.posting_json_metadata).profile.location"><q-icon name="location_on" /> {{ JSON.parse(account.posting_json_metadata).profile.location }}</div>
            <div v-if="JSON.parse(account.posting_json_metadata).profile.website"><a :href="JSON.parse(account.posting_json_metadata).profile.website"><q-icon name="link" /> {{ JSON.parse(account.posting_json_metadata).profile.website }}</a></div>
        </span>
      </div>
    </div>
</template>
<script>
import hive from '@hiveio/hive-js'
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
    }
  }
}
</script>
