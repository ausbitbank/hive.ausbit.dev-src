<template>
  <div v-html="postContent" class="postview q-ma-md q-pa-md">
  </div>
</template>
<style>
.postView img { max-width: 95% !important; }
</style>
<script>
import { DefaultRenderer } from 'steem-content-renderer'
export default {
  name: 'PostContent',
  props: ['post'],
  data () {
    return {
      renderer: new DefaultRenderer({
        baseUrl: 'https://peakd.com/',
        breaks: true,
        skipSanitization: false,
        allowInsecureScriptTags: false,
        addNofollowToLinks: true,
        doNotShowImages: false,
        ipfsPrefix: '',
        assetsWidth: 640,
        assetsHeight: 480,
        imageProxyFn: (url) => url,
        usertagUrlFn: (account) => '/@' + account,
        hashtagUrlFn: (hashtag) => '/trending/' + hashtag,
        isLinkSafeFn: (url) => true
      })
    }
  },
  computed: {
    postContent: function () {
      return this.renderer.render(this.post.body)
    }
  },
  methods: {
  }
}
</script>
