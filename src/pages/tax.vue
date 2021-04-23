<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card>
      <q-card-section>
        Export account history for tax purposes
        <q-input v-model="username" label="Enter username" />
        <q-btn label="Analyse" color="primary" no-caps dense glossy @click="init()"/>
      </q-card-section>
      <q-card-section>
        <q-table dense title="Account change by day" :data="hiveTransactionsByDayTotal" :columns="columns" separator="cell" row-key="date" :loading="loading">
          <template v-slot:loading>
            <q-inner-loading showing color="secondary" />
          </template>
          <template v-slot:top-right>
            <q-btn color="orange" icon-right="archive" label="Export csv" dense glossy no-caps @click="exportTable" />
          </template>
        </q-table>
        <div v-if="globalProps">vests to hive 473719.109 {{ vestToHive(473719.109) }}</div>
      </q-card-section>
      <q-card-section v-if="hiveTransactions.length > 0">
        {{ hiveTransactions.length }} tx found
        <q-btn label="Load 1000 tx" @click="getHiveWalletTransactions()" color="primary" dense no-caps glossy class="q-ma-md" />
        <q-btn label="Load 10,000 tx" @click="getBatchTx(10)" color="primary" dense no-caps glossy class="q-ma-md" />
      </q-card-section>
      <q-card-section>
        <q-expansion-item label="raw tx">
          {{ hiveTransactions }}
        </q-expansion-item>
        <q-expansion-item label="rendered">
          <accountOperations :accountOperations="hiveTransactions" />
        </q-expansion-item>
        <q-expansion-item label="tx by day">
          <div v-for="day in hiveTransactionsByDayTotal" :key="day.index">
          {{ day }}
          </div>
        </q-expansion-item>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<style>
