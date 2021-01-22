<template>
  <div v-if="RC.rc_manabar !== undefined">
    <q-linear-progress dark stripe rounded size="20px" :value="rcPercent" color="green" class="q-mt-sm">
      <div class="absolute-full flex flex-center">
          <q-badge color="black" text-color="primary" >{{ (rcPercent * 100).toFixed(2) }} %</q-badge>
      </div>
    </q-linear-progress>
    <q-card-section class="text-center">
        <div class="text-bold">Enough credits for approximately:</div>
        <div>{{ resourceBudgetComments }} comments</div>
        <div>{{ resourceBudgetVotes }} votes</div>
        <div>{{ resourceBudgetTransfers }} transfers</div>
    </q-card-section>
  </div>
</template>
<script>
// Calculate Resource Credits availability, present as a progress bar
export default {
  name: 'rc',
  props: ['username', 'display'],
  data () {
    return {
      loading: false,
      RC: {}
    }
  },
  computed: {
    rcPercent: function () {
      if (this.RC.max_rc !== undefined) {
        var max = this.RC.max_rc
        var current = this.RC.rc_manabar.current_mana
        return parseFloat(((current / max)))
      } else {
        return null
      }
    },
    resourceBudgetComments: function () {
      if (this.RC.rc_manabar !== undefined) {
        var cost = (0.866099987 * 1000000000)
        var available = (this.RC.rc_manabar.current_mana / cost)
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
      if (this.RC.rc_manabar !== undefined) {
        var cost = (0.098893838 * 1000000000)
        var available = (this.RC.rc_manabar.current_mana / cost)
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
      if (this.RC.rc_manabar !== undefined) {
        var cost = (0.476452196 * 1000000000)
        var available = (this.RC.rc_manabar.current_mana / cost)
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
    getRcForAccount (account) {
      this.loading = true
      var params = { accounts: [account] }
      this.$hive.api.callAsync('rc_api.find_rc_accounts', params)
        .then(res => {
          this.loading = false
          this.RC = res.rc_accounts[0]
        })
    }
  },
  mounted () {
    this.getRcForAccount(this.username)
  }
}
</script>
