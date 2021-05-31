<template>
  <q-list dense>
    <q-item class="text-h6">
      <router-link :to="returnPostLink(p.creator, p.permlink)">{{ p.subject }}</router-link> <span class="text-grey text-caption">{{ p.id }}</span>
    </q-item>
    <q-item>
      <q-item-section avatar>
        <q-avatar size="sm">
          <q-img :src="getHiveAvatarUrl(p.creator)" />
        </q-avatar>
      </q-item-section>
      <q-item-section class="q-ma-sm">
        Creator: <router-link :to="returnUserLink(p.creator)">{{ p.creator }}</router-link>
      </q-item-section>
      <q-item-section avatar v-if="p.creator !== p.receiver">
        <q-avatar size="sm">
          <q-img :src="getHiveAvatarUrl(p.receiver)" />
        </q-avatar>
      </q-item-section>
      <q-item-section class="q-ma-sm" v-if="p.creator !== p.receiver">
        Receiver: <router-link :to="returnUserLink(p.receiver)">{{ p.receiver }}</router-link>
      </q-item-section>
    </q-item>
    <q-item>
      <q-item-section avatar>
        <q-icon name="date_range" color="grey" />
      </q-item-section>
      <q-item-section>
        {{ returnNiceDate(p.start_date) }} - {{ returnNiceDate(p.end_date) }}
      </q-item-section>
    </q-item>
    <q-item>
      <q-item-section avatar>
        <q-icon name="monetization_on" color="green" />
      </q-item-section>
      <q-item-section v-if="p.daily_pay">
        Daily Pay: {{ tidyNumber(p.daily_pay.amount / 1000)}} HBD
      </q-item-section>
    </q-item>
    <q-item>
      <q-item-section avatar>
        <q-icon name="favorite" color="red" />
      </q-item-section>
      <q-item-section>
        Vote Value: {{ tidyNumber((vestToHive(p.total_votes) / 1000000).toFixed()) }} HP
      </q-item-section>
    </q-item>
    <q-item>
      <q-item-section avatar>
        <q-icon v-if="p.id === 0" name="star" color="orange" title="return p" />
        <q-icon v-else-if="p.status === 'active' && (parseInt(p.total_votes) < returnProposalVotes)" name="circle" color="orange" title="active, unfunded" />
        <q-icon v-else-if="p.status === 'active'" name="circle" color="green" title="active, funded" />
        <q-icon v-else-if="p.status === 'expired'" name="cancel" color="grey" title="expired" />
        <q-icon v-else-if="p.status === 'inactive'" name="circle" color="red" title="inactive" />
      </q-item-section>
      <q-item-section>
        Status:
        <span v-if="p.status === 'active' && (parseInt(p.total_votes) < returnProposalVotes)">Active, Unfunded</span>
        <span v-else-if="p.status === 'active'">Active, Funded</span>
        <span v-else-if="p.status === 'expired'">Expired</span>
        <span v-else-if="p.status === 'inactive'">Inactive</span>
        <span v-else>{{ p.status }}</span>
      </q-item-section>
    </q-item>
    <q-item v-if="p.voted">
      <q-item-section avatar>
        <q-icon name="check" color="green" />
      </q-item-section>
      <q-item-section>
        Voted by {{ loggedInUser }} <a :href="returnHiveSignerDeny(p.id)" target="blank">Unvote</a>
      </q-item-section>
    </q-item>
    <q-item v-else>
      <q-item-section avatar>
        <q-icon name="check_box_outline_blank" />
      </q-item-section>
      <q-item-section>
        <a :href="returnHiveSignerApprove(p.id)" target="_blank">Vote for proposal</a>
      </q-item-section>
    </q-item>
  </q-list>
</template>
<script>
import moment from 'moment'
export default {
  name: 'proposal',
  data () {
    return {
      votes: null
    }
  },
  props: ['p', 'returnProposalVotes'],
  computed: {
    loggedInUser: function () {
      return this.$store.state.hive.user.username
    },
    globalProps: function () {
      return this.$store.state.hive.globalProps
    }
  },
  methods: {
    returnPostLink (author, permlink) { return '/@' + author + '/' + permlink },
    returnUserLink (user) { return '/@' + user },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    returnNiceDate (timestamp) { return moment(timestamp).format('Do MMMM YYYY') },
    returnHiveSignerApprove (id) { return 'https://hivesigner.com/sign/update-proposal-votes?proposal_ids=%5B' + id + '%5D&approve=true' },
    returnHiveSignerDeny (id) { return 'https://hivesigner.com/sign/update-proposal-votes?proposal_ids=%5B' + id + '%5D&approve=false' },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive)
      } else {
        return null
      }
    },
    tidyNumber (x) {
      if (x) {
        var parts = x.toString().split('.')
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return parts.join('.')
      } else {
        return null
      }
    }
  },
  mounted () {
  }
}
</script>
