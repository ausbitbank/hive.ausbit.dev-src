<template>
  <div>
    <div v-if="witnessState !== null">
    <div>
      <span class="text-bold q-pa-md">
        Id
      </span>
      <span class="q-pa-md">
        {{ witnessState.id }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Rank
      </span>
      <span class="q-pa-md">
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Created
      </span>
      <span class="q-pa-md">
        {{ witnessState.created }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Owner
      </span>
      <span class="q-pa-md">
        {{ witnessState.owner }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Url
      </span>
      <span class="q-pa-md">
        {{ witnessState.url }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Rewards Last 30 Days
      </span>
      <span class="q-pa-md">
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Rewards Last 7 Days
      </span>
      <span class="q-pa-md">
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Running Version
      </span>
      <span class="q-pa-md">
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Hardfork Version Vote
      </span>
      <span class="q-pa-md">
        {{ witnessState.hardfork_version_vote }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Hardfork Time Vote
      </span>
      <span class="q-pa-md">
        {{ witnessState.hardfork_time_vote }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Total Missed
      </span>
      <span class="q-pa-md">
        {{ witnessState.total_missed }}
      </span>
    </div>
    <q-separator />
    <div>
      <span class="text-bold q-pa-md">
        Account Creation Fee
      </span>
      <span class="q-pa-md">
        {{ witnessState.props.account_creation_fee }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Maximum Block Size
      </span>
      <span class="q-pa-md">
        {{ witnessState.props.maximum_block_size }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        HBD Interest Rate
      </span>
      <span class="q-pa-md">
        {{ witnessState.props.hbd_interest_rate }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Account Subsidy Budget
      </span>
      <span class="q-pa-md">
        {{ witnessState.props.account_subsidy_budget }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Account Subsidy Decay
      </span>
      <span class="q-pa-md">
        {{ witnessState.props.account_subsidy_decay }}
      </span>
    </div>
    <q-separator />
    <div>
      <span class="text-bold q-pa-md">
        HBD Exchange Rate
      </span>
      <span class="q-pa-md">
        {{ witnessState.hbd_exchange_rate.base }} : {{ witnessState.hbd_exchange_rate.quote }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Last HBD Exchange Update
      </span>
      <span class="q-pa-md">
        {{ witnessState.last_hbd_exchange_update }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Last confirmed block number
      </span>
      <span class="q-pa-md">
        {{ witnessState.last_confirmed_block_num }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Last aslot
      </span>
      <span class="q-pa-md">
        {{ witnessState.last_aslot }}
      </span>
    </div>
    <div>
      <span class="text-bold q-pa-md">
        Signing Key
      </span>
      <span class="q-pa-md">
        {{ witnessState.signing_key }}
      </span>
    </div>
    </div>
    <q-spinner-pie v-if="witnessState === null && witnessDisabled === false" size="5em" color="secondary" />
    <div v-if="witnessDisabled">User is not a HIVE witness</div>
  </div>
</template>

<script>
import hive from '@hiveio/hive-js'
export default {
  name: 'Card1WitnessDetails',
  props: ['username'],
  data () {
    return {
      witnessState: null,
      witnessDisabled: false
    }
  },
  methods: {
    async getWitness (username) {
      hive.api.getWitnessByAccount(username, function (err, result) {
        if (err) { console.log(err) }
        if (result === null) { this.witnessDisabled = true }
        this.witnessState = result
      }.bind(this))
    }
  },
  mounted () {
    this.getWitness(this.username)
  }
}
</script>
