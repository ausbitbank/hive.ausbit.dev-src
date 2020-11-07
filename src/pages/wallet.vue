<template>
  <q-page class="flex">
      <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && globalProps !== null">
          <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== null"/>
          <q-card flat bordered class="q-ma-md q-pa-md" style="max-width:1000px; max-width:100%; min-width:750px">
            <div class="text-h6 text-center" style="clear:both">Wallet</div>
            <q-tabs v-model="tab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify" narrow-indicator>
                <q-tab name="hive" label="Hive (Layer 1)" />
                <q-tab name="hive-engine" label="Hive-Engine (Layer 2)" />
            </q-tabs>
            <q-tab-panels v-model="tab" animated class="shadow-2 rounded-borders">
                <q-tab-panel name="hive">
                    <q-list bordered class="rounded-borders">
                        <q-item>
                            <q-item-section top>
                                <q-item-label>
                                    Hive Tokens
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-medium">
                                     {{ account.balance.split(' ')[0] }} HIVE
                                </q-item-label>
                            </q-item-section>
                            <q-item-section top side>
                                <q-btn dense icon="send" color="primary" title="Transfer" @click="transferHive = true" />
                                <q-dialog v-model="transferHive"><transfer-dialog tokenName="HIVE" network="hive" :balance="parseFloat(account.balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-btn dense icon="arrow_upward" color="primary" title="Power Up" />
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section top>
                                <q-item-label>
                                    Hive Power
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-medium">
                                     {{ vestToHive(parseInt(account.vesting_shares.split(' ')[0])) }} HP
                                     <div v-if="account.vesting_withdraw_rate !== '0.000000 VESTS'">Next powerdown: {{ vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0])) }} HIVE</div>
                                     <div v-if="account.vesting_withdraw_rate !== '0.000000 VESTS'" class="text-caption color-grey">{{ timeDelta(account.next_vesting_withdrawal) }}</div>
                                </q-item-label>
                            </q-item-section>
                            <q-item-section top side>
                                <q-btn dense icon="cancel" color="red" title="Cancel Powerdown" />
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section top>
                                <q-item-label>
                                    Hive Dollars
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-medium">
                                     {{ account.hbd_balance.split(' ')[0] }} HBD
                                </q-item-label>
                            </q-item-section>
                            <q-item-section top side>
                                <q-btn dense icon="send" color="primary" title="Transfer" @click="transferHbd = true" />
                                <q-dialog v-model="transferHbd"><transfer-dialog tokenName="HBD" network="hive" :balance="parseFloat(account.hbd_balance.split(' ')[0])" :username="username" /></q-dialog>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <div id="scrollTargetRef">
                      <div class="text-h6 text-center">Transaction History</div>
                        <q-list bordered v-for="tx in this.hiveTransactions" :key="tx.index">
                          <q-item>
                            <q-item-section avatar>
                              <q-item-label>
                                <q-icon name="add_circle" color="green" v-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="add_circle" color="green-10" v-else-if="(tx[1].op[0] === 'claim_reward_balance')" />
                                <q-icon name="remove_circle" color="red" v-else-if="(tx[1].op[1].from === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="cached" color="blue" v-else-if="(tx[1].op[0] === 'fill_convert_request')" />
                                <q-icon name="arrow_circle_up" color="green-8" v-else-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_up" color="red-8" v-else-if="(tx[1].op[1].to !== username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_down" color="blue-8" v-else-if="(tx[1].op[0] === 'withdraw_vesting')" />
                                <q-icon name="cached" color="blue-5" v-else-if="(tx[1].op[0] === 'fill_order')" />
                              </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                <span v-if="(tx[1].op[1].from === username && tx[1].op[0] === 'transfer')">Sent </span>
                                <span v-else-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer')">Received </span>
                                <span v-else-if="tx[1].op[0] === 'claim_reward_balance'">Claimed Rewards</span>
                                <span v-else-if="tx[1].op[0] === 'fill_convert_request'">Conversion Completed</span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_vesting'">Staked</span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'">Unstaked</span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'">Fill Order</span>
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[0] === 'fill_convert_request'">
                                <router-link :to="getVirtualTxLink(tx)">{{ tx[1].block }}</router-link>
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[0] !== 'fill_convert_request'">
                                <router-link :to="getTxLink(tx[1].trx_id)">{{ tx[1].trx_id.substr(0,8) }}</router-link>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                <span v-if="tx[1].op[1].from === username && tx[1].op[0] === 'transfer'"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[1].from !== username && tx[1].op[0] === 'transfer'"> <router-link :to="getAccountLink(tx[1].op[1].from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].from)" /></q-avatar> {{ tx[1].op[1].from }}</router-link></span>
                                <span v-else-if="tx[1].op[1].account === username && tx[1].op[0] === 'claim_reward_balance'"> <router-link :to="getAccountLink(tx[1].op[1].account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].account)" /></q-avatar> {{ tx[1].op[1].account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_convert_request'"> <router-link :to="getAccountLink(tx[1].op[1].owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].owner)" /></q-avatar> {{ tx[1].op[1].owner }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_vesting'"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'"> <router-link :to="getAccountLink(tx[1].op[1].account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].account)" /></q-avatar> {{ tx[1].op[1].account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'"> <router-link :to="getAccountLink(tx[1].op[1].open_owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].open_owner)" /></q-avatar> {{ tx[1].op[1].open_owner }}</router-link></span>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section :title="tx[1].timestamp">
                              <q-item-label>
                                {{ getDateString(tx[1].timestamp) }}
                              </q-item-label>
                              <q-item-label caption>
                                {{ getTimeString(tx[1].timestamp) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_to_vesting' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].amount }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_to_vesting' && tx[1].op[1].to !== username">
                              <q-item-label class="text-bold">
                                - {{ tx[1].op[1].amount }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner === username">
                              <q-item-label class="text-bold">
                                - {{ tx[1].op[1].open_pays }}
                              </q-item-label>
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].current_pays }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner !== username">
                              <q-item-label class="text-bold">
                                - {{ tx[1].op[1].current_pays }}
                              </q-item-label>
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].open_pays }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].amount }}
                              </q-item-label>
                              <q-item-label>
                                <div v-if="tx[1].op[1].memo !== ''" class="wrap text-center">
                                  <q-icon name="comment" title="" />
                                  <code>{{ sanitize(tx[1].op[1].memo).substr(0,10) }}</code>..
                                  <q-tooltip content-class="bg-primary">
                                    {{ sanitize(tx[1].op[1].memo) }}
                                  </q-tooltip>
                                </div>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].to !== username">
                              <q-item-label class="text-bold">
                                - {{ tx[1].op[1].amount }}
                              </q-item-label>
                              <q-item-label>
                                <div v-if="tx[1].op[1].memo !== ''" class="wrap text-center">
                                  <q-icon name="comment" title="" />
                                  <code>{{ sanitize(tx[1].op[1].memo).substr(0,10) }}</code>..
                                  <q-tooltip content-class="bg-primary">
                                    {{ sanitize(tx[1].op[1].memo) }}
                                  </q-tooltip>
                                </div>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'withdraw_vesting'">
                              <q-item-label class="text-bold">
                                {{ tidyNumber(parseFloat(vestToHive(tx[1].op[1].vesting_shares))) }} HIVE
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'claim_reward_balance'">
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">
                                + {{ tx[1].op[1].reward_hive }}
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hive !== '0.000 HBD'">
                                + {{ tx[1].op[1].reward_hbd }}
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS'">
                                + {{ vestToHive(tx[1].op[1].reward_vests) }} HP
                              </q-item-label>
                              <q-item-label>
                                <div v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].memo !== ''" class="wrap text-center">
                                  <q-icon name="comment" title="" />
                                  <code>{{ sanitize(tx[1].op[1].memo).substr(0,10) }}</code>..
                                  <q-tooltip content-class="bg-primary">
                                    <div class="text-h6">{{ sanitize(tx[1].op[1].memo) }}</div>
                                  </q-tooltip>
                                </div>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_convert_request'">
                              <q-item-label class="text-bold">
                                - {{ tx[1].op[1].amount_in }}
                              </q-item-label>
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].amount_out }}
                              </q-item-label>
                              <q-item-label>
                                <div v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].memo !== ''" class="wrap text-center">
                                  <q-icon name="comment" title="" />
                                  <code>{{ sanitize(tx[1].op[1].memo).substr(0,10) }}</code>..
                                  <q-tooltip content-class="bg-primary">
                                    <div class="text-h6">{{ sanitize(tx[1].op[1].memo) }}</div>
                                  </q-tooltip>
                                </div>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                          <div v-if="!['transfer', 'claim_reward_balance', 'fill_convert_request', 'transfer_to_vesting', 'withdraw_vesting', 'fill_order'].includes(tx[1].op[0])">{{ tx[1].op[0] }} {{ tx[1].op[1] }}</div>
                        </q-list>
                      <div class="text-center text-h6 q-pa-sm">
                        <q-spinner-grid size="2em" color="primary" v-if="loading" />
                        <q-btn @click="getHiveWalletTransactions()" class="cursor-pointer text-bold" icon="update" v-if="!loading"> Load More Transactions</q-btn>
                      </div>
                    </div>
                </q-tab-panel>
                <q-tab-panel name="hive-engine">
                    <q-list bordered class="rounded-borders">
                        <q-item-label header>
                            Hive-Engine (Layer 2) Tokens:
                        </q-item-label>
                        <q-item>
                        </q-item>
                    </q-list>
                </q-tab-panel>
            </q-tab-panels>
          </q-card>
      </div>
    </q-page>
