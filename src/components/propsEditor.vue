<template>
    <div class="props-editor">
        <q-input outlined class="props-editor__input" type="textarea" v-model="newjson" label="Edit your metadata directly here or use the tags below" />
        <div class="props-editor__actions" v-if="newjson !== json && !edited">
          <q-btn no-caps dense unelevated label="Submit changes" color="primary" icon="save" @click="submitChanges()" />
        </div>
        <div class="props-editor__note props-editor__note--ok" v-if="edited">
            <q-icon name="check_circle" size="15px" aria-hidden="true" />
            <span>Your posting JSON metadata has been edited. Refresh the page in a moment to see the changes.</span>
        </div>
        <div class="props-editor__note" :class="error ? 'props-editor__note--error' : 'props-editor__note--info'" v-if="log !== ''">
            <q-icon :name="error ? 'error_outline' : 'info'" size="15px" aria-hidden="true" />
            <span>{{ log }}</span>
        </div>
        <div class="props-editor__tags">
            <div class="props-editor__tags-title">Commonly supported props</div>
            <q-chip v-for="tag in commonTags" :key="tag" dense clickable :class="{'is-selected': doesKeyExist(tag)}" :removable="doesKeyExist(tag)" @remove="removeKey(tag)" @click="showKeyPrompt(tag)">{{ tag }}</q-chip>
        </div>
        <div class="props-editor__tags" v-if="type !== 'jsonMeta'">
            <div class="props-editor__tags-title">Extra props recognised by this site</div>
            <q-chip v-for="tag in myTags" :key="tag" dense clickable :class="{'is-selected': doesKeyExist(tag)}" :removable="doesKeyExist(tag)" @remove="removeKey(tag)" @click="showKeyPrompt(tag)">{{ tag }}</q-chip>
        </div>
        <json-viewer class="props-editor__viewer" :data="JSON.parse(newjson)" />
        <q-dialog v-model="keyDialog" persistent>
        <q-card flat class="props-editor__dialog">
            <div class="props-editor__dialog-head">
              <div class="props-editor__dialog-eyebrow">Metadata</div>
              <h3 class="props-editor__dialog-title">Edit {{ keyDialogCurrentKey }}</h3>
            </div>
            <div class="props-editor__dialog-body">
              <q-input dense v-model="keyDialogCurrentData" outlined autofocus type="textarea" />
            </div>
            <div class="props-editor__dialog-actions">
              <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
              <q-btn unelevated dense no-caps label="Save" color="primary" @click="addKey(keyDialogCurrentKey, keyDialogCurrentData)" v-close-popup />
            </div>
        </q-card>
        </q-dialog>
    </div>
</template>
<script>
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
export default {
  name: 'propsEditor',
  props: {
    json: {
      type: String,
      required: false,
      default: function () { return '{}' }
    },
    username: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    account: {
      type: Object,
      required: true
    }
  },
  components: { jsonViewer },
  data () {
    return {
      newjson: this.json,
      edited: false,
      error: false,
      keyDialog: false,
      keyDialogCurrentKey: '',
      keyDialogCurrentData: '',
      log: '',
      myTags: ['twitter', 'twitch', 'github', 'discord', 'telegram', 'email', 'protonmail', 'bitcoin', 'lightning', 'litecoin', 'ethereum', 'dogecoin', 'ipfs', 'psn', 'steam', 'xbox', 'flickr', 'facebook', 'tumblr', 'linkedin', 'instagram', 'reddit', 'tiktok', 'soundcloud', 'vimeo', 'spotify', 'youtube', 'bandcamp', 'medium', 'keybase', 'vimm', 'threespeak', 'mastodon', 'gab', 'dbuzz', 'wordpress', 'nftshowroom', 'palnet', 'leofinance', 'pgp', 'nostr'],
      commonTags: ['name', 'about', 'location', 'profile_image', 'cover_image', 'website', 'witness_description', 'dtube_pub', 'pinned', 'portfolio', 'trail', 'default_page', 'default_view', 'witness_owner']
    }
  },
  computed: {
  },
  methods: {
    submitChanges () {
      if (this.type === 'postingMeta') {
        this.$hiveStore.addToQueue([this.username, 'posting', ['account_update2', { account: this.username, json_metadata: '', posting_json_metadata: this.newjson, extensions: [] }]])
        this.$emit('editedProps')
      }
      if (this.type === 'jsonMeta') {
        if (this.account.posting && this.account.memo_key) {
          var p = {
            account: this.username,
            posting: this.account.posting,
            memo_key: this.account.memo_key,
            json_metadata: this.newjson
          }
          this.$hiveStore.addToQueue([this.username, 'active', ['account_update', p]])
          this.$emit('editedProps')
        } else {
          console.log('missing required info to update json meta')
        }
      }
    },
    doesKeyExist (key) {
      if (key in JSON.parse(this.newjson).profile) {
        return true
      } else {
        return false
      }
    },
    removeKey (key) {
      // remove key
      console.log('remove key ' + key)
      var obj = JSON.parse(this.newjson)
      delete obj.profile[key]
      this.newjson = JSON.stringify(obj)
    },
    addKey (key, data) {
      // add key
      if (key !== undefined && data !== undefined) {
        console.log('add key: ' + key + ' with data ' + data)
        var obj = JSON.parse(this.newjson)
        obj.profile[key] = data
        this.newjson = JSON.stringify(obj)
      } else {
        this.log = 'Not adding empty key'
      }
    },
    showKeyPrompt (key) {
      this.keyDialogCurrentKey = key
      this.keyDialogCurrentData = JSON.parse(this.newjson).profile[key]
      this.keyDialog = true
    },
    mounted () {
      console.log('json')
      console.log(typeof (this.newjson))
    }
  }
}
</script>

<style scoped>
.props-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.props-editor__input :deep(textarea) {
  min-height: 140px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
}

.props-editor__actions {
  display: flex;
  justify-content: flex-end;
}

.props-editor__note {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.4;
}

.props-editor__note .q-icon {
  flex: none;
  margin-top: 1px;
}

.props-editor__note--ok {
  border-color: rgba(129, 199, 132, 0.32);
  background: rgba(76, 175, 80, 0.06);
  color: #a5d6a7;
}

.props-editor__note--info {
  color: #81d4fa;
}

.props-editor__note--error {
  border-color: rgba(229, 115, 115, 0.32);
  background: rgba(239, 83, 80, 0.06);
  color: #ef9a9a;
}

.props-editor__tags-title {
  margin-bottom: 0.2rem;
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.props-editor__tags .q-chip {
  margin: 0 0.25rem 0.25rem 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  font-size: 0.7rem;
}

.props-editor__tags .q-chip.is-selected {
  border-color: rgba(79, 195, 247, 0.4);
  background: rgba(79, 195, 247, 0.12);
  color: #e1f5fe;
}

.props-editor__viewer {
  overflow: auto;
  max-height: 240px;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.72rem;
}

.props-editor__dialog {
  width: min(420px, 94vw);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: #10181d;
  box-shadow: var(--shadow-pop);
}

.props-editor__dialog-head {
  padding: var(--space-3) var(--space-3) 0;
}

.props-editor__dialog-eyebrow {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.props-editor__dialog-title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
}

.props-editor__dialog-body {
  padding: var(--space-3);
}

.props-editor__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: 0 var(--space-3) var(--space-3);
}
</style>
