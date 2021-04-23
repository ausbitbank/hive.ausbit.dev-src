<template>
  <span v-html="rendered" />
</template>
<script>
document.addEventListener('click', function (event) {
  var el = event.target
  while (el.tagName !== 'A') {
    if (!el.parentNode) {
      break
    }
    el = el.parentNode
  }
  if (!el || el.tagName !== 'A') { return null }
  if (el.classList.contains('markdown-video-link')) {
    const embedSrc = el.getAttribute('data-embed-src')
    if (embedSrc) {
      el.innerHTML = `<div style="position:relative;padding-top:56.25%;"><iframe frameborder='0' style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen src='${embedSrc}'></iframe></div>`
      // el.innerHTML = `<video id='my-video' class='video-js' controls preload='auto'><source src='${embedSrc}' type='video/mp4' /></video>`
      return false
    }
    const videoHref = el.getAttribute('data-video-href')
    if (videoHref) {
      el.innerHTML = `<video id='my-video' class='video-js' controls preload='auto'><source src='${videoHref}' type='video/mp4' /></video>`
      // window.open(videoHref)
      // el.preventDefault()
      return false
    }
  }
})
import { renderPostBody } from '@ecency/render-helper'
export default {
  name: 'render',
  data () {
    return {
      rendered: ''
    }
  },
  props: ['input'],
  methods: {
    render () {
      this.rendered = renderPostBody(this.input, false, false)
    }
  },
  mounted () {
    this.render()
  }
}
</script>
