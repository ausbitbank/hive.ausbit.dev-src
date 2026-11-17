<template>
  <q-select clearable new-value-mode="add-unique" filled use-input hide-selected fill-input input-debounce="100" v-model="input" :label="label" :options="usernameSuggestions" @filter="filterFn" @filter-abort="abortFilterFn" style="max-width: 200px;" @update:model-value="onUpdate" />
</template>
<script>
import badActorList from '@hiveio/hivescript/bad-actors.json'
export default {
  name: 'userSearchBox',
  emits: ['selectUsername'],
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
    filterFn (val, update, _abort) {
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
      this.$hive.api.lookupAccountsAsync(partialusername, 20)
        .then(data => { this.usernameSuggestions = data.filter(el => { return this.badActors.indexOf(el) === -1 }) })
    },
    onUpdate (val) {
      this.input = val
      this.$emit('selectUsername', val)
    }
  }
}
</script>
