<template>
  <q-page class="flex flex-center">
    <div class="q-pa-sm row items-start q-gutter-sm">
      <q-card v-if="introMeme">
        <q-card-section class="text-bold text-center">
          <img src="https://i.imgflip.com/3u458s.jpg" @click="introMeme = false" />
        </q-card-section>
      </q-card>
      <q-card>
        <form @submit.prevent.stop="checkUsername(username); username = ''" @reset.prevent.stop="onReset" class="q-gutter-md">
          <q-input filled v-model="username" label="Username" />
          <q-btn color="secondary" label="Add User" type="submit" />
        </form>
      </q-card>
      <q-card v-for="account in accounts" :key="account.index">
        <q-card-section>
          <div>
            <q-icon left v-if="account.network === 'hive'" name="img:statics/hextacular.svg" size="20px"/>
            <q-icon left v-if="account.network === 'steem'" name="img:statics/steem.svg" size="20px" />
            <q-chip size="md" class="text-bold" color="primary">
              <q-avatar>
                <q-img v-if="account.network === 'steem'" :src="GetSteemAvatarUrl(account.name)" />
                <q-img v-if="account.network === 'hive'" :src="GetHiveAvatarUrl(account.name)" />
              </q-avatar>
              {{ account.name }}
            </q-chip>
          </div>
          <div v-if="account.network === 'steem'">
            <b>Steem</b>: {{account.balance }}
          </div>
          <div v-if="account.network === 'hive'">
            <b>Hive</b>: {{account.balance }}
          </div>
          <div v-if="account.network === 'steem'">
            <b>SBD</b>: {{ account.pegged }}
          </div>
          <div v-if="account.network === 'hive'">
            <b>HBD</b>: {{ account.pegged }}
          </div>
          <div v-if="account.network === 'steem'">
            <div><b>SP</b>: {{ tidyNumber(vestsToSP(account.vesting_balance*1000000)) }}</div>
            <div><b>SP Unstaking</b>: {{ tidyNumber(vestsToSP(account.to_withdraw_vests)) }}</div>
            <div><b>Powerdown rate</b>: {{ vestsToSP(account.vesting_withdraw_rate_vests*1000000) }}</div>
          </div>
          <div v-if="account.network === 'hive'">
            <div><b>HP</b>: {{ tidyNumber(vestsToHP(account.vesting_balance*1000000)) }}</div>
            <div v-if="account.to_withdraw_vests > 0"><b>HP Unstaking</b>: {{ tidyNumber(vestsToHP(account.to_withdraw_vests)) }}</div>
          </div>
          <div v-if="!account.next_vesting_withdrawal.startsWith('1969')">
            <b>Next Powerdown</b> : {{ timeAgo(account.next_vesting_withdrawal) }}
          </div>
          <div v-if="account.savings_balance > 0">
            <b>Savings</b>: {{ account.savings_balance }}
          </div>
        </q-card-section>
        <q-card-actions>
        <q-btn-dropdown label="Actions">
          <q-list>
            <q-item v-if="account.network == 'steem'" clickable v-close-popup @click="this.powerDownSteem(account.name)">
              <q-item-section>
                <q-item-label>Powerdown Steem</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="account.network == 'steem'" clickable v-close-popup @click="this.transferSteem(account.name)">
              <q-item-section>
                <q-item-label>Transfer Steem</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="account.network == 'hive' && account.to_withdraw_vests > 0" clickable v-close-popup @click="dialogUser = account.name; dialogStopPowerdownHive = true">
              <q-item-section>
                <q-item-label>Stop Hive Powerdown</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="account.network == 'hive'" clickable v-close-popup @click="this.powerUpHive(account.name)">
              <q-item-section>
                <q-item-label>Power up Hive</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        </q-card-actions>
      </q-card>
      <q-dialog v-model="dialogStopHivePowerdown">
        <q-card>
          <q-card-section>
            Stop Hive powerdown for {{ dialogUser }}
          </q-card-section>
          <q-card-actions>
            <q-btn label="Yes" color="positive" />
            <q-btn label="No" color="negative" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script>