</style>
<script>
import { debounce, exportFile } from 'quasar'
import Moment from 'moment'
import accountOperations from 'components/accountOperations.vue'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'
const op = ChainTypes.operations
const walletBitmask = makeBitMaskFilter([
  op.transfer,
  op.transfer_to_vesting,
  op.withdraw_vesting,
  op.interest,
  op.transfer_to_savings,
  op.transfer_from_savings,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance,
  op.producer_reward
])
function wrapCsvValue (val, formatFn) {
  let formatted = formatFn !== undefined
    ? formatFn(val)
    : val
  formatted = formatted === undefined || formatted === null
    ? ''
    : String(formatted)
  formatted = formatted.split('"').join('""')
  /**
   * Excel accepts \n and \r in strings, but some other CSV parsers do not
   * Uncomment the next two lines to escape new lines
   */
  // .split('\n').join('\\n')
  // .split('\r').join('\\r')
  return `"${formatted}"`
}
export default {
  name: 'tax',
  components: {
    accountOperations
  },
  data () {
    return {
      username: this.$router.currentRoute.query.user || null,
      hiveTransactions: [],
      bitmask: walletBitmask,
      accountHistoryPointer: -1,
      accountHistoryLimit: 1000,
      loading: false,
      columns: [
        {
          name: 'date',
          required: true,
          label: 'DATE (YMD)',
          field: row => row.date
        },
        {
          name: 'hive',
          label: 'HIVE',
          field: row => row.hive
        },
        {
          name: 'hbd',
          label: 'HBD',
          field: row => row.hbd
        },
        {
          name: 'vests',
          label: 'VESTS',
          field: row => row.vests
        }
      ]
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    },
    hiveTransactionsByDay: function () {
      if (this.hiveTransactions.length > 0) {
        var tidy = []
        var tx = this.hiveTransactions
        var startStamp = new Moment(tx[0][1].timestamp).format('YYYYMMDD')
        var dayStamp = startStamp
        tx.forEach(i => {
          dayStamp = new Moment(i[1].timestamp).format('YYYYMMDD')
          if (tidy.filter(x => x.date === dayStamp).length === 0) {
            tidy.push({ date: dayStamp, transactions: [i[1].op] })
          } else {
            tidy[tidy.findIndex(x => x.date === dayStamp)].transactions.push(i[1].op)
          }
        })
        return tidy
      } else {
        return []
      }
    },
    hiveTransactionsByDayTotal: function () {
      if (this.hiveTransactions.length > 0) {
        var totalHive = 0
        var totalHbd = 0
        var totalVests = 0
        var output = []
        this.hiveTransactionsByDay.forEach(day => { // Loop through days
          totalHive = totalHbd = totalVests = 0
          console.log('Adding transactions for ' + day.date)
          day.transactions.forEach(tx => { // Loop through transactions within a day
            var t = tx[1]
            switch (tx[0]) {
              case 'claim_rewards_balance':
                if (t.account === this.username) {
                  if (t.reward_hive !== '0.000 HIVE') { totalHive = totalHive + parseFloat(t.reward_hive.split(' ')[0]) }
                  if (t.reward_hbd !== '0.000 HBD') { totalHbd = totalHbd + parseFloat(t.reward_hbd.split(' ')[0]) }
                  if (t.reward_vests !== '0.000 VESTS') { totalVests = totalVests + parseFloat(t.reward_vests.split(' ')[0]) }
                }
                break
              case 'producer_reward':
                if (t.producer === this.username) { totalVests = totalVests + parseFloat(t.vesting_shares.split(' ')[0]) }
                break
              case 'transfer':
                if (t.from === this.username && t.to !== this.username) { // Transfer out, not to self
                  switch (t.amount.split(' ')[1]) {
                    case 'HIVE':
                      totalHive = totalHive - parseFloat(t.amount.split(' ')[0])
                      break
                    case 'HBD':
                      totalHbd = totalHbd - parseFloat(t.amount.split(' ')[0])
                      break
                  }
                }
                if (t.to === this.username && t.from !== this.username) { // Transfer in, not from self
                  switch (t.amount.split(' ')[1]) {
                    case 'HIVE':
                      totalHive = totalHive + parseFloat(t.amount.split(' ')[0])
                      break
                    case 'HBD':
                      totalHbd = totalHbd + parseFloat(t.amount.split(' ')[0])
                      break
                  }
                }
                break
              /* case 'transfer_to_vesting':
                if (t.from === t.to) { // Self powerup
                  totalHive = totalHive - parseFloat(t.amount.split(' ')[0])
                  totalVest = totalVest +
                } else if (t.to === this.username) {
                }
                break */
            }
          })
          output.push({ date: day.date, hive: totalHive.toFixed(3), hbd: totalHbd.toFixed(3), vests: totalVests.toFixed(3) })
        })
        return output
      } else {
        return []
      }
    }
  },
  methods: {
    getBatchTx (limit) {
      var interval = 2000
      for (var i = 0; i < limit; i++) {
        setTimeout(function () {
          this.getHiveWalletTransactions()
        }.bind(this), i * interval)
      }
    },
    exportTable () { // naive encoding to csv format
      const content = [this.columns.map(col => wrapCsvValue(col.label))].concat(
        this.hiveTransactionsByDayTotal.map(row => this.columns.map(col => wrapCsvValue(
          typeof col.field === 'function'
            ? col.field(row)
            : row[col.field === undefined ? col.name : col.field],
          col.format
        )).join(','))
      ).join('\r\n')
      const status = exportFile('account-history-export.csv', content, 'text/csv')
      if (status !== true) { this.$q.notify({ message: 'Browser denied file download...', color: 'negative', icon: 'warning' }) }
    },
    getAccount (username) {
      if (this.$store.state.hive.accounts[username] === undefined) {
        this.$store.dispatch('hive/getAccount', username)
      }
    },
    vestToHive (vests) {
      if (!this.globalProps.empty) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    },
    init () {
      this.hiveTransactions = []
      this.getHiveWalletTransactions()
    },
    async getHiveWalletTransactions () {
      this.loading = true
      await this.$hive.api.callAsync(
        'call',
        ['database_api',
          'get_account_history',
          [this.username,
            this.accountHistoryPointer,
            this.accountHistoryLimit,
            ...this.bitmask
          ]
        ]
      )
        .then(res => {
          this.accountHistoryPointer = parseInt(res[0][0]) - 1
          if (this.hiveTransactions.length === 0) {
            this.hiveTransactions = res.reverse()
          } else {
            this.hiveTransactions = this.hiveTransactions.concat(res.reverse())
          }
          this.loading = false
        })
        .catch(err => {
          this.loading = false
          console.log(err)
          if (err.data.stack[0].data.sequence && err.cause.message.includes('Could not find filtered operation in')) {
            this.accountHistoryPointer = err.data.stack[0].data.sequence
            debounce(this.getHiveWalletTransactions(), 100)
          }
        })
    }
  },
  mounted () {
    document.title = 'Tax export view '
    this.$store.dispatch('hive/getGlobalProps')
    if (this.username) { this.getHiveWalletTransactions() }
  }
}
</script>
