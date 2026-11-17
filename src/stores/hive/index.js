import { defineStore } from 'pinia'
import state from './state'
import * as getters from './getters'
import * as mutations from './mutations'
import * as actions from './actions'

export const useHiveStore = defineStore('hive', {
  state,
  getters,
  actions: {
    ...mutations,
    ...actions
  }
})
