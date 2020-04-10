<template>
  <div>
    <div class="text-h5">Witness Overview</div>
    <q-table dense :data="witnessData" :columns="witnessColumns" row-key="id" :pagination.sync="pagination" />
  </div>
</template>

<script>
import hive from 'steem'
export default {
  name: 'Card5ToolsWitnessOverview',
  props: ['username', 'globalPropsHive'],
  data () {
    return {
      witnesses: null,
      pagination: { rowsPerPage: 50 },
      witnessColumns: [
        {
          name: 'owner',
          required: true,
          label: 'Witness',
          field: row => row.owner,
          sortable: true
        },
        {
          name: 'votes',
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
          required: true,
          label: 'Version',
          field: row => row.running_version,
          sortable: true
        },
        {
          name: 'last_confirmed_block_num',
          required: true,
          label: 'Last Block',
          field: row => row.last_confirmed_block_num,
          sortable: true
        },
        {
          name: 'total_missed',
          required: true,
          label: 'Misses',
          field: row => row.total_missed,
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
            votesHP: this.votes_to_hp(el.votes),
            account_creation_fee: el.props.account_creation_fee.split(' ')[0],
            account_subsidy_budget: el.props.account_subsidy_budget,
            account_subsidy_decay: el.props.account_subsidy_decay,
            maximum_block_size: el.props.maximum_block_size,
            hbd_interest_rate: el.props.sbd_interest_rate,
            price: (el.sbd_exchange_rate.base.split(' ')[0]),
            running_version: el.running_version,
            last_confirmed_block_num: el.last_confirmed_block_num,
            total_missed: el.total_missed
          })
        })
        return wd
      }
    },
    hivePerMvests: function () {
      if (this.globalPropsHive !== null) {
        if (this.globalPropsHive.total_vesting_shares) { return (this.globalPropsHive.total_vesting_fund_steem.split(' ')[0] / (this.globalPropsHive.total_vesting_shares.split(' ')[0] / 1e6)) } else { return 509.6451627091090586 }
      } else {
        return 509.6451627091090586
      }
    }
  },
  methods: {
    async get_data () {
      this.witnesses = await hive.api.getWitnessesByVoteAsync('', 200)
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
