<template>
  <q-page class="flex q-pa-md">
      <div class="fit row wrap justify-start items-start content-start" v-if="account !== null && globalProps !== null">
          <div class="col-10 text-h4 q-pa-md">
              <q-avatar size="3em"><q-img :src="getHiveAvatarUrl(username)" /></q-avatar> {{ account.name }}
          </div>
          <div class="col-2">
              <q-card flat bordered class="text-center">
                  <div>{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]))) }} HP</div>
                  <div> {{ account.balance }}</div>
                  <div>{{ account.hbd_balance }}</div>
                  <div v-if="this.accountValue">{{ this.accountValue }}</div>
              </q-card>
          </div>
          <div class="col-4">
              <q-card flat bordered class="text-center q-pa-sm q-ma-md">
                  <q-card-section>
                      <div class="text-subtitle">Vote Weight</div>
                      <div class="text-h6">{{ tidyNumber(vestToHive(parseInt(account.vesting_shares.split(' ')[0]) + parseInt(account.received_vesting_shares.split(' ')[0]) - parseInt(account.delegated_vesting_shares.split(' ')[0]) - parseInt(account.vesting_withdraw_rate.split(' ')[0])))}} HP</div>
                      <div class="text-caption text-grey">
                          {{ vestToHive(parseInt(account.vesting_shares.split(' ')[0])) }} + {{ vestToHive(parseInt(account.received_vesting_shares.split(' ')[0])) }} - {{ vestToHive(parseInt(account.delegated_vesting_shares.split(' ')[0])) }}
                      </div>
                      <div v-if="parseInt(account.vesting_withdraw_rate.split(' ')[0]) !== 0">
                          Next powerdown: {{ tidyNumber(vestToHive(parseInt(account.vesting_withdraw_rate.split(' ')[0]))) }} HIVE
                      </div>
                      <div>
                          Voting Power
                      </div>
                      <div>
                          <q-linear-progress dark stripe rounded size="20px" :value="votePower / 100" color="dark-blue" class="q-mt-sm">
                            <div class="absolute-full flex flex-center">
                                <q-badge color="black" text-color="primary" :label="votePower" />
                            </div>
                          </q-linear-progress>
                      </div>
                      <div v-if="false">
                          Downvote Power
                      </div>
                      <div v-if="false">
                          <q-linear-progress dark stripe rounded size="20px" :value="downvotingPowerPct" color="blue" class="q-mt-sm">
                            <div class="absolute-full flex flex-center">
                                <q-badge color="black" text-color="primary" :label="downvotingPowerPct" />
                            </div>
                          </q-linear-progress>
                      </div>
                      <div>
                          Resource Credits
                      </div>
                      <div>
                          <q-linear-progress dark stripe rounded size="20px" :value="RC.percent / 100" color="green" class="q-mt-sm">
                            <div class="absolute-full flex flex-center">
                                <q-badge color="black" text-color="primary" :label="RC.percent" />
                            </div>
                          </q-linear-progress>
                      </div>
                  </q-card-section>
                  <q-card-section>
                      <div class="row">
                        <div class="col">
                            <div>
                                Reputation
                          </div>
                            <div class="text-h5">
                                {{ getReputation(account.reputation) }}
                            </div>
                            <div class="text-caption text-grey">
                                {{ account.post_count }} posts
                            </div>
                        </div>
                        <div class="col">
                            <div>
                                Created
                            </div>
                            <div class="text-h5">
                                {{ accountAge }}
                            </div>
                            <div class="text-caption text-grey">
                                {{ accountAgeShort }}
                            </div>
                        </div>
                      </div>
                      <div>
                        View in : <a :href="linkHiveWorld(username)">hiveworld</a>, <a :href="linkHiveBlog(username)">hive.blog</a> , <a :href="linkPeakd(username)">peakd</a>
                      </div>
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md">
                  <q-card-section>
                      <div class="text-h6">Resource Credits</div>
                      <q-list bordered separator dense>
                          <q-item bordered>
                              <q-item-section>
                                  max_mana
                              </q-item-section>
                              <q-item-section side>
                                  {{ RC.max }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  current_mana
                              </q-item-section>
                              <q-item-section side>
                                  {{ RC.current }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  current_pct
                              </q-item-section>
                              <q-item-section side>
                                  {{ RC.percent }}
                              </q-item-section>
                          </q-item>
                      </q-list>
                  </q-card-section>
                  <q-card-section>
                      <div>Enough credits for approximately:</div>
                      <div>{{ resourceBudgetComments }} comments</div>
                      <div>{{ resourceBudgetVotes }} votes</div>
                      <div>{{ resourceBudgetTransfers }} transfers</div>
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md">
                  <q-card-section>
                      <q-list bordered separator dense>
                          <q-item>
                              <q-item-section>
                                  Id
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.id }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Name
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.name }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Proxy
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.proxy }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last owner update
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_owner_update}}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last account update
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_account_update }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Created
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.created }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Mined
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.mined }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Recovery Account
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.recovery_account }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last account recovery
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_account_recovery }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reset account
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reset_account }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Post count
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.post_count }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Can vote
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.can_vote }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reward HBD Balance
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reward_hbd_balance }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reward Hive Balance
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reward_hive_balance }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reward Vesting Balance
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reward_vesting_balance }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reward Vesting Hive
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reward_vesting_hive }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Vesting Shares
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.vesting_shares }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Delegated Vesting Shares
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.delegated_vesting_shares }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Received Vesting Shares
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.received_vesting_shares }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Vesting Withdraw Rate
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.vesting_withdraw_rate }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Withdrawn
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.withdrawn }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  To Withdraw
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.to_withdraw }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Withdraw Routes
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.withdraw_routes }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Pending Transfers
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.pending_transfers }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Curation Rewards
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.curation_rewards }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Posting Rewards
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.posting_rewards }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Proxied vsf votes
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.proxied_vsf_votes }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Witnesses voted for
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.witnesses_voted_for }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last post
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_post }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last root post
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_root_post }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Last vote time
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.last_vote_time }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Pending claimed accounts
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.pending_claimed_accounts }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Delayed votes
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.delayed_votes }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section>
                                  Reputation
                              </q-item-section>
                              <q-item-section side>
                                  {{ account.reputation }}
                              </q-item-section>
                          </q-item>
                      </q-list>
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md" v-if="account.json_metadata">
                  <q-card-section>
                      <div class="text-h6">JSON Metadata</div>
                      <vue-json-pretty :data="JSON.parse(account.json_metadata)" :customValueFormatter="customLinkFormatter" />
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md" v-if="account.post_json_metadata">
                  <q-card-section>
                      <div class="text-h6">Posting JSON Metadata</div>
                      <vue-json-pretty :data="JSON.parse(account.posting_json_metadata)" :customValueFormatter="customLinkFormatter" />
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md">
                  <q-card-section>
                    <div class="text-h5 text-center">Authorities</div>
                  </q-card-section>
                  <q-card-section v-if="witness">
                      <div class="text-h6">Signing</div>
                      <q-list bordered seperator dense>
                          <q-item>
                              <q-item-section avatar>
                                <q-icon name="lock" />
                              </q-item-section>
                              <q-item-section class="wrap">
                                  {{ witness.signing_key }}
                              </q-item-section>
                            <q-item-section side>
                                1
                            </q-item-section>
                          </q-item>
                      </q-list>
                  </q-card-section>
                  <q-card-section>
                      <div class="text-h6">Owner</div>
                      <q-list bordered seperator dense>
                        <q-item v-for="auth in account.owner.key_auths" :key="auth.index">
                            <q-item-section avatar>
                                <q-icon name="lock" />
                            </q-item-section>
                            <q-item-section class="wrap">
                                {{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                        <q-item v-for="auth in account.owner.account_auths" :key="auth.index">
                            <q-item-section>
                               <q-icon name="person" />{{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                      </q-list>
                  </q-card-section>
                  <q-card-section>
                      <div class="text-h6">Active</div>
                      <q-list bordered seperator dense class="wrap">
                        <q-item v-for="auth in account.active.key_auths" :key="auth.index">
                            <q-item-section avatar>
                                <q-icon name="lock" />
                            </q-item-section>
                            <q-item-section class="wrap">
                                {{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                        <q-item v-for="auth in account.active.account_auths" :key="auth.index">
                            <q-item-section avatar>
                               <q-icon name="person" />
                            </q-item-section>
                            <q-item-section>
                                {{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                      </q-list>
                  </q-card-section>
                  <q-card-section>
                      <div class="text-h6">Posting</div>
                      <q-list bordered seperator dense>
                        <q-item v-for="auth in account.posting.key_auths" :key="auth.index">
                            <q-item-section avatar>
                                <q-icon name="lock" />
                            </q-item-section>
                            <q-item-section class="wrap">
                                {{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                        <q-item v-for="auth in account.posting.account_auths" :key="auth.index">
                            <q-item-section avatar>
                               <q-icon name="person" />
                            </q-item-section>
                            <q-item-section>
                                {{ auth[0] }}
                            </q-item-section>
                            <q-item-section side>
                                {{ auth[1] }}
                            </q-item-section>
                        </q-item>
                      </q-list>
                  </q-card-section>
                  <q-card-section>
                      <div class="text-h6">Memo</div>
                      <q-list bordered seperator dense>
                        <q-item>
                            <q-item-section avatar>
                                <q-icon name="lock" />
                            </q-item-section>
                            <q-item-section class="wrap">
                                {{ account.memo_key }}
                            </q-item-section>
                            <q-item-section side>
                                1
                            </q-item-section>
                        </q-item>
                      </q-list>
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md" v-if="witness">
                  <q-card-section>
                      <div class="text-h6">
                          Witness
                      </div>
                      <q-list bordered separator dense v-for="prop in Object.entries(witness)" :key="prop.index">
                          <q-item>
                              <q-item-section class="text-bold">
                                  {{ prop[0] }}
                              </q-item-section>
                          </q-item>
                          <q-item>
                              <q-item-section class="wrap">
                                  {{ prop[1] }}
                              </q-item-section>
                          </q-item>
                      </q-list>
                  </q-card-section>
              </q-card>
              <q-card flat bordered class="q-pa-sm q-ma-md">
                  <q-card-section>
                    <div class="text-h6">@{{ username }} votes for :</div>
                      <ol>
                        <li v-for="witness in account.witness_votes" :key="witness.index"><router-link :to="accountLink(witness)">{{ witness }}</router-link></li>
                      </ol>
                  </q-card-section>
              </q-card>
          </div>
          <div class="col-8 q-pa-md">
            <q-spinner-grid size="2em" color="primary" v-if="accountOperations === []" />
            <q-card flat bordered dense class="q-ma-sm" v-for="op in accountOperations" :key="op.index">
                <q-card-section v-if="accountOperations.length > 0">
                    <q-list dense>
                        <q-item>
                            <q-item-section avatar>
                                <q-avatar v-if="op[1].op[1].producer"><q-img :src="getHiveAvatarUrl(op[1].op[1].producer)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].creator"><q-img :src="getHiveAvatarUrl(op[1].op[1].creator)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].curator"><q-img :src="getHiveAvatarUrl(op[1].op[1].curator)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].benefactor"><q-img :src="getHiveAvatarUrl(op[1].op[1].benefactor)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].delegator"><q-img :src="getHiveAvatarUrl(op[1].op[1].delegator)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].account"><q-img :src="getHiveAvatarUrl(op[1].op[1].account)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].voter"><q-img :src="getHiveAvatarUrl(op[1].op[1].voter)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].from_account"><q-img :src="getHiveAvatarUrl(op[1].op[1].from_account)" /></q-avatar>
                                <q-avatar v-if="['vote', 'account_witness_vote'].includes(op[1].op[0])"><q-icon name="how_to_vote" /></q-avatar>
                                <q-avatar v-if="['curation_reward', 'comment_benefactor_reward', 'producer_reward', 'claim_reward_balance', 'comment_reward', 'author_reward', 'fill_vesting_withdraw'].includes(op[1].op[0])"><q-icon name="monetization_on" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].comment_author"><q-img :src="getHiveAvatarUrl(op[1].op[1].comment_author)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].author"><q-img :src="getHiveAvatarUrl(op[1].op[1].author)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].from"><q-img :src="getHiveAvatarUrl(op[1].op[1].from)" /></q-avatar>
                                <q-avatar v-if="op[1].op[0] == 'comment'"><q-icon name="comment" /></q-avatar>
                                <q-avatar v-if="op[1].op[0] == 'delegate_vesting_shares'"><q-icon name="add_circle" /></q-avatar>
                                <q-avatar v-if="op[1].op[0] == 'transfer'"><q-icon name="send" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].to"><q-img :src="getHiveAvatarUrl(op[1].op[1].to)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].parent_author"><q-img :src="getHiveAvatarUrl(op[1].op[1].parent_author)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].delegatee"><q-img :src="getHiveAvatarUrl(op[1].op[1].delegatee)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].to_account"><q-img :src="getHiveAvatarUrl(op[1].op[1].to_account)" /></q-avatar>
                                <q-avatar v-if="op[1].op[1].witness"><q-img :src="getHiveAvatarUrl(op[1].op[1].witness)" /></q-avatar>
                                <q-avatar v-if="op[1].op[0] == 'custom_json'"><q-icon name="notes" /></q-avatar>
                            </q-item-section>
                            <q-item-section class="wrap">
                                <div class="text-bold">{{ op[1].op[0] }}</div>
                                <vue-json-pretty :data="op[1].op[1]" :customValueFormatter="customLinkFormatter" />
                            </q-item-section>
                            <q-item-section side>
                                <span>
                                    <div v-if="op[1].trx_id === '0000000000000000000000000000000000000000'">vtx {{ op[1].virtual_op }}</div>
                                    <div v-else>tx {{ op[1].trx_id.substr(0,8) }}</div>
                                    <div v-if="op[1].trx_id === '0000000000000000000000000000000000000000'">block <router-link :to="returnBlockLink(op[1].block,op[1].virtual_op)">{{ op[1].block }}</router-link></div>
                                    <div v-else>block <router-link :to="returnBlockLink(op[1].block, op[1].trx_id)">{{ op[1].block }}</router-link></div>
                                    <div>{{ timeDelta(op[1].timestamp) }}</div>
                                </span>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-card-section>
            </q-card>
            <q-card class="text-center">
                <q-card-section>
                    <q-btn icon="keyboard_backspace" color="primary" dense push @click="page = 1; accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); page = getAccountHistory(username)" v-if="page > 2"/>
                    <q-btn icon="keyboard_arrow_left" color="primary" dense push @click="page = (parseInt(page) - 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); page = getAccountHistory(username)" v-if="page > 1"/>
                    Page {{ this.page }}
                    <q-btn icon="keyboard_arrow_right" color="primary" dense push @click="page = (parseInt(page) + 1); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); getAccountHistory(username)" v-if="page !== (accountOperationsMarker / accountOperationsLimit).toFixed(0)"/>
                    <q-btn icon="keyboard_tab" color="primary" dense push @click="page = ((accountOperationsMarker / accountOperationsLimit) - 1).toFixed(0); accountOperations = []; $router.push({ path: ('@' + username), query: { page: page }}); getAccountHistory(username)" v-if="page !== (accountOperationsMarker / accountOperationsLimit).toFixed(0)" />
                </q-card-section>
            </q-card>
          </div>
      </div>
  </q-page>
</template>
<style>
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
.wrap { overflow:auto; overflow-wrap: break-word; }
</style>
<script>
import hive from '@hiveio/hive-js'
import moment from 'moment'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import { debounce } from 'quasar'
import DOMPurify from 'dompurify'
export default {
  name: 'accountPage',
  components: {
    VueJsonPretty
  },
  data () {
    return {
      account: null,
      username: this.$route.params.username,
      globalProps: null,
      accountValue: null,
      votingPowerPct: 0.5,
      downvotingPowerPct: 0.5,
      resourceCreditsPct: 0.5,
      RC: { max: null, current: null, percent: null },
      witness: null,
      accountOperations: [],
      accountOperationsLimit: 200,
      accountOperationsMarker: null,
      page: this.$router.currentRoute.query.page || 1
    }
  },
  watch: {
    username: function () {
      debounce(function () { this.accountOperationsMarker = null; this.init() }, 200)
    },
    $route: function () {
      this.init()
    }
  },
  computed: {
    accountAge: function () {
      return moment(this.account.created).fromNow()
    },
    accountAgeShort: function () {
      return moment(this.account.created).format('MMMM YYYY')
    },
    votePower: function () {
      var secondsago = (new Date() - new Date(this.account.last_vote_time + 'Z')) / 1000
      var vpow = this.account.voting_power + (10000 * secondsago / 432000)
      return Math.min(vpow / 100, 100).toFixed(2)
    },
    resourceBudgetComments: function () {
      if (this.RC.current) {
        var cost = (0.866099987 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetVotes: function () {
      if (this.RC.current) {
        var cost = (0.098893838 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    },
    resourceBudgetTransfers: function () {
      if (this.RC.current) {
        var cost = (0.476452196 * 1000000000)
        var available = (this.RC.current / cost)
        if (available >= 100) {
          return '100+'
        } else {
          return available.toFixed(0)
        }
      } else {
        return null
      }
    }
  },
  methods: {
    async getAccountHistory (username) {
    },
    async getAccountHistoryMarker (username) {
      hive.api.getAccountHistoryAsync(username, -1, 1)
        .then((response) => {
          this.accountOperationsMarker = response[0][0]
          var limit = this.accountOperationsLimit
          var page = this.$router.currentRoute.query.page || 1
          var pageReq = this.accountOperationsMarker - (limit * page)
          pageReq = pageReq + limit
          if (page === null || page === 1) { pageReq = -1 }
          hive.api.getAccountHistoryAsync(this.username, pageReq, this.accountOperationsLimit).then((response) => { this.accountOperations = response.reverse() })
        })
    },
    accountLink (username) {
      return '/@' + username
    },
    linkHiveBlog (username) {
      return 'https://hive.blog/@' + username
    },
    linkPeakd (username) {
      return 'https://peakd.com/@' + username
    },
    linkHiveWorld (username) {
      return '/hiveworld/@' + username
    },
    getReputation (rep) {
      return hive.formatter.reputation(rep)
    },
    getAccount (username) {
      hive.api.getAccountsAsync([username])
        .then((response) => {
          this.account = response[0]
        })
        .catch(() => console.log('Failed to load profile'))
    },
    getWitness (username) {
      hive.api.getWitnessByAccountAsync(username)
        .then((response) => {
          this.witness = response
        })
        .catch(() => console.log('Failed to load witness data'))
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getGlobalProps () {
      hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => {
          this.globalProps = response
        })
        .catch(() => console.log('Failed to load global properties'))
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    },
    getAccountValue (username) {
      hive.formatter.estimateAccountValue(username)
        .then((response) => {
          this.accountValue = response
          console.log(response)
        })
    },
    getRC (username) {
      var url = 'https://anyx.io/v1/rc_api/find_rc_accounts?accounts=' + username
      this.$axios.get(url)
        .then((res) => {
          res = res.data
          this.RC.max = res.rc_accounts[0].max_rc
          this.RC.current = res.rc_accounts[0].rc_manabar.current_mana
          var percent = parseFloat((this.RC.current / this.RC.max) * 100).toFixed(2)
          if (percent > 100.00) { percent = 100 }
          this.RC.percent = percent
        })
        .catch(() => {
          console.log('error loading RC from anyx.io')
        })
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },
    returnLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnBlockLink (blockNum, txId) { return '/b/' + blockNum + '#' + txId },
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (['head_block_number', 'last_irreversible_block_num', 'last_confirmed_block_num'].includes(key)) {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else if (['to', 'from', 'comment_author', 'curator', 'author', 'parent_author', 'voter', 'account'].includes(key)) {
        return `<a href="/@${data}">${data}</a>`
      } else if (['permlink'].includes(key)) {
        return `<a href="/@${parent.author}/${parent.permlink}">${data}</a>`
      } else if (['json_metadata', 'json'].includes(key)) {
        return DOMPurify.sanitize(defaultFormatted)
      } else if (['comment_permlink'].includes(key)) {
        return `<a href="/@${parent.comment_author}/${parent.comment_permlink}">${data}</a>`
      } else {
        return DOMPurify.sanitize(defaultFormatted)
      }
    },
    init () {
      this.page = this.$router.currentRoute.query.page || 1
      this.getAccount(this.username)
      this.getGlobalProps()
      this.getRC(this.username)
      // this.getAccountValue(this.username)
      this.getWitness(this.username)
      this.getAccountHistoryMarker(this.username)
    }
  },
  mounted () {
    this.init()
  }
}
</script>
