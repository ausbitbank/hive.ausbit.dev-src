<template>
  <q-page class="flex">
      <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && account !== undefined && globalProps !== null">
          <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== null"/>
          <q-card flat bordered class="q-ma-md q-pa-md" style="max-width:1000px; max-width:100%; min-width:600px">
            <div class="text-h6 text-center text-green" style="clear:both"><q-icon name="account_balance" color="green" />&nbsp; Wallet</div>
            <q-tabs v-model="tab" dense class="text-grey shadow-2" active-color="primary" indicator-color="primary" align="justify" narrow-indicator inline-label>
                <q-tab name="hive"><q-icon name="img:statics/hive.svg" size="sm" />&nbsp;Hive</q-tab>
                <q-tab name="hive-engine"><q-icon name="img:statics/hive-engine.png" size="sm" />&nbsp;Hive-Engine</q-tab>
            </q-tabs>
            <q-tab-panels v-model="tab" animated class="shadow-2 rounded-borders">
                <q-tab-panel name="hive">
                    <q-list bordered separator class="rounded-borders">
                        <q-item>
                            <q-item-section avatar>
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
                            <q-item-section>
                              <q-item-label>
                                {{ tidyNumber(account.savings_balance.split(' ')[0]) }}
                              </q-item-label>
                              <q-item-label caption>
                                Savings
                              </q-item-label>
                            </q-item-section>
                            <q-item-section>
                              <q-item-label>
                                {{ tidyNumber(((parseFloat(account.balance.split(' ')[0]) + parseFloat(vestToHive(parseFloat(account.vesting_shares.split(' ')[0]))) + parseFloat(account.savings_balance.split(' ')[0])) * hivePriceUsd).toFixed(2)) }}
                              </q-item-label>
                              <q-item-label caption>
                                Value (USD)
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side v-if="loggedInUser === username">
                                <q-btn dense flat icon="send" color="primary" title="Transfer" @click="transferHive = true" />
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
                                      <q-item clickable class="text-green" title="Convert Hive to HBD" @click="convertDialogVisible = true; convertTokenName = 'HIVE'" v-if="false & account.balance.split(' ')[0] !== '0.000'">
                                        <q-item-section avatar><q-avatar size="sm"><img src="/statics/hbd.svg"/></q-avatar></q-item-section>
                                        <q-item-section>Convert</q-item-section>
                                      </q-item>
                                    </q-list>
                                  </q-menu>
                                </q-btn>
                            </q-item-section>
                        </q-item>
                        <q-item v-if="account.vesting_withdraw_rate !== '0.000000 VESTS'">
                            <q-item-section>
                              <div>Unstaking total: {{ tidyNumber(vestToHive(parseInt(account.to_withdraw / 1000000))) }} Hive</div>
                              <div>Unstaked so far: {{ tidyNumber(vestToHive(parseInt(account.withdrawn / 1000000))) }} Hive</div>
                            </q-item-section>
                            <q-item-section>
                                <div>Next payout: {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }} Hive <span class="text-caption color-grey">{{ timeDelta(account.next_vesting_withdrawal) }}</span></div>
                            </q-item-section>
                            <q-item-section top side v-if="this.loggedInUser === this.username">
                                <q-btn flat icon="cancel" color="red" title="Cancel Powerdown" @click="unstakeHive = true" />
                            </q-item-section>
                        </q-item>
                        <q-item>
                          <q-item-section>
                            <delegations :username="username" />
                            <convertRequests :username="username" />
                          </q-item-section>
                        </q-item>
                        <savingsWithdrawalsInProgress :username="username" />
                        <q-item>
                            <q-item-section avatar>
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
                            <q-item-section>
                              <q-item-label>
                                $ {{ tidyNumber(((parseFloat(account.savings_hbd_balance.split(' ')[0]) + parseFloat(account.hbd_balance.split(' ')[0])) * hbdPriceUsd).toFixed(2))}}
                              </q-item-label>
                              <q-item-label caption>
                                Value (USD)
                              </q-item-label>
                            </q-item-section>
                            <q-item-section top side v-if="loggedInUser === username">
                                <q-btn dense flat icon="send" color="primary" title="Transfer" @click="transferHbd = true" />
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
                                      <q-item clickable class="text-secondary" title="Convert HBD to Hive" @click="convertDialogVisible = true; convertTokenName = 'HBD'" v-if="true || account.hbd_balance.split(' ')[0] !== '0.000'">
                                        <q-item-section avatar><q-avatar size="sm"><img src="/statics/hive.svg"/></q-avatar></q-item-section>
                                        <q-item-section>Convert</q-item-section>
                                      </q-item>
                                    </q-list>
                                  </q-menu>
                                </q-btn>
                            </q-item-section>
                        </q-item>
                        <q-item v-if="account.reward_vesting_balance !== '0.000000 VESTS'||account.reward_hbd_balance !== '0.000 HBD'||account.reward_hive_balance !== '0.000 HIVE'">
                          <q-item-section v-if="account.name === loggedInUser">
                            <claim-rewards :A="account"/>
                          </q-item-section>
                          <q-item-section>
                            <div>Outstanding Rewards:</div>
                            <div v-if="account.reward_vesting_balance !== '0.000000 VESTS'">{{ account.reward_vesting_hive.split(' ')[0] }} Staked Hive</div>
                            <div v-if="account.reward_hbd_balance !== '0.000 HBD'">{{ account.reward_hbd_balance }}</div>
                            <div v-if="account.reward_hive_balance !== '0.000 HIVE'">{{ account.reward_hive_balance }}</div>
                          </q-item-section>
                        </q-item>
                    </q-list>
                    <div id="scrollTargetRef">
                      <div class="text-h6 text-center">Transaction History</div>
                        <q-list bordered v-for="tx in this.filteredTransactionsHive" :key="tx.index">
                          <q-item>
                            <q-item-section avatar>
                              <q-item-label>
                                <q-icon name="add_circle" color="green" v-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="add_circle" color="green-10" v-else-if="(tx[1].op[0] === 'claim_reward_balance')" />
                                <q-icon name="add_circle" color="green-9" v-else-if="(tx[1].op[0] === 'interest')" />
                                <q-icon name="remove_circle" color="red" v-else-if="(tx[1].op[1].from === username && tx[1].op[0] === 'transfer')" />
                                <q-icon name="cached" color="blue" v-else-if="(tx[1].op[0] === 'fill_convert_request')" />
                                <q-icon name="arrow_circle_up" color="green-8" v-else-if="(tx[1].op[1].to === username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_up" color="red-8" v-else-if="(tx[1].op[1].to !== username && tx[1].op[0] === 'transfer_to_vesting')" />
                                <q-icon name="arrow_circle_down" color="blue-8" v-else-if="(tx[1].op[0] === 'withdraw_vesting')" />
                                <q-icon name="arrow_circle_up" color="orange-6" v-else-if="(tx[1].op[0] === 'transfer_to_savings')" />
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
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting' && tx[1].op[1].vesting_shares === '0.000000 VESTS'">Cancelled Unstake</span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'">Unstaked</span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'">Fill Order</span>
                                <span v-else-if="tx[1].op[0] === 'interest'">Interest</span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_savings'">Transfer to Savings</span>
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
                                <span v-else-if="tx[1].op[0] === 'transfer_to_savings'"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'transfer_to_vesting'"> <router-link :to="getAccountLink(tx[1].op[1].to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].to)" /></q-avatar> {{ tx[1].op[1].to }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'withdraw_vesting'"> <router-link :to="getAccountLink(tx[1].op[1].account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].account)" /></q-avatar> {{ tx[1].op[1].account }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'fill_order'"> <router-link :to="getAccountLink(tx[1].op[1].open_owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].open_owner)" /></q-avatar> {{ tx[1].op[1].open_owner }}</router-link></span>
                                <span v-else-if="tx[1].op[0] === 'interest'"> <router-link :to="getAccountLink(tx[1].op[1].owner)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx[1].op[1].owner)" /></q-avatar> {{ tx[1].op[1].owner }}</router-link></span>
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
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner === username">
                              <q-item-label class="text-bold">
                                - {{ tidyNumber(tx[1].op[1].open_pays) }}
                              </q-item-label>
                              <q-item-label class="text-bold">
                                + {{ tidyNumber(tx[1].op[1].current_pays) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'fill_order' && tx[1].op[1].open_owner !== username">
                              <q-item-label class="text-bold">
                                - {{ tidyNumber(tx[1].op[1].current_pays) }}
                              </q-item-label>
                              <q-item-label class="text-bold">
                                + {{ tidyNumber(tx[1].op[1].open_pays) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'transfer' && tx[1].op[1].to === username">
                              <q-item-label class="text-bold text-green">
                                + {{ tidyNumber(tx[1].op[1].amount) }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HIVE'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hivePriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HBD'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hbdPriceUsd).toFixed(2)) }})
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
                          <div v-if="!['transfer', 'claim_reward_balance', 'fill_convert_request', 'transfer_to_vesting', 'withdraw_vesting', 'fill_order', 'interest', 'transfer_to_savings'].includes(tx[1].op[0])">{{ tx[1].op[0] }} {{ tx[1].op[1] }}</div>
                        </q-list>
                      <div class="text-center text-h6 q-pa-sm">
                        <q-spinner-puff size="2em" color="primary" v-if="loading" />
                        <q-btn @click="getHiveWalletTransactions()" class="cursor-pointer text-bold" icon="update" color="primary" dense flat bordered v-if="!loading"> Load More Transactions</q-btn>
                      </div>
                    </div>
                </q-tab-panel>
                <q-tab-panel name="hive-engine" v-if="hiveEngineBalances !== null && hiveEngineTokenInfo !== null">
                    <q-list bordered separator class="rounded-borders">
                        <q-item v-for="token in hiveEngineBalances" :key="token.index">
                          <q-item-section dense avatar>
                            <q-avatar size="md">
                              <img :src="returnTokenInfoMeta(token.symbol).icon" :title="returnTokenInfoMeta(token.symbol).desc"/>
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label v-if="hiveEngineTokenInfo">
                              <q-btn dense flat :label="token.symbol" title="Click for more info about this token">
                                <q-popup-proxy>
                                  <q-card dense flat bordered>
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
                          <q-item-section>
                            <q-item-label>{{ tidyNumber(token.balance) }}</q-item-label>
                            <q-item-label caption>Liquid</q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>{{ tidyNumber(token.stake) }}</q-item-label>
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
                          <q-item-section v-if="hiveEngineMarketInfo">
                            <q-item-label>
                              ${{ tidyNumber((returnTokenPriceUsd(token.symbol) * (parseFloat(token.balance) + parseFloat(token.stake))).toFixed(2)) }}
                            </q-item-label>
                            <q-item-label caption>Value (USD)</q-item-label>
                          </q-item-section>
                          <q-item-section side v-if="loggedInUser === username">
                          <q-btn v-if="token.balance !== '0'" dense flat icon="send" color="primary" title="Transfer Token" @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance);  transferHiveEngine = true" />
                              <q-btn dense flat icon="more_horiz">
                                <q-menu>
                                  <q-list style="min-width: 100px">
                                    <q-item clickable @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance);  transferHiveEngine = true" v-if="token.balance !== '0'">
                                      <q-item-section>
                                        <q-btn dense flat icon="send" color="primary" title="Transfer Token" label="Transfer Token" @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance);  transferHiveEngine = true" />
                                      </q-item-section>
                                    </q-item>
                                    <q-item>
                                      <q-btn type="a" dense flat icon="transform" color="orange" :href="returnMarketLink(token.symbol)" target="_blank" title="Trade on HiveEngine" label="Trade on Hive-Engine" />
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
                      <q-list bordered v-for="tx in this.hiveEngineTransactionHistory" :key="tx.index">
                        <q-item>
                          <q-item-section avatar>
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
                            </q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label>
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
                              <span v-if="tx.from === username && tx.operation === 'tokens_transfer'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.from !== username && tx.operation === 'tokens_transfer'"> <router-link :to="getAccountLink(tx.from)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.from)" /></q-avatar> {{ tx.from }}</router-link></span>
                              <span v-else-if="tx.operation === 'tokens_stake'"> <router-link :to="getAccountLink(tx.to)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.to)" /></q-avatar> {{ tx.to }}</router-link></span>
                              <span v-else-if="tx.operation === 'tokens_unstake'"> <router-link :to="getAccountLink(tx.account)"><q-avatar size="sm"><q-img :src="getHiveAvatarUrl(tx.account)" /></q-avatar> {{ tx.account }}</router-link></span>
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
                            <q-item-label class="text-bold">
                              + {{ tx.quantity }} {{ tx.symbol }}
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
                          <q-item-section side top v-if="tx.operation === 'tokens_transfer' && tx.to !== username">
                            <q-item-label class="text-bold">
                              - {{ tx.quantity }} {{ tx.symbol }}
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
                          </q-item-section>
                          <q-item-section side top v-if="tx.operation === 'tokens_stake' && tx.to !== username">
                            <q-item-label class="text-bold">
                              - {{ tx.quantity }} {{ tx.symbol }}
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
                        </q-item>
                      </q-list>
                    </div>
                    <q-dialog v-model="transferHiveEngine"><transfer-dialog :tokenName="transferDialogTokenName" network="hiveEngine" :balance="transferDialogBalance" :username="username" /></q-dialog>
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
const hiveEngine = new SSC('https://api.hive-engine.com/rpc')
import { debounce } from 'quasar'
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
  op.escrow_transfer,
  op.cancel_transfer_from_savings,
  op.escrow_approve,
  op.escrow_dispute,
  op.escrow_release,
  op.fill_convert_request,
  op.fill_order,
  op.claim_reward_balance
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
      hiveEngineMarketInfo: null,
      hiveEngineTokenInfo: null,
      hiveEngineTransactionHistory: null,
      hivePriceUsd: null,
      hbdPriceUsd: null,
      decodedMemo: null,
      showTxTypes: ['transfer', 'transfer_to_vesting', 'withdraw_vesting', 'interest', 'liquidity_reward', 'transfer_to_savings', 'escrow_transfer', 'escrow_dispute', 'escrow_release', 'fill_convert_request', 'fill_order', 'claim_reward_balance']
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
    },
    filteredTransactionsHive: function () {
      var ft = this.hiveTransactions
      console.log(this.hiveTransactions[0])
      ft = ft.filter(t => this.showTxTypes.includes(t[1].op[0]))
      return ft
    }
  },
  watch: {
    account: function () { this.init() },
    $router: function () { this.init() },
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
    getDateString (timestamp) { return moment(timestamp).format('MMM D[,] YYYY') },
    getTimeString (timestamp) { return moment(timestamp).format('h:mm a') },
    getDateStringHiveEngine (timestamp) { return moment.unix(timestamp).format('MMM D[,] YYYY') },
    getTimeStringHiveEngine (timestamp) { return moment.unix(timestamp).format('h:mm a') },
    getAccountLink (account) { return '/@' + account },
    getTxLink (txid) { return '/tx/' + txid },
    getVirtualTxLink (tx) { return '/b/' + tx[1].block + '#' + tx[1].virtual_op },
    getAccount (username) { if (this.$store.state.hive.accounts[username] === undefined) { this.$store.dispatch('hive/getAccount', username) } },
    getGlobalProps () { if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') } },
    getPricesCoingecko () {
      this.$axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd&include_24hr_change=false')
        .then((response) => { this.hivePriceUsd = response.data.hive.usd; this.hbdPriceUsd = response.data.hive_dollar.usd })
    },
    vestToHive (vests) { if (!this.globalProps.empty) { return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3) } else { return null } },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
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
      this.$axios.get('https://accounts.hive-engine.com/accountHistory?account=' + this.username + '&limit=250&offset=0&type=user')
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
    returnTokenPriceUsd (symbol) { if (this.hivePriceUsd) { return (this.returnTokenPriceHive(symbol) * this.hivePriceUsd) } else { return null } },
    returnTokenInfo (symbol) {
      if (this.getHiveEngineTokenInfo !== null) {
        var t = this.hiveEngineTokenInfo.find(obj => obj.symbol === symbol)
        if (t) { return t } else { return null }
      }
    },
    returnTokenInfoMeta (symbol) { return JSON.parse(this.returnTokenInfo(symbol).metadata) },
    returnMarketLink (symbol) { return 'https://hive-engine.com/?p=market&t=' + symbol },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    init () {
      if (this.globalProps.empty) { this.getGlobalProps() }
      this.username = this.$route.params.username
      console.log('loading wallet info for ' + this.username)
      document.title = this.username + '\'s wallet'
      if (this.account === undefined) { this.getAccount(this.username) }
      this.getHiveWalletTransactions()
      this.getHiveEngineBalances(this.username)
      this.getPricesCoingecko()
      this.getHiveEngineTransactionHistory()
    }
  },
  mounted () {
    this.init()
  }
}
</script>
