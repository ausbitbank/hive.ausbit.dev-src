// owner key history equivalent to https://hiveblocks.com/@username/~owners
<template>
  <q-page class="flex">
    <div class="fit row wrap justify-center items-start content-start">
      <account-header :globalProps="globalProps" :account="account" :showBalances="false" v-if="globalProps !== null && account !== undefined"/>
        <div class="col-xs-12 col-sm-12 col-md-4" style="max-width: 500px">
          <q-card flat bordered class="text-center q-pa-sm q-ma-md">
            <div class="text-h5 text-title">Owner key history for {{ username }}</div>
            <q-list v-if="history !== null && history.length > 0">
              <q-item v-for="h in history" :key="h.index">
                <json-viewer :data="h" />
              </q-item>
            </q-list>
            <div v-else>No history.</div>
          </q-card>
        </div>
    </div>
  </q-page>
</template>
<script>
import accountHeader from 'components/accountHeader.vue'
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'accountPage',
  components: { accountHeader, jsonViewer },
  data () {
    return {
      username: this.$route.params.username,
      history: null
    }
  },
  computed: {
    globalProps: { get () { return this.$store.state.hive.globalProps } },
    account: {
      cache: false,
      get () { return this.$store.state.hive.accounts[this.username] }
    }
  },
  methods: {
    getOwnerHistory (account) {
      this.$hive.api.getOwnerHistoryAsync(account)
        .then(res => { this.history = res; console.log(res) })
        .catch(err => { console.error(err) })
    }
  },
  mounted () {
    if (this.globalProps.empty) { this.$store.dispatch('hive/getGlobalProps') }
    if (this.account === undefined) { this.$store.dispatch('hive/getAccount', this.username) }
    this.getOwnerHistory(this.username)
  }
}
</script>
