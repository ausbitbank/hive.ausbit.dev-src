<template>
  <div v-html="postContent" class="q-ma-md q-pa-md">
  </div>
</template>
<style>
.postview { overflow: auto; max-height: 100vh  }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
img { max-width: 95%; max-height: 95%; text-align: center}
</style>
<script>
import { DefaultRenderer } from 'steem-content-renderer'
export default {
  name: 'PostContent',
  props: ['post'],
  data () {
    return {
      renderer: new DefaultRenderer({
        baseUrl: 'https://hive.ausbit.dev/',
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
