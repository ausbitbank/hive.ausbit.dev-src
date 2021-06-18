<template>
  <q-btn label="Outgoing Routes" dense rounded color="secondary" @click="dialog = true">
    <q-dialog v-model="dialog">
      <q-card class="q-pa-md justify">
        <div class="text-h5">Outgoing Withdraw Routes</div>
        <div class="row" v-if="routes.length > 0">
          <q-table :data="routes" :columns="tableColumns" row-key="id" :loading="loading" />
        </div>
        <div v-else-if="!loading">
          No outgoing withdraw routes have been set
        </div>
        <q-spinner-pie color="secondary" size="lg" v-if="loading" />
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'outgoingRoutes',
  props: ['A', 'globalPropsHive'],
  data () {
    return {
      dialog: false,
      loading: false,
      username: this.A.name,
      routes: [],
      api: 'https://api.ausbit.dev/',
      tableColumns: [
        {
          name: 'id',
          required: true,
          label: 'Id',
          field: row => row.id,
          sortable: true
        },
        {
          name: 'from',
          label: 'From',
          field: row => row.from_account
        },
        {
          name: 'to',
          label: 'To',
          field: row => row.to_account
        },
        {
          name: 'vest',
          label: 'Auto Vest',
          field: row => row.auto_vest
        },
        {
          name: 'percent',
          label: 'Percent',
          field: row => row.percent / 100
        }
      ]
    }
  },
  computed: {
  },
  methods: {
    getWithdrawRoutes () {
      this.loading = true
      this.$axios.get(this.api + 'withdrawRoutes/' + this.username)
        .then((res) => {
          this.routes = res.data
          this.loading = false
        })
    }
  },
  mounted () {
    this.getWithdrawRoutes()
  }
}
</script>
