import { defineStore } from 'pinia'
import state from './state'
import * as getters from './getters'
import * as mutations from './mutations'
import * as actions from './actions'
import * as dashboard from './dashboard'

export const useHiveStore = defineStore('hive', {
  state,
  getters,
  actions: {
    ...mutations,
    ...actions,
    ...dashboard
  }
})
