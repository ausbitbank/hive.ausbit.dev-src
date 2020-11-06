<template>
  <q-page class="flex">
      <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && globalProps !== null">
          <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== null"/>
          <q-card flat bordered class="q-ma-md q-pa-md" style="max-width:1000px">
            <div class="text-h6 text-center" style="clear:both">Wallet</div>
            <q-tabs v-model="tab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify" narrow-indicator>
                <q-tab name="hive" label="Hive (Layer 1)" />
                <q-tab name="hive-engine" label="Hive-Engine (Layer 2)" />
            </q-tabs>
            <q-tab-panels v-model="tab" animated class="shadow-2 rounded-borders">
                <q-tab-panel name="hive">
                    <q-list bordered class="rounded-borders">
                        <q-item-label header>
                            Hive (Layer 1) Tokens:
                        </q-item-label>
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
                                     <div>Next powerdown: {{ vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0])) }} HIVE</div>
                                     <div class="text-caption color-grey">{{ timeDelta(account.next_vesting_withdrawal) }}</div>
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
                    <div>
                      <div class="text-h6 text-center">Transaction History</div>
                      <q-list dense bordered v-for="tx in this.hiveTransactions" :key="tx.index" class="row">
                        <q-item v-if="tx[1].op[0] === 'transfer'">
                          <q-item-section>
                            <q-item-label>
                              <span v-if="tx[1].op[1].from === username">Sent </span>
                              <span v-else-if="tx[1].op[1].to === username">Received </span>
                              {{ tx[1].op[1].amount }}
                              <span v-if="tx[1].op[1].from === username">to {{ tx[1].op[1].to  }}</span>
                            <span v-else-if="tx[1].op[1].to === username">from {{ tx[1].op[1].from }}</span>
                              <div v-if="tx[1].op[1].memo !== ''" class="wrap"> <json-viewer :data="tx[1].op[1].memo" /></div>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section top side>
                            <q-item-label>
                              {{ timeDelta(tx[1].timestamp) }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                        <q-item v-if="tx[1].op[0] === 'claim_reward_balance'">
                          <q-item-section>
                            <q-item-label>
                              Claimed rewards:
                              <span v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">{{ tx[1].op[1].reward_hive }}</span>
                              <span v-if="tx[1].op[1].reward_hbd !== '0.000 HBD'">{{ tx[1].op[1].reward_hbd }}</span>
                              <span v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS '">{{ vestToHive(tx[1].op[1].reward_vests) }} HP</span>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section top side>
                            {{ timeDelta(tx[1].timestamp) }}
                          </q-item-section>
                        </q-item>
                        <div v-if="!['transfer', 'claim_reward_balance'].includes(tx[1].op[0])">{{ tx[1].op[0] }} {{ tx[1].op[1] }}</div>
                      </q-list>
                      <div>
                        <span @click="getHiveWalletTransactions()" class="cursor-pointer text-bold">Load More Transactions</span>
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
</style>
<script>
import hive from '@hiveio/hive-js'
import jsonViewer from 'components/jsonViewer.vue'
// hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
hive.api.setOptions({ url: 'https://rpc.ausbit.dev' })
import { debounce } from 'quasar'
import accountHeader from 'components/accountHeader.vue'
import transferDialog from 'components/transferDialog.vue'
import moment from 'moment'
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
      bitmask: walletBitmask
    }
  },
  components: { accountHeader, transferDialog, jsonViewer },
  methods: {
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
