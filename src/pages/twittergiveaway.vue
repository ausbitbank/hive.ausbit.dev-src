<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card flat bordered class="q-ma-md">
      <q-card-section class="text-h6">
        Twitter Giveaway Tools
      </q-card-section>
      <q-card-section>
        Entries (usernames)
        <form @submit.prevent="submitEntrant">
          <div>
            <q-input label="username" v-model="entrant" dense ref="newEntry" />
            <q-btn dense icon="add" color="primary" type="submit" size="sm" rounded @click="submitEntrant()"/>
          </div>
        </form>
      </q-card-section>
    </q-card>
    <q-card flat bordered class="q-ma-md">
      <q-card-section class="text-center">
        <div class="text-bold">{{ entries.length }} usernames submitted</div>
        <div v-for="e in entries" :key="e.index">
          {{ e }} <q-btn dense icon="remove" color="red" size="sm" rounded @click="entries = entries.filter(item => item !== e)" />
        </div>
        <div>
          <q-btn dense icon="person_search" label="validate entries" color="primary" v-if="entries.length > 0" @click="validateEntries()" />
          <q-btn dense icon="clear" color="red" label="Clear All" @click="entries = []; entry = ''; validEntries = []" v-if="entries.length > 0" />
        </div>
      </q-card-section>
    </q-card>
      <q-spinner-grid size="2em" color="primary" v-if="this.loading" />
    <q-card flat bordered  class="q-ma-md">
      <q-card-section v-if="validEntries.length > 0">
        <div> {{ validEntries.length }} valid usernames</div>
        <div v-for="e in validEntries" :key="e.index">
          <router-link :to="accountLink(e.name)"><q-avatar><q-img :src="GetHiveAvatarUrl(e.name)" /></q-avatar> {{ e.name }}</router-link> | {{ timeDelta(e.created) }} |  {{ e.balance }} | {{ e.hbd_balance }} | {{ vestToHive(e.vesting_shares.split(' ')[0]) }} HP
        </div>
        <q-btn label="Pick Random Winner" @click="winner = randomItem(validEntries).name" color="green" />
        <div v-if="winner" class="text-h6">
          Random Winner : {{ winner }}
          <div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<style scoped>
a, a:link { color: #1d8ce0 }
</style>
<script>
import moment from 'moment'
import { debounce } from 'quasar'
export default {
  name: 'twitterGiveaway',
  data () {
    return {
      entrant: '',
      entries: [],
      validEntries: [],
      winner: null,
      globalProps: null,
      loading: false
    }
  },
  components: {},
  watch: {
  },
  props: {
  },
  computed: {
  },
  methods: {
    submitEntrant () {
      this.entries = this.entries.filter(item => item !== this.entrant)
      this.entries.push(this.entrant)
      this.entries = this.entries.filter(item => item !== '')
      this.entrant = ''
      this.$refs.newEntry.focus()
    },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    validateEntries () {
      this.loading = true
      this.$hive.api.getAccountsAsync(this.entries)
        .then((r) => {
          this.loading = false
          this.validEntries = r
        })
    },
    accountLink (account) {
      return '/@' + account
    },
    randomItem (items) {
      return items[Math.floor(Math.random() * items.length)]
    },
    getGlobalProps () {
      this.$hive.api.getDynamicGlobalPropertiesAsync()
        .then((response) => {
          this.globalProps = response
        })
        .catch(() => {
          console.log('Failed to load global properties .. Retrying')
          debounce(this.getGlobalProps(), 50)
        })
    },
    vestToHive (vests) {
      if (this.globalProps === null) {
        return vests
      } else {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      }
    },
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' }
  },
  mounted () {
    this.getGlobalProps()
    this.$refs.newEntry.focus()
  }
}
</script>
