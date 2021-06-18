<template>
  <div v-html="postContent" class="postview">
  </div>
</template>
<style>
.postview { overflow: visible; text-wrap: normal; word-wrap: break-word; overflow-wrap: break-word; display:flow-root}
code { text-wrap: normal; word-wrap: break-word; overflow-wrap: break-word }
pre {
 white-space: pre-wrap;
 white-space: -moz-pre-wrap;
 white-space: -pre-wrap;
 white-space: -o-pre-wrap;
 word-wrap: break-word;
}
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
img { max-width: 95%; max-height: 95%; text-align: center}
h1 { font-size: 28px; font-weight: 500; }
h2 { font-size: 26px; font-weight: 500;}
h3 { font-size: 24px; font-weight: 500;}
h4 { font-size: 22px; font-weight: 500;}
h5 { font-size: 20px; font-weight: 500;}
h6 { font-size: 18px; font-weight: 500;}
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
