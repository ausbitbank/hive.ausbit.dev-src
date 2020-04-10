<template>
  <div>
  <q-card>
    <q-tabs v-model="card1DelegationsTab" dense align="justify" narrow-indicator indicator-color="secondary">
      <q-tab name="incoming" label="Incoming" />
      <q-tab name="outgoing" label="Outgoing" />
      <q-tab name="expiring" label="Expiring" />
      <q-tab name="delegate" label="Delegate" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="card1DelegationsTab" animated>
    <q-tab-panel name="incoming">
      <q-table title="Incoming Delegations Coming Soon" :data="incomingDeleData" :columns="incomingDeleColumns" row-key="id" />
    </q-tab-panel>
    <q-tab-panel name="outgoing">
      <q-table title="Outgoing Delegations" :data="outgoingDeleData" :columns="outgoingDeleColumns" row-key="id" />
    </q-tab-panel>
    <q-tab-panel name="expiring" v-if="expiringDelegations">
      <div v-if="expiringDelegations.length > 0">
        {{ expiringDelegations }}
      </div>
      <div v-else>
        No expiring delegations found
      </div>
    </q-tab-panel>
    <q-tab-panel name="delegate">
      You have {{ availableHP }} HP available for delegation.
      Who would you like to delegate to ?
      <q-input label="Delegatee" v-model="delegatee" />
      How much would you like to delegate ?
      <q-input label="Delegation Amount (HP)" v-model="amount" />
      <q-btn label="Delegate" />
    </q-tab-panel>
  </q-tab-panels>
  </q-card>
  </div>
</template>

<script>
import hive from 'steem'
export default {
  name: 'Card1Delegations',
  props: ['A', 'username', 'hivePerMvests', 'rpcListHive'],
  data () {
    return {
      delegatee: '',
      amount: 0,
      card1DelegationsTab: 'incoming',
      delegationData: null,
      expiringDelegations: null,
      incomingDeleColumns: [
        {
          name: 'id',
          required: true,
          label: 'Delegation ID',
          field: row => row.id,
          sortable: true
        },
        {
          name: 'delegator',
          required: true,
          label: 'From',
          field: row => row.delegator,
          sortable: true
        },
        {
          name: 'amount',
          required: true,
          label: 'Hive',
          field: row => row.amount,
          sortable: true
        },
        {
          name: 'vests',
          required: true,
          label: 'Vests',
          field: row => row.vests,
          sortable: true
        },
        {
          name: 'time',
          required: true,
          label: 'Time',
          field: row => row.time,
          sortable: true
        }
      ],
      outgoingDeleColumns: [
        {
          name: 'delegatee',
          required: true,
          label: 'To',
          field: row => row.delegatee,
          sortable: true
        },
        {
          name: 'amount',
          required: true,
          label: 'Amount',
          field: row => row.amount,
          sortable: true
        },
        {
          name: 'vests',
          required: true,
          label: 'Vests',
          field: row => row.vests,
          sortable: true
        },
        {
          name: 'time',
          required: true,
          label: 'Time',
          field: row => row.time,
          sortable: true
        }
      ]
    }
  },
  computed: {
    incomingDeleData: function () {
      if (this.delegationData !== null) {
        return []
      } else {
        return []
      }
    },
    outgoingDeleData: function () {
      if (this.delegationData !== null) {
        var outgoingDelegations = []
        this.delegationData.forEach(el => {
          outgoingDelegations.push({ id: el.id, delegatee: el.delegatee, amount: this.mvestsToHP(el.vesting_shares.split(' ')[0]), vests: el.vesting_shares, time: el.min_delegation_time })
        })
        return outgoingDelegations
      } else {
        return []
      }
    },
    baseHP: function () {
      return this.mvestsToHP(parseInt(this.A.vesting_shares.split(' ')[0]))
    },
    receivedHP: function () {
      return this.mvestsToHP(parseInt(this.A.received_vesting_shares.split(' ')[0]))
    },
    sentHP: function () {
      return this.mvestsToHP(parseInt(this.A.delegated_vesting_shares.split(' ')[0]))
    },
    effectiveHP: function () {
      return ((parseInt(this.baseHP) + parseInt(this.receivedHP)) - parseInt(this.sentHP))
    },
    availableHP: function () { // Available for delegations
      return parseInt(this.baseHP) - parseInt(this.sentHP)
    }
  },
  methods: {
    getOutgoingDelegations (username) {
      hive.api.getVestingDelegations(username, '', 50, function (err, result) {
        if (err) { console.log(err) }
        this.delegationData = result
      }.bind(this))
    },
    vestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000000000).toFixed(3)
    },
    mvestsToHP (v) {
      return ((v * this.hivePerMvests) / 1000000).toFixed(3)
    },
    getExpiringDelegations (username) {
      var d = new Date().toISOString().split('.')[0]
      var q = { id: 1, jsonrpc: '2.0', method: 'call', params: ['condenser_api', 'get_expiring_vesting_delegations', [username, d, 1000]] }
      this.$axios.post(this.rpcListHive[0], q)
        .then((response) => {
          this.expiringDelegations = response.data.result
        })
    },
    delegateKeychain (who, hp) {
      window.hive_keychain.requestDelegation(this.A.name, who, hp.toFixed(3), 'HP', function (response) {
        console.log(response)
      })
    }
  },
  mounted () {
    this.getOutgoingDelegations(this.A.name)
    this.getExpiringDelegations(this.A.name)
  }
}
</script>
