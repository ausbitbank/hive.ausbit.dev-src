<template>
  <q-page class="flex">
      <div class="fit row wrap justify-center items-start content-start" v-if="account !== null && account !== undefined && globalProps !== null">
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
                            <q-item-section avatar>
                              <q-avatar size="sm">
                                <img src="/statics/hextacular.svg"/>
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
                                Staked
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
                                $ {{ tidyNumber(((parseFloat(account.savings_balance.split(' ')[0]) + parseFloat(account.balance.split(' ')[0])) + vestToHive(parseInt(account.vesting_shares.split(' ')[0])) * hivePriceUsd).toFixed(2)) }}
                              </q-item-label>
                              <q-item-label caption>
                                Value (USD)
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side>
                                <q-btn dense icon="send" color="primary" title="Transfer" @click="transferHive = true" />
                                <q-dialog v-model="transferHive"><transfer-dialog tokenName="HIVE" network="hive" :balance="parseFloat(account.balance.split(' ')[0])" :username="username" /></q-dialog>
                                <q-btn v-if="false" dense icon="arrow_upward" color="primary" title="Power Up" />
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section avatar>
                              <q-avatar size="sm">
                                <img src="/statics/hextacular.svg"/>
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
                                Savings
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
                            <q-item-section top side>
                                <q-btn dense icon="send" color="primary" title="Transfer" @click="transferHbd = true" />
                                <q-dialog v-model="transferHbd"><transfer-dialog tokenName="HBD" network="hive" :balance="parseFloat(account.hbd_balance.split(' ')[0])" :username="username" /></q-dialog>
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
                            <q-item-section top side>
                                <q-btn v-if="false" dense icon="cancel" color="red" title="Cancel Powerdown" />
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
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HIVE'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hivePriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HBD'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hbdPriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label v-if="tx[1].op[1].memo !== ''">
                                <div class="wrap text-center">
                                  <q-icon name="comment" title="" />
                                  <code>{{ sanitize(tx[1].op[1].memo).substr(0,30) }}</code>..
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
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HIVE'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hivePriceUsd).toFixed(2)) }})
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].amount.split(' ')[1] === 'HBD'">
                                (${{ tidyNumber((tx[1].op[1].amount.split(' ')[0] * hbdPriceUsd).toFixed(2)) }})
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
                                {{ vestToHive(tx[1].op[1].vesting_shares) }} HIVE
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side top v-if="tx[1].op[0] === 'claim_reward_balance'">
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">
                                + {{ tx[1].op[1].reward_hive }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_hive !== '0.000 HIVE'">
                                + ${{ parseFloat(tx[1].op[1].reward_hive.split(' ')[0]) * hivePriceUsd }}
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_hbd !== '0.000 HBD'">
                                + {{ tx[1].op[1].reward_hbd }}
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_hbd !== '0.000 HBD'">
                                (${{ (parseFloat(tx[1].op[1].reward_hbd.split(' ')[0]) * hbdPriceUsd).toFixed(2) }})
                              </q-item-label>
                              <q-item-label class="text-bold" v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS'">
                                + {{ vestToHive(tx[1].op[1].reward_vests) }} HP
                              </q-item-label>
                              <q-item-label caption v-if="tx[1].op[1].reward_vests !== '0.000000 VESTS'">
                                (${{ (parseFloat(vestToHive(tx[1].op[1].reward_vests.split(' ')[0])) * hivePriceUsd).toFixed(2) }})
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
                <q-tab-panel name="hive-engine" v-if="hiveEngineBalances !== null && hiveEngineTokenInfo !== null">
                    <q-list bordered separator class="rounded-borders">
                        <q-item v-for="token in hiveEngineBalances" :key="token.index">
                          <q-item-section dense avatar>
                            <q-avatar size="sm">
                              <img :src="returnTokenInfoMeta(token.symbol).icon" :title="returnTokenInfoMeta(token.symbol).desc"/>
                            </q-avatar>
                          </q-item-section>
                          <q-item-section>
                            <q-item-label v-if="hiveEngineTokenInfo">
                              {{ token.symbol }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section>
                            <q-btn flat icon="info" color="cyan" size="sm">
                              <q-popup-proxy>
                              <q-card dense flat bordered>
                                <q-card-section class="text-caption">
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
                            <q-item-label>
                              <q-btn v-if="token.balance !== '0'" dense icon="send" color="blue" @click="transferDialogTokenName = token.symbol; transferDialogBalance = parseFloat(token.balance);  transferHiveEngine = true" title="Transfer token" />
                              <q-btn type="a" dense icon="transform" color="orange" :href="returnMarketLink(token.symbol)" target="_blank" title="Trade on HiveEngine Market" />
                            </q-item-label>
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
import accountHeader from 'components/accountHeader.vue'
import transferDialog from 'components/transferDialog.vue'
import claimRewards from 'components/claimRewards.vue'
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
      hbdPriceUsd: null
    }
  },
  components: { accountHeader, transferDialog, claimRewards },
  computed: {
    globalProps: {
      get () {
        return this.$store.state.hive.globalProps
      }
    },
    account: {
      cache: false,
      get () {
        return this.$store.state.hive.accounts[this.username]
      }
    },
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
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
    getDateStringHiveEngine (timestamp) {
      return moment.unix(timestamp).format('MMM D[,] YYYY')
    },
    getTimeStringHiveEngine (timestamp) {
      return moment.unix(timestamp).format('h:mm a')
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
      if (this.$store.state.hive.accounts[username] === undefined) {
        this.$store.dispatch('hive/getAccount', username)
      }
    },
    getGlobalProps () {
      if (this.globalProps.empty) {
        this.$store.dispatch('hive/getGlobalProps')
      }
    },
    getPricesCoingecko () {
      this.$axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd&include_24hr_change=false')
        .then((response) => { this.hivePriceUsd = response.data.hive.usd; this.hbdPriceUsd = response.data.hive_dollar.usd })
    },
    vestToHive (vests) {
      if (!this.globalProps.empty) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    },
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
        .catch(() => {
          console.error('Error connecting to Hive-Engine api')
        })
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
        var t = this.hiveEngineMarketInfo.find(obj => obj.symbol === symbol)
        if (t) { return t.lastPrice } else { return null }
      } else {
        return null
      }
    },
    returnTokenPriceUsd (symbol) {
      if (this.hivePriceUsd) {
        return (this.returnTokenPriceHive(symbol) * this.hivePriceUsd)
      } else {
        return null
      }
    },
    returnTokenInfo (symbol) {
      if (this.getHiveEngineTokenInfo !== null) {
        var t = this.hiveEngineTokenInfo.find(obj => obj.symbol === symbol)
        if (t) { return t } else { return null }
      }
    },
    returnTokenInfoMeta (symbol) {
      return JSON.parse(this.returnTokenInfo(symbol).metadata)
    },
    returnAccountLink (account) {
      return '/@' + account
    },
    returnMarketLink (symbol) {
      return 'https://hive-engine.com/?p=market&t=' + symbol
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
      if (this.account === undefined) {
        this.getAccount(this.username)
      }
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
