<template>
  <div>
    <q-card>
      <div>
        <q-input label="Search users" debounce="300" v-model="filter">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <div class="q-pa-md">
        <q-table title="Followed by User" :data="followersData" :columns="tableColumns" :filter="filter" row-key="id" dense :loading="loading.followers" :pagination.sync="pagination" />
        <q-table title="User is Following" :data="followingData" :columns="tableColumns" :filter="filter" row-key="id" dense :loading="loading.following" :pagination.sync="pagination" />
        <q-table title="User is Muting" :data="mutingData" :columns="tableColumns" :filter="filter" row-key="id" dense :loading="loading.muting" :pagination.sync="pagination" />
        <q-table title="Muting this User" :data="mutersData" :columns="tableColumns" :filter="filter" row-key="id" dense :loading="loading.muters" :pagination.sync="pagination" />
      </div>
    </q-card>
  </div>
</template>

<script>
export default {
  name: 'Card1Followers',
  props: ['username', 'followCounts'],
  data () {
    return {
      api: 'https://api.ausbit.dev/',
      followers: [],
      following: [],
      muters: [],
      muting: [],
      loading: {
        followers: false,
        following: false,
        muters: false,
        muting: false
      },
      pagination: {
        rowsPerPage: 10
      },
      filter: '',
      tableColumns: [
        {
          name: 'user',
          required: true,
          label: 'Username',
          field: row => row.name,
          sortable: true
        }
      ]
    }
  },
  computed: {
    followersData: function () {
      if (this.followers !== []) {
        var res = []
        this.followers.forEach(el => { res.push({ name: el }) })
        return res
      } else {
        return []
      }
    },
    followingData: function () {
      if (this.following !== []) {
        var res = []
        this.following.forEach(el => { res.push({ name: el }) })
        return res
      } else {
        return []
      }
    },
    mutersData: function () {
      if (this.muters !== []) {
        var res = []
        this.muters.forEach(el => { res.push({ name: el }) })
        return res
      } else {
        return []
      }
    },
    mutingData: function () {
      if (this.muting !== []) {
        var res = []
        this.muting.forEach(el => { res.push({ name: el }) })
        return res
      } else {
        return []
      }
    }
  },
  methods: {
    getFollowers () {
      this.loading.followers = true
      this.$axios.get(this.api + 'followers/' + this.username)
        .then((res) => {
          this.followers = res.data
          this.loading.followers = false
        })
    },
    getFollowing () {
      this.loading.following = true
      this.$axios.get(this.api + 'following/' + this.username)
        .then((res) => {
          this.following = res.data
          this.loading.following = false
        })
    },
    getMuters () {
      this.loading.muters = true
      this.$axios.get(this.api + 'muters/' + this.username)
        .then((res) => {
          this.muters = res.data
          this.loading.muters = false
        })
    },
    getMuting () {
      this.loading.muting = true
      this.$axios.get(this.api + 'muting/' + this.username)
        .then((res) => {
          this.muting = res.data
          this.loading.muting = false
        })
    },
    getData () {
      this.getFollowers()
      this.getFollowing()
      this.getMuters()
      this.getMuting()
    }
  },
  mounted () {
    this.getData()
  }
}
</script>