</template>
<style scoped>
.wrap { overflow:auto; overflow-wrap: break-word; }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
import hive from '@hiveio/hive-js'
// hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
import { debounce } from 'quasar'
import accountHeader from 'components/accountHeader.vue'
import transferDialog from 'components/transferDialog.vue'
import moment from 'moment'
import DOMPurify from 'dompurify'
import { ChainTypes, makeBitMaskFilter } from '@hiveio/hive-js/lib/auth/serializer'
const op = ChainTypes.operations
const walletBitmask = makeBitMaskFilter([
  op.transfer,
  op.transfer_to_vesting,
  op.withdraw_vesting,
  op.interest,
  op.liquidity_reward,
  op.transfer_to_savings,
  op.transfer_from_savings,
  op.escrow_transfer,
  op.cancel_transfer_from_savings,
  op.escrow_approve,
  op.escrow_dispute,
  op.escrow_release,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance
])
// console.log(walletBitmask) // returns ["49821653785378844", null] */
export default {
  name: 'wallet',
  data () {
    return {
      account: null,
      username: this.$route.params.username,
      tab: 'hive',
      transferHive: false,
      transferHbd: false,
      transferDialogTokenName: '',
      transferDialogNetwork: 'hive',
      transferDialogBalance: null,
      hiveTransactions: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 1000,
      bitmask: walletBitmask,
      loading: false
    }
  },
  components: { accountHeader, transferDialog },
  methods: {
    sanitize (x) {
      return DOMPurify.sanitize(x)
    },
    getDateString (timestamp) {
      return moment(timestamp).format('MMM D[,] YYYY')
    },
    getTimeString (timestamp) {
      return moment(timestamp).format('h:mm a')
    },
    getAccountLink (account) {
      return '/@' + account
    },
    getTxLink (txid) {
      return '/tx/' + txid
    },
    getVirtualTxLink (tx) {
      return '/b/' + tx[1].block + '#' + tx[1].virtual_op
    },
    getAccount (username) {
      hive.api.getAccountsAsync([username])
        .then((response) => {
          this.account = response[0]
        })
        .catch(() => {
          console.log('Failed to load profile .. retrying')
          debounce(this.getAccount(username), 100)
        })
    },
    getGlobalProps () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => {
          this.globalProps = response
        })
        .catch(() => {
          console.log('Failed to load global properties .. Retrying')
          debounce(this.getGlobalProps(), 50)
        })
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    tidyNumber (x) {
      console.log(x)
      if (x) {
        var parts = x.toString().split('.')``
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    },
    async getHiveWalletTransactions () {
      this.loading = true
      await hive.api.callAsync(
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
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    init () {
      if (!this.globalProps) { this.getGlobalProps() }
      this.username = this.$route.params.username
      if (!this.account || this.account.name !== this.username) {
        this.getAccount(this.username)
        this.getHiveWalletTransactions()
      }
    }
  },
  mounted () {
    this.init()
  }
}
</script>
