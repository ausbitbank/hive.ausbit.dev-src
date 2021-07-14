<template>
  <q-form @submit="onSearchSubmit" @reset="onSearchReset" class="gt-xs q-mr-md q-electron-drag--exception">
    <q-input dense v-model="search" input-class="text-right" debounce="3000" class="q-ml-md" label="Search Account, Txid or Block">
      <template v-slot:append>
        <q-icon v-if="search !== ''" name="search" @click="onSearchSubmit" />
        <q-icon v-if="search !== ''" name="clear" class="cursor-pointer" @click="search = ''" />
      </template>
    </q-input>
  </q-form>
</template>
<script>
export default {
  name: 'searchbox',
  data () {
    return {
      usernameSuggestions: [],
      val: '',
      search: ''
    }
  },
  methods: {
    onSearchSubmit () {
      this.search = this.search.toLowerCase()
      if (!isNaN(this.search)) {
        this.$router.push('/block/' + this.search)
      } else {
        if (this.search.length === 40) {
          this.$router.push('/tx/' + this.search)
        } else {
          if (this.validateUsername(this.search)) {
            this.$router.push({ path: '/@' + this.search })
          }
        }
      }
    },
    onSearchReset () {
      this.search = ''
    },
    validateUsername (name) {
      if (this.$hive.utils.validateAccountName(name) === null) {
        return true
      } else {
        this.$q.notify(this.$hive.utils.validateAccountName(name))
        return false
      }
    },
    searchHiveUsernames () {
      var val = this.search
      if (val.length < 2) {
        return
      }
      const partialusername = val.toLowerCase()
      this.$hive.api.lookupAccountsAsync(partialusername, 10)
        .then(data => { this.usernameSuggestions = data })
    }
  }
}
</script>
