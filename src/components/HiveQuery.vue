<template>
  <form @submit.prevent.stop="onSubmit" @reset.prevent.stop="onReset" class="q-gutter-md">
    <q-input clearable filled v-model="query" label="Query" />
    <div>
      <q-btn label="Submit" type="submit" />
    </div>
  </form>
</template>

<script>
import steem from 'steem'
steem.api.setOptions({ url: 'https://api.openhive.network' })
export default {
  name: 'HiveQuery',
  data () {
    return {
      query: ''
    }
  },
  methods: {
    doQuery (query) {
    }
  }
}
</script>
