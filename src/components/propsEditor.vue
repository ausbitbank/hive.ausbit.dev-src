<template>
    <div>
        <q-input outlined style="height: 100%" type="textarea" v-model="newjson" label="Current Values" />
        <q-btn label="Submit changes" color="orange" icon="warning" @click="submitChanges()" v-if="newjson !== json" />
    </div>
</template>
<script>
export default {
  name: 'propsEditor',
  props: ['json', 'username', 'type'],
  data () {
    return {
      newjson: this.json
    }
  },
  methods: {
    submitChanges () {
      if (this.type === 'postingMeta') {
        var params = {
          account: this.username,
          json_metadata: '',
          posting_json_metadata: this.newjson
        }
        var op = [
          'account_update2',
          params
        ]
        window.hive_keychain.requestBroadcast(this.username, [op], 'Posting')
      }
    },
    mounted () {
    }
  }
}
</script>
