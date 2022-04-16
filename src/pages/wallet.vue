<template>
  <q-page class="flex">
      <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && account !== undefined && globalProps !== null">
          <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== null"/>
          <q-card dense flat bordered class="q-ma-none q-pt-sm" style="max-width:1000px; max-width:100%; min-width: 50%">
            <div class="text-h6 text-center text-green" style="clear:both"><q-icon name="account_balance" color="green" />&nbsp; Wallet</div>
            <q-tabs v-model="tab" dense class="text-grey shadow-2" active-color="primary" indicator-color="primary" align="justify" narrow-indicator inline-label>
                <q-tab name="hive"><q-icon name="img:statics/hive.svg" size="sm" />&nbsp;Hive</q-tab>
                <q-tab name="hive-engine"><q-icon name="img:statics/hive-engine.png" size="sm" />&nbsp;Hive-Engine</q-tab>
            </q-tabs>
            <q-tab-panels v-model="tab" animated>
                <q-tab-panel name="hive">
                    <q-list bordered separator class="rounded-borders">
                        <q-item>
                            <q-item-section avatar class="gt-xs">
                              <q-avatar size="sm">
                                <img src="/statics/hive.svg"/>
                              </q-avatar>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>
                                    Hive
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-medium">
                                {{ tidyNumber(account.balance.split(' ')[0]) }}
                                </q-item-label>
                                <q-item-label caption>
                                  Liquid
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                {{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }}
                              </q-item-label>
                              <q-item-label caption>
                                Staked<br />
                                <q-badge align="top" class="text-black text-bold" color="green" :title="hivePowerAPR">{{ hivePowerAPR }}% APR</q-badge>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section v-if="account.savings_balance !== '0.000 HIVE'">
                              <q-item-label>
                                {{ tidyNumber(account.savings_balance.split(' ')[0]) }}
                              </q-item-label>
                              <q-item-label caption>
                                Savings
                              </q-item-label>
                            </q-item-section>
                            <q-item-section class="gt-xs">
                              <q-item-label>
                                {{ tidyNumber(((parseFloat(account.balance.split(' ')[0]) + parseFloat(vestToHive(parseFloat(account.vesting_shares.split(' ')[0]))) + parseFloat(account.savings_balance.split(' ')[0])) * hivePriceUsd).toFixed(2)) }}
                              </q-item-label>
                              <q-item-label caption v-if="hivePriceUsdChange !== null">
                                <q-icon name="arrow_upward" color="green" v-if="hivePriceUsdChange > 0" />
                                <q-icon name="arrow_downward" color="red" v-else />
                                {{ hivePriceUsdChange.toFixed(2) }} %
                              </q-item-label>
                              <q-item-label caption>
                                Value (USD)
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side v-if="loggedInUser === username">
                                <q-btn dense flat icon="send" color="primary" title="Transfer" @click="transferHive = true" class="gt-xs"/>
                                <q-dialog v-model="transferHive"><transfer-dialog tokenName="HIVE" network="hive" :balance="parseFloat(account.balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-dialog v-model="stakeHive"><staking-dialog tokenName="HIVE" network="hive" :balance="parseFloat(account.balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-dialog v-model="unstakeHive"><unstaking-dialog tokenName="HIVE" network="hive" :balance="parseFloat(account.balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-dialog v-model="savings"><savings-dialog :tokenName="savingsTokenName" network="hive" :username="username" :type="savingsType" /></q-dialog>
                                <q-dialog v-model="delegationDialogVisible"><delegationDialog :username="username" tokenName="HIVE" :amountVestsSuggest="0" /></q-dialog>
                                <q-dialog v-model="convertDialogVisible"><convertDialog :username="username" :tokenName="convertTokenName" /></q-dialog>
                                <q-btn dense flat icon="more_horiz">
                                  <q-menu>
                                    <q-list bordered separator>
                                      <q-item clickable @click="transferHive = true" class="text-primary">
                                        <q-item-section avatar><q-icon name="send" color="primary" title="transfer" /></q-item-section>
                                        <q-item-section>Transfer</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="$router.push('/market')" class="text-orange" title="Trade Hive/HBD on internal market">
                                        <q-item-section avatar><q-icon name="transform" color="orange" /></q-item-section>
                                        <q-item-section>Market</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="stakeHive = true" class="text-green" title="Stake">
                                        <q-item-section avatar><q-icon name="lock" /> </q-item-section>
                                        <q-item-section>Stake</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="unstakeHive = true" class="text-red" title="Unstake">
                                        <q-item-section avatar><q-icon name="lock_open" /></q-item-section>
                                        <q-item-section>Unstake</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="savings = true; savingsType = 'deposit'; savingsTokenName='HIVE'" v-if="account.balance.split(' ')[0] !== '0.000'" class="text-green" title="Deposit Savings">
                                        <q-item-section avatar><q-icon name="savings" /></q-item-section>
                                        <q-item-section>Deposit</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="savings = true; savingsType = 'withdraw'; savingsTokenName='HIVE'" v-if="account.savings_balance.split(' ')[0] !== '0.000'" class="text-red" title="Withdraw Savings">
                                        <q-item-section avatar><q-icon name="savings" /></q-item-section>
                                        <q-item-section>Withdraw</q-item-section>
                                      </q-item>
                                      <q-item clickable class="text-primary" title="Delegate Hive Power" @click="delegationDialogVisible = true" v-if="account.vesting_shares.split(' ')[0] !== '0.000000'">
                                        <q-item-section avatar><q-icon name="redeem" /></q-item-section>
                                        <q-item-section>Delegate</q-item-section>
                                      </q-item>
                                      <q-item clickable class="text-green" title="Convert Hive to HBD" @click="convertDialogVisible = true; convertTokenName = 'HIVE'" v-if="account.balance.split(' ')[0] !== '0.000'">
                                        <q-item-section avatar><q-avatar size="sm"><img src="/statics/hbd.svg"/></q-avatar></q-item-section>
                                        <q-item-section>Convert</q-item-section>
                                      </q-item>
                                      <q-item clickable class="text-green" title="Create New Account" @click="$router.push('/create')">
                                        <q-item-section avatar><q-avatar size="sm"><q-icon name="person_add" size="sm" color="green" /></q-avatar></q-item-section>
                                        <q-item-section>New Account</q-item-section>
                                      </q-item>
                                      <q-item clickable class="text-orange" title="Exchange" @click="$router.push('/exchange?from=hive&for=' + loggedInUser)">
                                        <q-item-section avatar><q-avatar size="sm"><q-icon name="swap_vertical_circle" size="sm" color="orange" /></q-avatar></q-item-section>
                                        <q-item-section>Exchange</q-item-section>
                                      </q-item>
                                    </q-list>
                                  </q-menu>
                                </q-btn>
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section avatar class="gt-xs">
                              <q-avatar size="sm">
                                <img src="/statics/hbd.svg"/>
                              </q-avatar>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label>
                                    Hive Dollars
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                                <q-item-label class="text-weight-medium">
                                  {{ tidyNumber(account.hbd_balance.split(' ')[0]) }} HBD
                                </q-item-label>
                                <q-item-label caption>
                                  Liquid
                                </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                {{ tidyNumber(account.savings_hbd_balance.split(' ')[0]) }}
                              </q-item-label>
                              <q-item-label caption>
                                Savings<br />
                                <router-link to="/hbd" v-if="globalProps.hbd_interest_rate !== 0">
                                  <q-badge align="top" class="text-black text-bold" color="green" title="HBD interest rates are controlled through witness voting and can change at any time. Interest is paid once per month to balances held in savings">{{ globalProps.hbd_interest_rate / 100 }}% APR</q-badge>
                                </router-link>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section class="gt-xs">
                              <q-item-label>
                                $ {{ tidyNumber(((parseFloat(account.savings_hbd_balance.split(' ')[0]) + parseFloat(account.hbd_balance.split(' ')[0])) * hbdPriceUsd).toFixed(2))}}
                              </q-item-label>
                              <q-item-label caption v-if="hbdPriceUsdChange !== null">
                                <q-icon name="arrow_upward" color="green" v-if="hbdPriceUsdChange > 0" />
                                <q-icon name="arrow_downward" color="red" v-else />
                                {{ hbdPriceUsdChange.toFixed(2) }} %
                              </q-item-label>
                              <q-item-label caption>
                                Value (USD)
                              </q-item-label>
                            </q-item-section>
                            <q-item-section top side v-if="loggedInUser === username">
                                <q-btn dense flat icon="send" color="primary" title="Transfer" @click="transferHbd = true" class="gt-xs"/>
                                <q-dialog v-model="transferHbd"><transfer-dialog tokenName="HBD" network="hive" :balance="parseFloat(account.hbd_balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-btn dense flat icon="more_horiz">
                                  <q-menu>
                                    <q-list bordered separator>
                                      <q-item clickable @click="transferHbd = true" class="text-primary" title="Transfer HBD">
                                        <q-item-section avatar><q-icon name="send" /></q-item-section>
                                        <q-item-section>Transfer</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="$router.push('/market')" class="text-orange" title="Trade Hive/HBD on internal market">
                                        <q-item-section avatar><q-icon name="transform" color="orange" /></q-item-section>
                                        <q-item-section>Market</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="savings = true; savingsType = 'deposit'; savingsTokenName='HBD'" v-if="account.hbd_balance.split(' ')[0] !== '0.000'" class="text-green" title="Deposit Savings">
                                        <q-item-section avatar><q-icon name="savings" /></q-item-section>
                                        <q-item-section>Deposit</q-item-section>
                                      </q-item>
                                      <q-item clickable @click="savings = true; savingsType = 'withdraw'; savingsTokenName='HBD'" v-if="account.savings_hbd_balance.split(' ')[0] !== '0.000'" class="text-red" title="Withdraw Savings">
                                        <q-item-section avatar><q-icon name="savings" /></q-item-section>
                                        <q-item-section>Withdraw</q-item-section>
                                      </q-item>
                                      <q-item clickable class="text-secondary" title="Convert HBD to Hive" @click="convertDialogVisible = true; convertTokenName = 'HBD'" v-if="account.hbd_balance.split(' ')[0] !== '0.000'">
                                        <q-item-section avatar><q-avatar size="sm"><img src="/statics/hive.svg"/></q-avatar></q-item-section>
                                        <q-item-section>Convert</q-item-section>
                                      </q-item>
                                    </q-list>
                                  </q-menu>
                                </q-btn>
                            </q-item-section>
                        </q-item>
                        <q-item v-if="account.vesting_withdraw_rate !== '0.000000 VESTS'">
                          <q-item-section avatar>
                            <q-icon name="lock_open" color="red" />
                          </q-item-section>
                          <q-item-section>
                            <div class="text-bold">Hive unstaking in progress</div>
                            <div>Unstaking total: {{ tidyNumber(vestToHive(parseInt(account.to_withdraw / 1000000))) }} Hive</div>
                            <div>Unstaked so far: {{ tidyNumber(vestToHive(parseInt(account.withdrawn / 1000000))) }} Hive</div>
                          </q-item-section>
                          <q-item-section>
                              <div>Next: {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }} Hive <span class="text-caption color-grey">{{ timeDelta(account.next_vesting_withdrawal) }}</span></div>
                          </q-item-section>
                          <q-item-section side v-if="this.loggedInUser === this.username">
                              <q-btn flat icon="cancel" color="red" title="Cancel Powerdown" @click="unstakeHive = true" />
                          </q-item-section>
                        </q-item>
                        <savingsWithdrawalsInProgress :username="username" />
                        <q-item v-if="account.savings_hbd_seconds > 0">
                          <q-item-section avatar>
                            <q-icon name="trending_up" color="green" />
                          </q-item-section>
                          <q-item-section>
                          Estimated pending interest of {{ pendingHbdInterest }} HBD<br />
                          <div class="text-subtitle"><q-icon name="timer" color="grey" /> &nbsp; Last interest payout was {{ timeDelta(account.savings_hbd_last_interest_payment) }}</div>
                          </q-item-section>
                          <q-item-section v-if="pendingHbdClaim && loggedInUser === username">
                            <q-btn dense flat icon="redeem" color="primary" label="Claim" @click="claimHbdInterest()" :disable="!pendingHbdClaim" :title="!pendingHbdClaim ? 'Cannot claim yet (30 day minimum)': 'Claim your interest'" />
                          </q-item-section>
                        </q-item>
                        <q-item v-if="account.reward_vesting_balance !== '0.000000 VESTS'||account.reward_hbd_balance !== '0.000 HBD'||account.reward_hive_balance !== '0.000 HIVE'">
                          <q-item-section avatar>
                            <q-icon name="stars" color="gold" />
                          </q-item-section>
                          <q-item-section>
                            <div>Pending Rewards:</div>
                            <div v-if="account.reward_vesting_balance !== '0.000000 VESTS'">{{ account.reward_vesting_hive.split(' ')[0] }} Staked Hive</div>
                            <div v-if="account.reward_hbd_balance !== '0.000 HBD'">{{ account.reward_hbd_balance }}</div>
                            <div v-if="account.reward_hive_balance !== '0.000 HIVE'">{{ account.reward_hive_balance }}</div>
                          </q-item-section>
                          <q-item-section v-if="account.name === loggedInUser">
                            <claim-rewards :A="account"/>
                          </q-item-section>
                        </q-item>
                        <q-item>
                          <q-item-section>
                            <delegations :username="username" />
                            <convertRequests :username="username" />
                          </q-item-section>
                        </q-item>
                    </q-list>
                    <div id="scrollTargetRef">
                      <div class="text-h6 text-center">Transaction History</div>
                      <div class="text-center">
                        <q-btn no-caps dense glossy label="Filter" icon="filter_alt">
                          <q-popup-proxy>
                            <q-card flat bordered class="q-pa-sm">
                              <div class="text-h6">Show transaction types</div>
                              <q-toggle v-model="filter.showClaimedRewards" label="Claimed Rewards" /><br />
                              <!-- <q-toggle v-model="filter.showDust" label="Show Dust Transfers (0.001)" /><br /> -->
                              <q-toggle v-model="filter.showTransfersIn" label="Transfers In" /><br />
                              <q-toggle v-model="filter.showTransfersOut" label="Transfers Out" /><br />
                              <q-toggle v-model="filter.showMarketOrders" label="Market Orders" /><br />
                              <q-toggle v-model="filter.showStaking" label="Staking" /><br />
                              <q-toggle v-model="filter.showUnStaking" label="Un-Staking" /><br />
                              <q-toggle v-model="filter.showSavings" label="Savings" /><br />
                              <q-input v-model="filter.search" label="Contains" clearable @clear="filter.search = ''" /><br />
                              {{ hiveTransactions.length }} tx loaded, {{ filteredTransactionsHive.length }} visible after filtering
                            </q-card>
                          </q-popup-proxy>
                        </q-btn>
                      </div>
                      <q-scroll-area style="height: 500px;" ref="infiniteScroll">
                      <q-infinite-scroll @load="getHiveWalletTransactions" :offset="150" scroll-target=“body”>
                        <q-list dense bordered v-for="tx in this.filteredTransactionsHive" :key="tx.index">
                          <q-item>
                            <q-item-section avatar class="gt-xs">
                              <q-item-label>
                                <q-icon name="add_circle" color="green" v-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="add_circle" color="green-10" v-else-if="(tx[1].op[0] === 'claim_reward_balance')" />
                                <q-icon name="add_circle" color="green-9" v-else-if="(tx[1].op[0] === 'interest')" />
                                <q-icon name="remove_circle" color="red" v-else-if="(tx[1].op[1].from === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="cached" color="blue" v-else-if="(tx[1].op[0] === 'fill_convert_request')" />
                                <q-icon name="arrow_circle_up" color="green-8" v-else-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_up" color="red-8" v-else-if="(tx[1].op[1].to !== username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_down" color="blue-8" v-else-if="(tx[1].op[0] === 'withdraw_vesting')" />
                                <q-icon name="arrow_circle_down" color="red-8" v-else-if="(tx[1].op[0] === 'fill_vesting_withdraw')" />
                                <q-icon name="arrow_circle_up" color="orange-6" v-else-if="(tx[1].op[0] === 'transfer_to_savings')" />
                                <q-icon name="arrow_circle_down" color="red-6" v-else-if="(tx[1].op[0] === 'transfer_from_savings')" />
                                <q-icon name="arrow_circle_down" color="red-7" v-else-if="(tx[1].op[0] === 'cancel_transfer_from_savings')" />
                                <q-icon name="arrow_circle_down" color="red-8" v-else-if="(tx[1].op[0] === 'fill_transfer_from_savings')" />
                                <q-icon name="cached" color="blue-5" v-else-if="(tx[1].op[0] === 'fill_order')" />
                                <q-icon name="fact_check" color="orange-8" v-else-if="(tx[1].op[0] === 'escrow_release')" />
                                <q-icon name="swap_horizontal_circle" color="orange-7" v-else-if="(tx[1].op[0] === 'collateralized_convert')" />
                                <q-icon name="swap_horizontal_circle" color="orange-8" v-else-if="(tx[1].op[0] === 'convert')" />
                              </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                <span v-if="(tx[1].op[1].from === username && tx[1].op[0] === 'transfer')">Sent </span>
                                <span v-else-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer')">Received </span>
                                <span v-else-if="tx[1].op[0] === 'claim_reward_balance'">Claimed Rewards</span>
                                <span v-else-if="tx[1].op[0] === 'fill_convert_request'">Conversion Completed</span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_vesting'">Staked</span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting' && tx[1].op[1].vesting_shares === '0.000000 VESTS'">Cancelled Unstake</span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'">Unstaked</span>
                                <span v-else-if="tx[1].op[0] === 'fill_vesting_withdraw'">Unstake Received</span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'">Fill Order</span>
                                <span v-else-if="tx[1].op[0] === 'interest'">Interest</span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_savings'">Transfer to Savings</span>
                                <span v-else-if="tx[1].op[0] === 'transfer_from_savings'">Begin Transfer from Savings</span>
                                <span v-else-if="tx[1].op[0] === 'fill_transfer_from_savings'">Complete Transfer from Savings</span>
                                <span v-else-if="tx[1].op[0] === 'cancel_transfer_from_savings'">Cancel Transfer from Savings</span>
                                <span v-else-if="tx[1].op[0] === 'collateralized_convert'">Collateralized Convert Started</span>
                                <span v-else-if="tx[1].op[0] === 'convert'">Conversion Started</span>
                              </q-item-label>
                              <q-item-label caption v-if="['fill_convert_request','fill_vesting_withdraw', 'fill_transfer_from_savings'].includes(tx[1].op[0])">
                                <router-link :to="getVirtualTxLink(tx)">{{ tx[1].block }}</router-link>
                              </q-item-label>
                              <q-item-label caption v-else>
                                <router-link :to="getTxLink(tx[1].trx_id)">{{ tx[1].trx_id.substr(0,8) }}</router-link>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                <span v-if="tx[1].op[1].from === username && tx[1].op[0] === 'transfer'"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[1].from !== username && tx[1].op[0] === 'transfer'"> <router-link :to="getAccountLink(tx[1].op[1].from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].from)" /></q-avatar> {{ tx[1].op[1].from }}</router-link></span>
                                <span v-else-if="tx[1].op[1].account === username && tx[1].op[0] === 'claim_reward_balance'"> <router-link :to="getAccountLink(tx[1].op[1].account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].account)" /></q-avatar> {{ tx[1].op[1].account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_convert_request'"> <router-link :to="getAccountLink(tx[1].op[1].owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].owner)" /></q-avatar> {{ tx[1].op[1].owner }}</router-link></span>
                                <span v-else-if="['transfer_to_savings', 'transfer_from_savings', 'fill_transfer_from_savings', 'transfer_to_vesting'].includes(tx[1].op[0])"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'cancel_transfer_from_savings'"> <router-link :to="getAccountLink(tx[1].op[1].from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].from)" /></q-avatar> {{ tx[1].op[1].from }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'"> <router-link :to="getAccountLink(tx[1].op[1].account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].account)" /></q-avatar> {{ tx[1].op[1].account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'"> <router-link :to="getAccountLink(tx[1].op[1].open_owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].open_owner)" /></q-avatar> {{ tx[1].op[1].open_owner }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'interest'"> <router-link :to="getAccountLink(tx[1].op[1].owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].owner)" /></q-avatar> {{ tx[1].op[1].owner }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_vesting_withdraw'"> <router-link :to="getAccountLink(tx[1].op[1].from_account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].from_account)" /></q-avatar> {{ tx[1].op[1].from_account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'collateralized_convert'"> <router-link :to="getAccountLink(tx[1].op[1].owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].owner)" /></q-avatar> {{ tx[1].op[1].owner }}</router-link></span>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section :title="tx[1].timestamp" class="gt-xs">
                              <q-item-label>
                                {{ getDateString(tx[1].timestamp) }}
                              </q-item-label>
                              <q-item-label caption>
                                {{ getTimeString(tx[1].timestamp) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_to_vesting' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold">
                                + {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_to_vesting' && tx[1].op[1].to !== username">
                              <q-item-label class="text-bold">
                                - {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_to_savings' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold">
                                + {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                              <q-item-label v-if="tx[1].op[1].memo !== ''">
                                <q-btn dense push rounded color="primary" icon="lock" v-if="(loggedInUser === tx[1].op[1].to || loggedInUser === tx[1].op[1].from) && tx[1].op[1].memo.startsWith('#')" label="Decrypt" @click="decodeMemo(tx[1].op[1].memo, tx)" />
                                <span class="text-caption" style="word-wrap:break-word">{{ sanitize(tx[1].op[1].memo).substr(0,50) }}</span>
                                <q-tooltip content-class="bg-dark color-white q-pa-md text-h6">
                                  {{ sanitize(tx[1].op[1].memo) }}
                                </q-tooltip>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_transfer_from_savings'">
                              <q-item-label class="text-bold">
                                + {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer_from_savings'">
                              <q-item-label class="text-bold">
                                ({{ tidyNumber(tx[1].op[1].amount) }})
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner === username">
                              <q-item-label class="text-bold text-red-5">
                                - {{ tidyNumber(tx[1].op[1].open_pays) }}
                              </q-item-label>
                              <q-item-label class="text-bold text-green-5">
                                + {{ tidyNumber(tx[1].op[1].current_pays) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner !== username">
                              <q-item-label class="text-bold text-red-5">
                                - {{ tidyNumber(tx[1].op[1].current_pays) }}
                              </q-item-label>
                              <q-item-label class="text-bold text-green-5">
                                + {{ tidyNumber(tx[1].op[1].open_pays) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold text-green-9">
                                + {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HIVE'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hivePriceUsd).toFixed(4)) }})
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HBD'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hbdPriceUsd).toFixed(4)) }})
                              </q-item-label>
                              <q-item-label v-if="tx[1].op[1].memo !== ''">
                                <q-btn dense push rounded color="primary" icon="lock" v-if="(loggedInUser === tx[1].op[1].to || loggedInUser === tx[1].op[1].from) && tx[1].op[1].memo.startsWith('#')" label="Decrypt" @click="decodeMemo(tx[1].op[1].memo, tx)" />
                                <span class="text-caption" style="word-wrap:break-word">{{ sanitize(tx[1].op[1].memo).substr(0,50) }}</span>
                                <q-tooltip content-class="bg-dark color-white q-pa-md text-h6">
                                  {{ sanitize(tx[1].op[1].memo) }}
                                </q-tooltip>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].to !== username">
                              <q-item-label class="text-bold text-red">
                                - {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HIVE'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hivePriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HBD'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hbdPriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label v-if="tx[1].op[1].memo !== ''">
                                <q-btn dense push rounded color="primary" icon="lock" v-if="(loggedInUser === tx[1].op[1].to || loggedInUser === tx[1].op[1].from) && tx[1].op[1].memo.startsWith('#')" label="Decrypt" @click="decodeMemo(tx[1].op[1].memo, tx)" />
                                <span class="text-caption" style="word-wrap:break-word;">{{ sanitize(tx[1].op[1].memo).substr(0,50) }}</span>
                                <q-tooltip content-class="bg-dark color-white q-pa-md text-h6">
                                  {{ sanitize(tx[1].op[1].memo) }}
                                </q-tooltip>
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'withdraw_vesting'">
                              <q-item-label class="text-bold">
                                {{ vestToHive(tx[1].op[1].vesting_shares) }} HIVE
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_vesting_withdraw'">
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].deposited }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'collateralized_convert'">
                              <q-item-label class="text-bold text-orange">
                                {{ tidyNumber(tx[1].op[1].amount.split(' ')[0]) }} {{ tx[1].op[1].amount.split(' ')[1] }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'convert'">
                              <q-item-label class="text-bold text-orange">
                                {{ tidyNumber(tx[1].op[1].amount.split(' ')[0]) }} {{ tx[1].op[1].amount.split(' ')[1] }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'interest'" class="text-green-9">
                              <q-item-label class="text-bold">
                                + {{ tx[1].op[1].interest }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[0] === 'interest'">
                                (${{ tidyNumber((tx[1].op[1].interest.split(' ')[0] * hbdPriceUsd).toFixed(2)) }})
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'claim_reward_balance'" class="text-green-10">
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">
                                + {{ tidyNumber(tx[1].op[1].reward_hive) }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">
                                + ${{ tidyNumber(parseFloat(tx[1].op[1].reward_hive.split(' ')[0]) * hivePriceUsd) }}
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hbd !== '0.000 HBD'">
                                + {{ tidyNumber(tx[1].op[1].reward_hbd) }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_hbd !== '0.000 HBD'">
                                (${{ tidyNumber((parseFloat(tx[1].op[1].reward_hbd.split(' ')[0]) * hbdPriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS'">
                                + {{ tidyNumber(vestToHive(tx[1].op[1].reward_vests)) }} HP
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS'">
                                (${{ tidyNumber((parseFloat(vestToHive(tx[1].op[1].reward_vests.split(' ')[0])) * hivePriceUsd).toFixed(2)) }})
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
                          <div v-if="!['transfer', 'fill_vesting_withdraw', 'claim_reward_balance', 'fill_convert_request', 'transfer_to_vesting', 'withdraw_vesting', 'fill_order', 'interest', 'transfer_to_savings', 'transfer_from_savings', 'cancel_transfer_from_savings', 'fill_transfer_from_savings', 'collateralized_convert', 'convert'].includes(tx[1].op[0])">{{ tx[1].op[0] }} {{ tx[1].op[1] }}</div>
                        </q-list>
                        <template v-slot:loading>
                          <div class="row justify-center q-my-md">
                            <q-spinner-dots color="primary" size="40px" />
                          </div>
                        </template>
                      </q-infinite-scroll>
                      </q-scroll-area>
                      <!-- <div class="text-center text-h6 q-pa-sm">
                        <q-spinner-puff size="2em" color="primary" v-if="loading" />
                        <q-btn @click="getHiveWalletTransactions()" class="cursor-pointer text-bold" icon="update" color="primary" dense flat bordered v-if="!loading"> Load More Transactions</q-btn>
                      </div> -->
                    </div>
                </q-tab-panel>
                <q-tab-panel name="hive-engine" v-if="hiveEngineBalances !== null && hiveEngineTokenInfo !== null">
                  <div style="margin: auto;" class="text-center">
                    <q-checkbox v-model="hiveEngineBalancesFilterSmall">Filter under ${{ hiveEngineBalancesFilterUsdAmount }} USD value</q-checkbox>
                    <q-btn dense flat title="Change filter amount" icon="settings">
                      <q-popup-proxy>
                        <q-card flat bordered class="q-pa-md text-center">
                          Filter below USD amount
                          <q-input type="number" v-model.number="hiveEngineBalancesFilterUsdAmount" style="max-width:70px" />
                        </q-card>
                      </q-popup-proxy>
                    </q-btn>
                    <q-btn icon="refresh" color="green" dense flat @click="initHiveEngine()" title="Refresh Hive-Engine data" />
                  </div>
                    <q-list bordered separator class="rounded-borders">
                        <q-item v-for="token in hiveEngineBalancesFiltered" :key="token.index">
                          <q-item-section dense avatar class="gt-xs">
                            <q-avatar size="md">
                              <img :src="returnTokenInfoMeta(token.symbol).icon" :title="returnTokenInfoMeta(token.symbol).desc"/>
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label v-if="hiveEngineTokenInfo">
                              <q-btn dense flat :label="token.symbol" title="Click for more info about this token">
                                <q-popup-proxy>
                                  <q-card dense flat bordered style="max-width: 400px">
                                    <q-card-section header class="text-caption text-center">
                                      <q-avatar size="lg"><img :src="returnTokenInfoMeta(token.symbol).icon" :title="returnTokenInfoMeta(token.symbol).desc"/></q-avatar>{{ token.symbol }}<br />
                                      {{ returnTokenInfoMeta(token.symbol).desc }}
                                    </q-card-section>
                                    <q-card-section caption class="text-caption">
                                      Issued by <router-link :to="getAccountLink(returnTokenInfo(token.symbol).issuer)">{{ returnTokenInfo(token.symbol).issuer }}</router-link><br />
                                      Supply: {{ tidyNumber(returnTokenInfo(token.symbol).supply) }}<br />
                                      Max Supply: {{ tidyNumber(returnTokenInfo(token.symbol).maxSupply) }}<br />
                                      Circulating Supply: {{ tidyNumber(returnTokenInfo(token.symbol).circulatingSupply) }}<br />
                                      Total Staked: {{ tidyNumber(returnTokenInfo(token.symbol).totalStaked) }}<br />
                                    </q-card-section>
                                  </q-card>
                                </q-popup-proxy>
                            </q-btn>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.balance > 0">
                            <q-item-label>{{ tidyNumber(token.balance) }}</q-item-label>
                            <q-item-label caption>Liquid</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.stake > 0 && returnTokenInfo(token.symbol).stakingEnabled === true">
                            <q-item-label>{{ tidyNumber(token.stake)}}</q-item-label>
                            <q-item-label caption>Staked</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.pendingUnstake > 0">
                            <q-item-label>{{ tidyNumber(token.pendingUnstake) }}</q-item-label>
                            <q-item-label caption>Unstaking</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.delegationsIn > 0">
                            <q-item-label>{{ tidyNumber(token.delegationsIn) }}</q-item-label>
                            <q-item-label caption>Delegated In</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.delegationsOut > 0">
                            <q-item-label>{{ tidyNumber(token.delegationsOut) }}</q-item-label>
                            <q-item-label caption>Delegated out</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="token.pendingUndelegations > 0">
                            <q-item-label>{{ tidyNumber(token.pendingUndelegations) }}</q-item-label>
                            <q-item-label caption>Undelegating</q-item-label>
                          </q-item-section>
                          <q-item-section v-if="hiveEngineMarketInfo" class="gt-xs">
                            <q-item-label>
                              ${{ tidyNumber((returnTokenPriceUsd(token.symbol) * (parseFloat(token.balance) + parseFloat(token.stake))).toFixed(2)) }}
                            </q-item-label>
                            <q-item-label caption v-if="token.symbol !== 'SWAP.HIVE' && returnTokenPriceChange(token.symbol) !== 0">
                              <q-icon v-if="returnTokenPriceChange(token.symbol) > 0" name="arrow_upward" color="green" />
                              <q-icon v-else name="arrow_downward" color="red" />
                              {{ returnTokenPriceChange(token.symbol) }} %
                            </q-item-label>
                            <q-item-label caption>Value (USD)</q-item-label>
                          </q-item-section>
                          <q-item-section side v-if="loggedInUser === username">
                          <q-btn v-if="parseFloat(token.balance) > 0" dense flat icon="send" color="primary" title="Transfer Token" @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance);  transferHiveEngine = true" />
                              <q-btn dense flat icon="more_horiz">
                                <q-menu>
                                  <q-list style="min-width: 100px" bordered separator>
                                    <q-item clickable @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance); transferHiveEngine = true" v-if="parseFloat(token.balance) > 0" class="text-primary" title="Transfer Token">
                                      <q-item-section avatar><q-icon name="send" /></q-item-section>
                                      <q-item-section>Transfer</q-item-section>
                                    </q-item>
                                    <q-item clickable @click="stakingDialogTokenName = token.symbol; stakingDialogBalance = parseFloat(token.balance); stakeHiveEngine = true" v-if="parseFloat(token.balance) > 0 && returnTokenInfo(token.symbol).stakingEnabled === true" class="text-green" title="Stake Token">
                                      <q-item-section avatar><q-icon name="lock" /></q-item-section>
                                      <q-item-section>Stake</q-item-section>
                                    </q-item>
                                    <q-item clickable @click="unstakingDialogTokenName = token.symbol; unstakingDialogStake = parseFloat(token.stake); unstakingDialogUnstaking = parseFloat(token.pendingUnstake); unstakingDialogCooldown =  returnTokenInfo(token.symbol).unstakingCooldown; unstakingDialogTransactions = returnTokenInfo(token.symbol).numberTransactions; unstakeHiveEngine = true;" v-if="parseFloat(token.stake) > 0 && returnTokenInfo(token.symbol).stakingEnabled === true" class="text-red" title="Unstake Token">
                                      <q-item-section avatar><q-icon name="lock_open" /></q-item-section>
                                      <q-item-section>Unstake</q-item-section>
                                    </q-item>
                                    <q-item clickable @click="$router.push(getTokenLink(token.symbol))" title="Trade" class="text-deep-orange" v-if="token.symbol !== 'SWAP.HIVE'">
                                      <q-item-section avatar><q-icon name="store" /></q-item-section>
                                      <q-item-section>Market</q-item-section>
                                    </q-item>
                                    <q-item clickable @click="openExternal(returnMarketLink('tribaldex', token.symbol))" title="Trade on TribalDex.com" class="text-orange"  v-if="token.symbol !== 'SWAP.HIVE'">
                                      <q-item-section avatar><q-icon name="open_in_new" /></q-item-section>
                                      <q-item-section>TribalDex.com</q-item-section>
                                    </q-item>
                                    <q-item v-if="false">
                                      <q-btn dense flat icon="arrow_upward" color="primary" title="Power Up" label="Power Up" />
                                    </q-item>
                                  </q-list>
                                </q-menu>
                              </q-btn>
                          </q-item-section>
                        </q-item>
                    </q-list>
                    <div v-if="hiveEngineTransactionHistory">
                      <div class="text-h6 text-center">Transaction History</div>
                      <q-scroll-area style="height: 500px">
                      <q-list bordered v-for="tx in this.hiveEngineTransactionHistory" :key="tx.index">
                        <q-item>
                          <q-item-section avatar class="gt-xs">
                            <q-item-label>
                              <q-icon name="add_circle" color="green" v-if="(tx.to === username && tx.operation === 'tokens_transfer')" />
                              <q-icon name="remove_circle" color="red" v-else-if="(tx.from === username && tx.operation === 'tokens_transfer')" />
                              <q-icon name="arrow_circle_up" color="green-8" v-else-if="(tx.to === username && tx.operation === 'tokens_stake')" />
                              <q-icon name="arrow_circle_up" color="red-8" v-else-if="(tx.to !== username && tx.operation === 'tokens_stake')" />
                              <q-icon name="arrow_circle_up" color="red-10" v-else-if="(tx.operation === 'tokens_unstake')" />
                              <q-icon name="arrow_circle_up" color="green-6" v-else-if="(tx.to === username && tx.operation === 'tokens_issue')" />
                              <q-icon name="remove_circle" color="red-2" v-else-if="(tx.from === username && tx.operation === 'tokens_issue')" />
                              <q-icon name="arrow_circle_up" color="green-4" v-else-if="(tx.operation === 'mining_lottery')" />
                              <q-icon name="gavel" color="orange-10" v-else-if="(tx.operation === 'market_placeOrder')" />
                              <q-icon name="gavel" color="orange-9" v-else-if="(tx.operation === 'market_expire')" />
                              <q-icon name="gavel" color="orange-8" v-else-if="(tx.operation === 'market_closeOrder')" />
                              <q-icon name="gavel" color="orange-7" v-else-if="(tx.operation === 'market_cancel')" />
                              <q-icon name="gavel" color="orange-6" v-else-if="(tx.operation === 'market_buy')" />
                              <q-icon name="gavel" color="orange-4" v-else-if="(tx.operation === 'market_sell')" />
                              <q-icon name="gavel" color="green-2" v-else-if="(tx.operation === 'hivepegged_buy')" />
                              <q-icon name="gavel" color="red-6" v-else-if="(tx.operation === 'hivepegged_withdraw')" />
                              <q-icon name="arrow_circle_up" color="green-2" v-else-if="(tx.operation === 'witnesses_proposeRound')" />
                            </q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>
                              <span v-if="(tx.operation === 'witnesses_proposeRound')">Witness Round</span>
                              <span v-if="(tx.from === username && tx.operation === 'tokens_transfer')">Sent </span>
                              <span v-else-if="(tx.to === username && tx.operation === 'tokens_transfer')">Received </span>
                              <span v-else-if="(tx.to === username && tx.operation === 'tokens_stake')">Staked </span>
                              <span v-else-if="(tx.from === username && tx.operation === 'tokens_stake')">Staked </span>
                              <span v-else-if="(tx.operation === 'tokens_unstake')">Unstaked </span>
                              <span v-else-if="(tx.to === username && tx.operation === 'tokens_issue')">Issued </span>
                              <span v-else-if="(tx.operation === 'mining_lottery')">Mined </span>
                              <span v-else-if="(tx.operation === 'market_placeOrder')">Market {{ tx.orderType }} order</span>
                              <span v-else-if="(tx.operation === 'market_closeOrder')">Cancel {{ tx.orderType }} order</span>
                              <span v-else-if="(tx.operation === 'market_expire')">Expired {{ tx.orderType }} order</span>
                              <span v-else-if="(tx.operation === 'market_cancel')">Cancel Market {{ tx.orderType }} order</span>
                              <span v-else-if="(tx.operation === 'market_buy')">Market buy</span>
                              <span v-else-if="(tx.operation === 'market_sell')">Market sell</span>
                              <span v-else-if="(tx.operation === 'hivepegged_buy')">Deposit Hive</span>
                              <span v-else-if="(tx.operation === 'hivepegged_withdraw')">Withdraw Hive</span>
                            </q-item-label>
                            <q-item-label caption>
                              <router-link :to="getTxLink(tx.transactionId.split('-')[0])">{{ tx.transactionId.substr(0,8) }}</router-link>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>
                              <span v-if="tx.from === username && tx.operation === 'tokens_transfer'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm" class="gt-xs"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.from !== username && tx.operation === 'tokens_transfer'"> <router-link :to="getAccountLink(tx.from)"><q-avatar size="sm" class="gt-xs"><q-img :src="getHiveAvatarUrl(tx.from)" /></q-avatar> {{ tx.from }}</router-link></span>
                              <span v-else-if="tx.operation === 'tokens_stake'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm" class="gt-xs"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.operation === 'tokens_unstake'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm" class="gt-xs"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
                              <span v-else-if="tx.to === username && tx.operation === 'tokens_issue'"> {{ tx.from }}</span>
                              <span v-else-if="tx.from === username && tx.operation === 'tokens_issue'"> {{ tx.to }}</span>
                              <span v-else-if="tx.operation === 'mining_lottery'"> {{ tx.poolId }}</span>
                              <span v-else-if="tx.account === username && tx.operation === 'market_placeOrder'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
                              <span v-else-if="tx.operation === 'market_closeOrder'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
                              <span v-else-if="tx.operation === 'market_cancel'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
                              <span v-else-if="tx.operation === 'market_expire'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
                              <span v-else-if="tx.operation === 'market_buy'"> <router-link :to="getAccountLink(tx.from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.from)" /></q-avatar> {{ tx.from }}</router-link></span>
                              <span v-else-if="tx.operation === 'market_sell'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.operation === 'hivepegged_buy'"> <router-link :to="getAccountLink(tx.from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.from)" /></q-avatar> {{ tx.from }}</router-link></span>
                              <span v-else-if="tx.operation === 'hivepegged_withdraw'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.operation === 'witnesses_proposeRound'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section :title="tx.timestamp">
                            <q-item-label>
                              {{ getDateStringHiveEngine(tx.timestamp) }}
                            </q-item-label>
                            <q-item-label caption>
                              {{ getTimeStringHiveEngine(tx.timestamp) }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_transfer' && tx.to === username">
                            <q-item-label class="text-bold text-green">
                              + {{ tx.quantity }} {{ tx.symbol }}<br />
                            </q-item-label>
                            <q-item-label caption>
                              $ {{ (returnTokenPriceUsd(tx.symbol) * tx.quantity).toFixed(returnDecimalsBeforeNonZero(returnTokenPriceUsd(tx.symbol))) }}
                            </q-item-label>
                            <q-item-label v-if="tx.memo !== null">
                              <div class="wrap text-center">
                                <q-icon name="comment" title="" />
                                <code>{{ sanitize(tx.memo).substr(0,10) }}</code>..
                                <q-tooltip content-class="bg-primary">
                                  {{ sanitize(tx.memo) }}
                                </q-tooltip>
                              </div>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_transfer' && tx.to !== username">
                            <q-item-label class="text-bold">
                              - {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              $ {{ (returnTokenPriceUsd(tx.symbol) * tx.quantity).toFixed(returnDecimalsBeforeNonZero(returnTokenPriceUsd(tx.symbol))) }}
                            </q-item-label>
                            <q-item-label>
                              <div v-if="tx.memo !== ''" class="wrap text-center">
                                <q-icon name="comment" title="" />
                                <code>{{ sanitize(tx.memo).substr(0,10) }}</code>..
                                <q-tooltip content-class="bg-primary">
                                  {{ sanitize(tx.memo) }}
                                </q-tooltip>
                              </div>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_stake' && tx.to === username">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              $ {{ (returnTokenPriceUsd(tx.symbol) * tx.quantity).toFixed(returnDecimalsBeforeNonZero(returnTokenPriceUsd(tx.symbol))) }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_stake' && tx.to !== username">
                            <q-item-label class="text-bold">
                              - {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              $ {{ (returnTokenPriceUsd(tx.symbol) * tx.quantity).toFixed(returnDecimalsBeforeNonZero(returnTokenPriceUsd(tx.symbol))) }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_unstake'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_issue' && tx.to === username">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label>
                              <div v-if="tx.memo !== null" class="wrap text-center">
                                <q-icon name="comment" title="" />
                                <code>{{ sanitize(tx.memo).substr(0,10) }}</code>..
                                <q-tooltip content-class="bg-primary">
                                  {{ sanitize(tx.memo) }}
                                </q-tooltip>
                              </div>
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'mining_lottery'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              $ {{ (returnTokenPriceUsd(tx.symbol) * tx.quantity).toFixed(returnDecimalsBeforeNonZero(returnTokenPriceUsd(tx.symbol))) }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'market_placeOrder' && tx.orderType === 'sell'">
                            <q-item-label class="text-bold">
                              - {{ tx.quantityLocked }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              {{ tx.price }} Hive each
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'market_placeOrder' && tx.orderType === 'buy'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantityLocked }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              {{ tx.price }} Hive each
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'market_expire'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantityUnlocked }} {{ tx.symbol }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'market_buy'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantityTokens }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              {{ (tx.quantitySteem / tx.quantityTokens).toFixed(3) }} Hive each
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'market_sell'">
                            <q-item-label class="text-bold">
                              - {{ tx.quantityTokens }} {{ tx.symbol }}
                            </q-item-label>
                            <q-item-label caption>
                              {{ (tx.quantitySteem / tx.quantityTokens).toFixed(3) }} Hive each
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'hivepegged_buy'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'hivepegged_withdraw'">
                            <q-item-label class="text-bold">
                              - {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'witnesses_proposeRound'">
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                      </q-scroll-area>
                    </div>
                    <q-dialog v-model="transferHiveEngine"><transfer-dialog :tokenName="transferDialogTokenName" network="hiveEngine" :balance="transferDialogBalance" :username="username" /></q-dialog>
                    <q-dialog v-model="stakeHiveEngine"><staking-dialog :tokenName="stakingDialogTokenName" network="hiveEngine" :balance="stakingDialogBalance" :username="username" /></q-dialog>
                    <q-dialog v-model="unstakeHiveEngine"><unstaking-dialog :tokenName="unstakingDialogTokenName" network="hiveEngine" :stake="unstakingDialogStake" :transactions="unstakingDialogTransactions" :cooldown="unstakingDialogCooldown" :unstaking="unstakingDialogUnstaking" :username="username" /></q-dialog>
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
const SSC = require('sscjs')
import store from '../store'
var heApiNode = store().state.hive.user.settings.heApiNode || 'https://api.hive-engine.com/rpc'
const hiveEngine = new SSC(heApiNode)
import { debounce, openURL } from 'quasar'
import { keychain } from '@hiveio/keychain'
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
  op.fill_transfer_from_savings,
  op.cancel_transfer_from_savings,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance,
  op.convert,
  op.collateralized_convert,
  op.fill_vesting_withdraw
])
export default {
  name: 'wallet',
  data () {
    return {
      username: this.$route.params.username,
      tab: 'hive',
      transferHive: false,
      transferHbd: false,
      transferHiveEngine: false,
      transferDialogTokenName: '',
      transferDialogNetwork: 'hive',
      transferDialogBalance: null,
      stakeHiveEngine: false,
      stakingDialogTokenName: '',
      stakingDialogBalance: null,
      unstakeHiveEngine: false,
      unstakingDialogTokenName: '',
      unstakingDialogStake: null,
      unstakingDialogTransactions: null,
      unstakingDialogCooldown: null,
      unstakingDialogUnstaking: null,
      stakeHive: false,
      unstakeHive: false,
      savings: false,
      savingsType: 'deposit',
      savingsTokenName: 'HIVE',
      delegationDialogVisible: false,
      convertDialogVisible: false,
      convertTokenName: 'HIVE',
      hiveTransactions: [],
      accountHistoryPointer: -1,
      accountHistoryLimit: 1000,
      bitmask: walletBitmask,
      loading: false,
      hiveEngineBalances: null,
      hiveEngineBalancesFilterSmall: true,
      hiveEngineBalancesFilterUsdAmount: 1,
      hiveEngineMarketInfo: null,
      hiveEngineTokenInfo: null,
      hiveEngineTransactionHistory: null,
      hivePriceUsd: null,
      hivePriceUsdChange: null,
      hbdPriceUsd: null,
      hbdPriceUsdChange: null,
      decodedMemo: null,
      filter: {
        showClaimedRewards: true,
        showDust: true,
        showTransfersIn: true,
        showTransfersOut: true,
        showMarketOrders: true,
        showStaking: true,
        showUnStaking: true,
        showSavings: true,
        search: ''
      }
      // showTxTypes: ['transfer', 'transfer_to_vesting', 'withdraw_vesting', 'fill_vesting_withdraw', 'interest', 'liquidity_reward', 'transfer_to_savings', 'transfer_from_savings', 'fill_transfer_from_savings', 'cancel_transfer_from_savings', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'fill_convert_request', 'fill_order', 'claim_reward_balance']
    }
  },
  components: {
    delegationDialog: () => import('components/delegationDialog.vue'),
    accountHeader: () => import('components/accountHeader.vue'),
    transferDialog: () => import('components/transferDialog.vue'),
    stakingDialog: () => import('components/stakingDialog.vue'),
    unstakingDialog: () => import('components/unstakingDialog.vue'),
    savingsDialog: () => import('components/savingsDialog.vue'),
    convertDialog: () => import('components/convertDialog.vue'),
    convertRequests: () => import('components/convertRequests.vue'),
    claimRewards: () => import('components/claimRewards.vue'),
    delegations: () => import('components/delegations.vue'),
    savingsWithdrawalsInProgress: () => import('components/savingsWithdrawalsInProgress.vue')
  },
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    account: {
      cache: false,
      get () {
        return this.$store.state.hive.accounts[this.username]
      }
    },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    hivePowerAPR: function () { // orig-src https://gitlab.syncad.com/hive/wallet/-/blob/develop/src/app/components/modules/UserWallet.jsx#L105
      if (this.globalProps) {
        // The inflation was set to 9.5% at block 7m
        const initialInflationRate = 9.5
        const initialBlock = 7000000
        // It decreases by 0.01% every 250k blocks
        const decreaseRate = 250000
        const decreasePercentPerIncrement = 0.01
        // How many increments have happened since block 7m?
        const headBlock = this.globalProps.head_block_number
        const deltaBlocks = headBlock - initialBlock
        const decreaseIncrements = deltaBlocks / decreaseRate
        // Current inflation rate
        let currentInflationRate = initialInflationRate - decreaseIncrements * decreasePercentPerIncrement
        // Cannot go lower than 0.95%
        if (currentInflationRate < 0.95) { currentInflationRate = 0.95 }
        // Now lets calculate the "APR"
        const vestingRewardPercent = this.globalProps.vesting_reward_percent / 10000
        const virtualSupply = this.globalProps.virtual_supply.split(' ').shift()
        const totalVestingFunds = this.globalProps.total_vesting_fund_hive.split(' ').shift()
        return ((virtualSupply * currentInflationRate * vestingRewardPercent) / totalVestingFunds).toFixed(2)
      } else { return null }
    },
    filteredTransactionsHive: function () {
      var ft = this.hiveTransactions
      // ft = ft.filter(t => this.showTxTypes.includes(t[1].op[0]))
      if (!this.filter.showClaimedRewards) { ft = ft.filter(t => t[1].op[0] !== 'claim_reward_balance') }
      if (!this.filter.showTransfersIn) { ft = ft.filter(t => t[1].op[0] === 'transfer' && t[1].op[1].to === this.username) }
      if (!this.filter.showTransfersOut) { ft = ft.filter(t => t[1].op[0] === 'transfer' && t[1].op[1].from === this.username) }
      if (!this.filter.showMarketOrders) { ft = ft.filter(t => t[1].op[0] !== 'fill_order') }
      if (!this.filter.showStaking) { ft = ft.filter(t => t[1].op[0] !== 'transfer_to_vesting') }
      if (!this.filter.showUnStaking) { ft = ft.filter(t => ['withdraw_vesting', 'fill_vesting_withdraw'].includes(t[1].op[0]) === false) }
      if (!this.filter.showSavings) { ft = ft.filter(t => ['transfer_to_savings', 'transfer_from_savings', 'fill_transfer_from_savings', 'cancel_transfer_from_savings'].includes(t[1].op[0]) === false) }
      if (this.filter.search !== '') { ft = ft.filter(t => JSON.stringify(t[1].op[1]).indexOf(this.filter.search) !== -1) }
      return ft
    },
    hiveEngineBalancesFiltered: function () {
      if (this.hiveEngineBalances !== null) {
        if (this.hiveEngineBalancesFilterSmall) { return this.hiveEngineBalances.filter(t => (this.returnTokenPriceUsd(t.symbol) * (parseFloat(t.balance) + parseFloat(t.stake)) >= this.hiveEngineBalancesFilterUsdAmount)) } else { return this.hiveEngineBalances }
      } else { return null }
    },
    pendingHbdInterest: function () {
      if (this.globalProps && this.account && this.account.savings_hbd_seconds > 0) {
        var secondsInYear = 60 * 60 * 24 * 365
        var secondsSinceUpdate = moment.utc().diff(moment.utc(this.account.savings_hbd_seconds_last_update), 'seconds')
        console.info(secondsSinceUpdate)
        var pendingSeconds = parseFloat(this.account.savings_hbd_balance.split(' ')[0]) * parseFloat(secondsSinceUpdate)
        var secondsToPayFor = parseFloat(this.account.savings_hbd_seconds) + parseFloat(pendingSeconds)
        var estimatedPayout = (secondsToPayFor / secondsInYear) * (parseFloat(this.globalProps.hbd_interest_rate) / 10000)
        // console.info(estimatedPayout)
        estimatedPayout = (estimatedPayout / 1000).toFixed(3)
        return estimatedPayout
      } else {
        return 0
      }
    },
    pendingHbdClaim: function () {
      if (this.globalProps && this.account && this.account.savings_hbd_seconds > 0 && moment.utc().diff(moment.utc(this.account.savings_hbd_last_interest_payment), 'days') >= 30) {
        return true
      } else {
        return false
      }
    }
    // (returnTokenPriceUsd(token.symbol) * (parseFloat(token.balance) + parseFloat(token.stake)))
  },
  watch: {
    account: function () { this.init() },
    '$route.params.username': {
      handler: function () { this.init() },
      deep: true,
      immediate: true
    },
    username: function () { this.init() }
  },
  methods: {
    async decodeMemo (message, tx) {
      this.decodedMemo = 'Decrypting Memo ...'
      const { success, msg } = await keychain(window, 'requestVerifyKey', this.loggedInUser, message, 'Memo')
      if (success) {
        this.decodedMemo = msg
        var txToReplace = tx
        txToReplace[1].op[1].memo = msg.slice(1)
        this.hiveTransactions[this.hiveTransactions.indexOf(tx)] = txToReplace
      }
    },
    sanitize (x) { return DOMPurify.sanitize(x) },
    openExternal (url) { openURL(url, null, { noopener: true, menubar: true, toolbar: true, noreferrer: true }) },
    getDateString (timestamp) { return moment(timestamp).format('MMM D[,] YYYY') },
    getTimeString (timestamp) { return moment(timestamp).format('h:mm a') },
    getDateStringHiveEngine (timestamp) { return moment.unix(timestamp).format('MMM D[,] YYYY') },
    getTimeStringHiveEngine (timestamp) { return moment.unix(timestamp).format('h:mm a') },
    getAccountLink (account) { return '/@' + account },
    getTxLink (txid) { return '/tx/' + txid },
    getVirtualTxLink (tx) { return '/b/' + tx[1].block + '#' + tx[1].virtual_op },
    getTokenLink (token) { return '/@' + this.username + '/wallet/' + token },
    getAccount (username) { if (this.$store.state.hive.accounts[username] === undefined) { this.$store.dispatch('hive/getAccount', username) } },
    getGlobalProps () { if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') } },
    getPricesCoingecko () {
      this.$axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd&include_24hr_change=true')
        .then((response) => { this.hivePriceUsd = response.data.hive.usd; this.hivePriceUsdChange = response.data.hive.usd_24h_change; this.hbdPriceUsd = response.data.hive_dollar.usd; this.hbdPriceUsdChange = response.data.hive_dollar.usd_24h_change })
    },
    vestToHive (vests) { if (!this.globalProps.empty) { return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3) } else { return null } },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    tidyNumber (x) { if (x !== null && x !== undefined) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } },
    async getHiveWalletTransactions (index, done) {
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
          if (res.length === 0) { this.$refs.infiniteScroll.stop() }
          this.loading = false
          done()
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
    getHiveEngineBalances (username) {
      hiveEngine.find('tokens', 'balances', { account: username }, 1000, 0, [])
        .then((response) => {
          this.hiveEngineBalances = response
          var preferredTokens = ['SWAP.HIVE', 'PAL', 'PALMM', 'LEO', 'LEOMM', 'CCC', 'STEM'].reverse()
          preferredTokens.forEach(function (t, index) {
            var currentIndex = this.hiveEngineBalances.findIndex(token => token.symbol === t)
            this.hiveEngineBalances.splice(this.hiveEngineBalances.length - 1, 1, ...this.hiveEngineBalances.splice(currentIndex, 1))
          }.bind(this))
          this.hiveEngineBalances.reverse()
          this.getHiveEngineMarketInfo()
          this.getHiveEngineTokenInfo()
        })
        .catch(() => { console.error('Error connecting to Hive-Engine api') })
    },
    getHiveEngineTokenInfo (username) {
      var tokens = this.returnTokenArray()
      if (tokens.length > 0) {
        hiveEngine.find('tokens', 'tokens', { symbol: { $in: tokens } }, 1000, 0, [])
          .then((response) => { this.hiveEngineTokenInfo = response })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
      }
    },
    getHiveEngineMarketInfo () {
      var tokens = this.returnTokenArray()
      if (tokens.length > 0) {
        hiveEngine.find('market', 'metrics', { symbol: { $in: tokens } }, 1000, 0, [])
          .then((response) => { this.hiveEngineMarketInfo = response })
          .catch(() => { console.error('Error connecting to Hive-Engine api') })
      }
    },
    getHiveEngineTransactionHistory () {
      this.$axios.get('https://history.hive-engine.com/accountHistory?account=' + this.username + '&limit=250&offset=0&type=user')
        .then((response) => { this.hiveEngineTransactionHistory = response.data })
        .catch(err => { console.error(err) })
    },
    returnTokenArray () {
      var tokens = []
      if (this.hiveEngineBalances) {
        this.hiveEngineBalances.forEach(function (token, index) { tokens.push(token.symbol) })
        return tokens
      } else {
        return null
      }
    },
    returnTokenPriceHive (symbol) {
      if (this.hiveEngineMarketInfo !== null) {
        if (symbol === 'SWAP.HIVE') {
          return 1.000
        } else {
          var t = this.hiveEngineMarketInfo.find(obj => obj.symbol === symbol)
          if (t) { return t.lastPrice } else { return null }
        }
      } else {
        return null
      }
    },
    returnTokenPriceChange (symbol) {
      if (this.hiveEngineMarketInfo !== null) {
        if (symbol === 'SWAP.HIVE') {
          return 0
        } else {
          var t = this.hiveEngineMarketInfo.find(obj => obj.symbol === symbol)
          if (t) { return parseFloat(t.priceChangePercent) } else { return null }
        }
      } else {
        return null
      }
    },
    returnTokenPriceUsd (symbol) { if (this.hivePriceUsd) { return (this.returnTokenPriceHive(symbol) * this.hivePriceUsd) } else { return null } },
    returnTokenInfo (symbol) {
      if (this.getHiveEngineTokenInfo !== null) {
        var t = this.hiveEngineTokenInfo.find(obj => obj.symbol === symbol)
        if (t) { return t } else { return null }
      } else {
        return ''
      }
    },
    returnTokenInfoMeta (symbol) { return JSON.parse(this.returnTokenInfo(symbol).metadata) },
    returnMarketLink (market, symbol) {
      if (market === 'hiveengine') {
        return 'https://hive-engine.com/?p=market&t=' + symbol
      } else {
        return 'https://tribaldex.com/trade/' + symbol
      }
    },
    claimHbdInterest () {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['transfer_to_savings', { to: this.username, from: this.username, amount: '0.001 HBD', memo: 'Claiming hbd interest' }]])
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    init () {
      if (this.globalProps.empty) { this.getGlobalProps() }
      this.username = this.$route.params.username
      document.title = this.username + '\'s wallet'
      if (this.account === undefined) { this.getAccount(this.username) }
      // this.getHiveWalletTransactions()
      this.getPricesCoingecko()
      this.initHiveEngine()
    },
    initHiveEngine () {
      this.getHiveEngineBalances(this.username)
      this.getHiveEngineTransactionHistory()
    },
    returnDecimalsBeforeNonZero (x) {
      var y = 0
      if (x >= 1) {
        return 2
      } else { // https://stackoverflow.com/questions/23887400/how-to-get-first-2-non-zero-digits-after-decimal-in-javascript
        y = x.toFixed(1 - Math.floor(Math.log(x) / Math.log(10)))
        y = y.toString().length - 1
        if (y > 2) {
          return y
        } else {
          return 2
        }
      }
    }
  },
  mounted () {
    this.init()
  },
  created () {
    // this.getHiveEngineBalances = debounce(this.getHiveEngineBalances, 500)
  }
}
</script>
