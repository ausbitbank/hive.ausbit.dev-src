import { defineBoot } from '#q-app'
import axios from 'axios'

export default defineBoot(({ app }) => {
  app.config.globalProperties.$axios = axios
})

export { axios }