import steem from 'steem'
import moment from 'moment'
export default {
  name: 'Exodus',
  data () {
    return {
      accounts: [],
      introMeme: false,
      username: '',
      dialogStopHivePowerdown: false,
      dialogUser: '',
      // rpcHive: 'https://api.openhive.network',
      rpcHive: 'https://rpc.ausbit.dev',
      rpcSteem: 'https://api.steemit.com',
      globalPropsSteem: null,
      globalPropsHive: null
    }
  },
  computed: {
    steemPerMvests: function () {
      if (this.globalPropsSteem.total_vesting_shares) {
        return (this.globalPropsSteem.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsSteem.total_vesting_shares.split(' ')[0] / 1e6))
      } else { return 509.6451627091090586 }
    },
    hivePerMvests: function () {
      if (this.globalPropsHive.total_vesting_shares) {
        return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6))
      } else { return 509.6451627091090586 }
    },
    usernames: function () {
      var usernames = []
      this.accounts.forEach(user => usernames.push(user.name))
      return [...new Set(usernames)]
    },
    usernamesUrl: function () {
      return this.usernames.join('|')
    }
  },
  methods: {
    submitUsername () {
      this.accounts.push(this.username)
      this.username = ''
      this.$router.replace({ path: 'exodus?who=' + this.usernamesUrl })
      // this.$router.currentRoute.query.who.split('|')
    },
    checkUsername (username) {
      // Check Steem Account
      steem.api.setOptions({ url: this.rpcSteem })
      steem.api.getAccounts([username], (err, result) => {
        if (err) { this.$q.notify({ color: 'negative', position: 'top', message: 'Error checking steem api: ' + err.message, icon: 'report_problem' }) }
        if (result.length === 0) { this.$q.notify({ color: 'negative', position: 'top', message: 'Invalid steem username :' + username, icon: 'report_problem' }) }
        if (result.length > 0) { this.addAccountSteem(result[0]) }
      })
      // Check Hive Account
      steem.api.setOptions({ url: this.rpcHive })
      steem.api.getAccounts([username], (err, result) => {
        if (err) { this.$q.notify({ color: 'negative', position: 'top', message: 'Error checking hive api', icon: 'report_problem' }) }
        if (result.length === 0) { this.$q.notify({ color: 'negative', position: 'top', message: 'Invalid hive username :' + username, icon: 'report_problem' }) }
        if (result.length > 0) { this.addAccountHive(result[0]) }
      })
    },
    addAccountSteem (account) {
      var newAccount = {
        network: 'steem',
        name: account.name,
        balance: account.balance.split(' ')[0],
        savings_balance: account.savings_balance.split(' ')[0],
        pegged: account.sbd_balance.split(' ')[0],
        to_withdraw_vests: account.to_withdraw,
        to_withdraw_sp: this.vestsToSP(account.to_withdraw),
        vesting_balance: account.vesting_shares.split(' ')[0],
        vesting_balance_sp: this.vestsToSP(account.vesting_shares.split(' ')[0]),
        vesting_withdraw_rate_vests: account.vesting_withdraw_rate.split(' ')[0],
        next_vesting_withdrawal: account.next_vesting_withdrawal
      }
      var oldAccount = this.accounts.filter(function (el) { if (el.name === account.name && el.network === 'steem') { return true } else { return false } })[0]
      if (oldAccount) { oldAccount = newAccount } else { this.accounts.push(newAccount) }
      this.$router.replace({ path: 'exodus?who=' + this.usernamesUrl })
    },
    addAccountHive (account) {
      var newAccount = {
        network: 'hive',
        name: account.name,
        balance: account.balance.split(' ')[0],
        savings_balance: account.savings_balance,
        pegged: account.sbd_balance.split(' ')[0],
        to_withdraw_vests: account.to_withdraw,
        vesting_balance: account.vesting_shares.split(' ')[0],
        vesting_withdraw_rate_vests: account.vesting_withdraw_rate.split(' ')[0],
        next_vesting_withdrawal: account.next_vesting_withdrawal
      }
      var oldAccount = this.accounts.filter(function (el) { if (el.name === account.name && el.network === 'hive') { return true } else { return false } })[0]
      if (oldAccount) { oldAccount = newAccount } else { this.accounts.push(newAccount) }
    },
    powerDownSteem (user) {
    },
    powerUpHive (user) {
    },
    stopHivePowerdown (user) {
      this.dialogUser = user
    },
    transferSteem (user) {
    },
    vestsToSP (v) {
      return ((v * this.steemPerMvests) / 1000000000000).toFixed(3)
    },
    vestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000000000).toFixed(3)
    },
    GetSteemAvatarUrl (user) { return 'https://steemitimages.com/u/' + user + '/avatar' },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    async getGlobalPropsSteem () {
      steem.api.setOptions({ url: this.rpcSteem })
      steem.api.getDynamicGlobalPropertiesAsync().then(function (res, err) {
        if (err) { console.log(err) }
        this.globalPropsSteem = res
      }.bind(this))
    },
    async getGlobalPropsHive () {
      steem.api.setOptions({ url: this.rpcHive })
      steem.api.getDynamicGlobalPropertiesAsync().then(function (res, err) {
        if (err) { console.log(err) }
        this.globalPropsHive = res
      }.bind(this))
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    timeAgo (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    timeUntil (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = now.diff(stamp, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    sortAlphabetically (toSort) {
      toSort.sort(function (a, b) {
        var textA = a.name.toUpperCase()
        var textB = b.name.toUpperCase()
        return (textA < textB) ? -1 : (textA > textB) ? 1 : 0
      })
    },
    initialize () {
      this.getGlobalPropsSteem()
      this.getGlobalPropsHive()
      if (this.$router.currentRoute.query) {
        var startusers = this.$router.currentRoute.query.who.split('|')
        startusers.forEach(user => this.checkUsername(user))
      }
    }
  },
  mounted () {
    this.initialize()
  }
}
</script>
