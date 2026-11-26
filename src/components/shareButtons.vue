<template>
  <span>
    <q-btn v-for="service in services" :key="service" dense push no-caps size="md" class="hvr" @click="share(service)" :icon="returnServiceIcon(service)" :label="returnServiceLabel(service)" />
    <q-btn size="md" class="hvr" no-caps @click="copy()" dense push icon="content_copy" label="Copy URL" />
  </span>
</template>
<script>
import { copyToClipboard } from 'quasar'
export default {
  name: 'shareButtons',
  data () {
    return {
      services: ['dbuzz', 'x', 'facebook', 'reddit']
    }
  },
  props: ['title'],
  methods: {
    returnServiceIcon (service) { return 'img:/statics/' + service + '.svg' },
    returnServiceLabel (service) { return service === 'x' ? 'X' : service },
    returnCurrentUrl () { return 'https://banksia.io' + this.$route.path },
    copy () { var i = this.returnCurrentUrl(); copyToClipboard(i); this.$q.notify('Copied to clipboard: ' + i) },
    returnServiceUrl (service) {
      var url = this.returnCurrentUrl()
      switch (service) {
        case 'x':
          return 'https://x.com/intent/post?text=' + encodeURIComponent(this.title) + '&url=' + encodeURIComponent(url)
        case 'facebook':
          return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURI(url) + 'title=&description=&quote=' + encodeURI(this.title) + '&hashtag='
        case 'dbuzz':
          return 'https://d.buzz/#/intent/buzz?text=' + encodeURI(this.title) + '&url=' + encodeURI(url) + '&tags=#hive'
        case 'reddit':
          return 'https://www.reddit.com/submit?url="' + encodeURI(url) + '"&title="' + encodeURI(this.title) + '"'
      }
    },
    share (service) {
      window.open(this.returnServiceUrl(service), '_blank', 'noopener,noreferrer')
    }
  }
}
</script>
