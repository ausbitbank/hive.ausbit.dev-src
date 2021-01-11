<template>
    <div>
        <q-input outlined style="height: 100%" type="textarea" v-model="newjson" label="Current Values" />
        <q-btn label="Submit changes" color="orange" icon="warning" @click="submitChanges()" v-if="newjson !== json" />
        <json-viewer :data="JSON.parse(newjson)" />
        <div>
            Commonly Supported Props:
            <q-chip v-for="tag in commonTags" :key="tag.index" outline dense clickable color="grey" :selected=(doesKeyExist(tag))>{{ tag }}</q-chip>
        </div>
        <div>
            Extra Props recognised by this site:
            <q-chip v-for="tag in myTags" :key="tag.index" outline dense clickable color="grey" :selected=(doesKeyExist(tag))>{{ tag }}</q-chip>
        </div>
    </div>
</template>
<script>
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'propsEditor',
  props: ['json', 'username', 'type'],
  components: { jsonViewer },
  data () {
    return {
      newjson: this.json,
      myTags: ['twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'bitcoin', 'litecoin', 'ethereum', 'ipfs', 'psn', 'steam', 'xbox', 'flickr', 'facebook', 'tumblr', 'linkedin', 'instagram', 'reddit', 'tiktok', 'soundcloud', 'vimeo', 'spotify', 'youtube', 'bandcamp', 'medium', 'keybase'],
      commonTags: ['name', 'about', 'location', 'profile_image', 'cover_image', 'website', 'witness_description', 'dtube_pub']
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
    doesKeyExist (key) {
      if (key in JSON.parse(this.newjson).profile) {
        return true
      } else {
        return false
      }
    },
    mounted () {
    }
  }
}
</script>
