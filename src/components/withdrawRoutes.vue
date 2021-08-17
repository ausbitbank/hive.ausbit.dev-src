<template>
  <div>
    <div v-if="routes">
      <div v-for="route in routes" :key="route.index">
          {{ route.to_account }} - {{ route.percent / 100 }}%
          <span v-if="route.auto_vest">Staked</span>
          <span v-else>Liquid</span>
          <q-btn v-if="loggedInUser === username" flat dense icon="delete" color="red" title="Delete route" @click="setWithdrawRoute(username, route.to_account, 0, false)"/>
      </div>
    </div>
    <div v-else>
      None set
    </div>
    <div v-if="loggedInUser === username">
    <q-btn flat dense icon="add" color="green" title="Add withdraw route">
        <q-popup-proxy>
          <q-card flat bordered class="q-pa-sm text-center">
            <div class="text-bold text-center">Add a new withdraw route</div>
            <q-input disable label="From account" v-model="newRoute.from_account" />
            <q-input label="To account" v-model="newRoute.to_account" :rules="[val => !!val || 'Field is required']"/>
            <q-input v-model="newRoute.percent" label="Percentage" />
            <q-slider dense label :label-value="'Percent: ' + newRoute.percent + '%'" v-model="newRoute.percent" :min="0" :max="100" style="max-width: 90%" />
            <q-checkbox left-label label="Automatic vesting" v-model="newRoute.auto_vest" /><br />
            <q-btn flat dense label="Add new route" color="primary" @click="setWithdrawRoute(username, newRoute.to_account, newRoute.percent * 100, newRoute.auto_vest)" v-close-popup />
          </q-card>
        </q-popup-proxy>
    </q-btn>
    <q-btn flat dense icon="refresh" color="green" title="Refresh withdraw routes" @click="getWithdrawRoutes()" />
    </div>
  </div>
</template>
<script>
export default {
  name: 'withdrawRoutes',
  data () {
    return {
      routes: null,
      newRoute: { from_account: this.username, to_account: '', percent: 100, auto_vest: false }
    }
  },
  props: ['username'],
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  },
  methods: {
    getWithdrawRoutes () {
      this.$hive.api.getWithdrawRoutesAsync(this.username, 1)
        .then(res => { this.routes = res })
    },
    setWithdrawRoute (fromAccount, toAccount, percent, autoVest) {
      this.$store.commit('hive/addToQueue', [this.username, 'active', ['set_withdraw_vesting_route', { from_account: fromAccount, to_account: toAccount, percent: percent, auto_vest: autoVest }]])
    }
  },
  mounted () {
    this.getWithdrawRoutes()
  }
}
</script>
