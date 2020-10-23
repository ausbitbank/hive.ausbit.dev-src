<template>
  <div>
    <div class="text-h5">Witness Overview</div>
    <q-table dense :data="witnessData" :columns="witnessColumns" row-key="id" :pagination.sync="pagination" :visible-columns="visibleColumns" :loading="loading">
      <template v-slot:top>
        <q-select v-model="visibleColumns" multiple dense options-dense display-value="Select Columns" emit-value map-options :options="witnessColumns" option-value="name" options-cover style="min-width: 150px" />
      </template>
    </q-table>
  </div>
</template>

<script>
import hive from '@hiveio/hive-js'
export default {
  name: 'Card5ToolsWitnessOverview',
  props: ['username', 'globalPropsHive'],
  data () {
    return {
      witnesses: null,
      loading: true,
      pagination: { rowsPerPage: 50 },
      visibleColumns: ['owner', 'votesHP', 'running_version', 'price', 'last_confirmed_block_num', 'total_missed'],
      witnessColumns: [
        {
          name: 'owner',
          label: 'Witness',
          field: row => row.owner,
          sortable: true,
          align: 'left'
        },
        {
          name: 'votes',
          label: 'Approval (Vests)',
          field: row => row.votes,
          sortable: true
        },
        {
          name: 'votesMv',
          label: 'Approval (MV)',
          field: row => row.votesMv,
          sortable: true
        },
        {
          name: 'votesHP',
          label: 'Approval (HP)',
          field: row => row.votesHP,
          sortable: true
        },
        {
          name: 'account_creation_fee',
          label: 'Creation Fee',
          field: row => row.account_creation_fee,
          sortable: true
        },
        {
          name: 'account_subsidy_budget',
          label: 'Acct Subsidy Budget',
          field: row => row.account_subsidy_budget,
          sortable: true
        },
        {
          name: 'account_subsidy_decay',
          label: 'Acct Subsidy Decay',
          field: row => row.account_subsidy_decay,
          sortable: true
        },
        {
          name: 'maximum_block_size',
          label: 'Maximum Block Size',
          field: row => row.maximum_block_size,
          sortable: true
        },
        {
          name: 'hbd_interest_rate',
          label: 'HBD Interest Rate',
          field: row => row.hbd_interest_rate,
          sortable: true
        },
        {
          name: 'price',
          label: 'Price Feed',
          field: row => row.price,
          sortable: true
        },
        {
          name: 'running_version',
          label: 'Version',
          field: row => row.running_version,
          sortable: true
        },
        {
          name: 'last_confirmed_block_num',
          label: 'Last Block',
          field: row => row.last_confirmed_block_num,
          sortable: true
        },
        {
          name: 'total_missed',
          label: 'Misses',
          field: row => row.total_missed,
          sortable: true
        },
        {
          name: 'url',
          label: 'URL',
          field: row => row.url,
          sortable: true
        },
        {
          name: 'id',
          label: 'Witness ID',
          field: row => row.id,
          sortable: true
        },
        {
          name: 'created',
          label: 'Created',
          field: row => row.created,
          sortable: true
        },
        {
          name: 'last_aslot',
          label: 'Last Aslot',
          field: row => row.last_aslot,
          sortable: true
        },
        {
          name: 'last_hbd_exchange_update',
          label: 'Last Price Update',
          field: row => row.last_hbd_exchange_update,
          sortable: true
        },
        {
          name: 'signing_key',
          label: 'Signing Key',
          field: row => row.signing_key,
          sortable: true
        }
      ]
    }
  },
  computed: {
    witnessData: function () {
      if (this.witnesses === null) {
        return []
      } else {
        var wd = []
        this.witnesses.forEach(el => {
          wd.push({
            id: el.id,
            owner: el.owner,
            votes: el.votes,
            votesMv: parseInt(el.votes / 1e12),
            votesHP: parseInt(this.votes_to_hp(el.votes)),
            account_creation_fee: el.props.account_creation_fee.split(' ')[0],
            account_subsidy_budget: el.props.account_subsidy_budget,
            account_subsidy_decay: el.props.account_subsidy_decay,
            maximum_block_size: el.props.maximum_block_size,
            hbd_interest_rate: el.props.hbd_interest_rate,
            price: (el.hbd_exchange_rate.base.split(' ')[0]),
            running_version: el.running_version,
            last_confirmed_block_num: el.last_confirmed_block_num,
            total_missed: el.total_missed,
            url: el.url,
            created: el.created,
            last_aslot: el.last_aslot,
            last_hbd_exchange_update: el.last_hbd_exchange_update,
            signing_key: el.signing_key
          })
        })
        return wd
      }
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_hive.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    async get_data () {
      this.witnesses = await hive.api.getWitnessesByVoteAsync('', 200)
      this.loading = false
    },
    votes_to_hp (votes) {
      return ((votes * this.hivePerMvests) / 1000000000000).toFixed(0)
    }
  },
  mounted () {
    this.get_data()
  }
}
</script>
