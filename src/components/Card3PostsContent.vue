<template>
  <div v-html="postContent">
  </div>
</template>
<style>
.postview { overflow: auto; }
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
img { max-width: 95%; max-height: 95%; text-align: center}
.yt-container {
  position:relative;
  padding-bottom:56.25%;
  padding-top:30px;
  height:0;
  overflow:hidden;
}
.yt-container iframe, .yt-container object, .yt-container embed {
  position:absolute;
  top:0;
  left:0;
  width:100%;
  height:100%;
}
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
