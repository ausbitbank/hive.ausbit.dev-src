<template>
  <q-select clearable new-value-mode="add" filled :value="input" use-input hide-selected fill-input input-debounce="100" v-model="input" :label="label" :options="usernameSuggestions" @filter="filterFn" @filter-abort="abortFilterFn" style="max-width: 200px;" @input="$emit('selectUsername', input)" />
</template>
<script>
import badActorList from '@hiveio/hivescript/bad-actors.json'
export default {
  name: 'userSearchBox',
  data () {
    return {
      input: this.username,
      usernameSuggestions: [],
      badActors: badActorList
    }
  },
  props: ['username', 'label'],
  watch: {
    username: function (newState) {
      this.input = newState
    }
  },
  methods: {
    filterFn (val, update, abort) {
      update(() => {
        this.searchHiveUsernames(val)
      })
    },
    abortFilterFn () {
    },
    searchHiveUsernames (val) {
      if (val.length < 2) {
        return
      }
      const partialusername = val.toLowerCase()
      this.$hive.api.lookupAccountsAsync(partialusername, 10)
        .then(data => { this.usernameSuggestions = data.filter(el => { return this.badActors.indexOf(el) === -1 }) })
    },
    setModel (val) {
      this.input = val
      console.log('model set ' + val)
    }
  }
}
</script>
