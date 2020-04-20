<template>
  <div>
    <q-card>
      <div>
        Followers: {{ followCounts.follower_count }}, Following: {{ followCounts.following_count }}
      </div>
      <div><q-input label="Search users" /></div>
      <div>
        <q-btn @click="getFollowers()">Load Followers ({{ followers.length }}/{{ followCounts.follower_count }})</q-btn>
        <q-btn @click="getFollowing()">Load following ({{ followers.length }}/{{ followCounts.follower_count }})</q-btn>
      </div>
      <div>
        <q-btn label="Load muters" />
        <q-btn label="Load muting" />
      </div>
      <div>
        <q-table title="Followers" :data="followersData" :columns="tableColumns" row-key="id" dense />
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
      following: ['caitlinjohnstone', 'edicted', 'p4ragon', 'sonicgroovelive', 'krystle', 'edwardstobia', 'steemchiller', 'ausbitbank', 'megacity', 'joseacabrerav', 'juliakponsford', 'stortebeker'],
      muters: [],
      muting: [],
      tableColumns: [
        {
          name: 'user',
          required: true,
          label: 'Username',
          field: row => row.user,
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
    }
  },
  methods: {
    getFollowers () {
      this.$axios.get(this.api + 'followers/' + this.username)
        .then((res) => {
          this.followers = res.data
        })
    },
    getFollowing () {
      this.$axios.get(this.api + 'following/' + this.username)
        .then((res) => {
          this.following = res.data
        })
    },
    getMuters () {
      this.$axios.get(this.api + 'muters/' + this.username)
        .then((res) => {
          this.muters = res.data
        })
    },
    getMuting () {
      this.$axios.get(this.api + 'muting/' + this.username)
        .then((res) => {
          this.muting = res.data
        })
    }
  }
}
</script>
