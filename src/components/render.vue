<template>
  <span v-html="rendered" />
</template>
<script>
document.addEventListener('click', function (event) {
  var el = event.target
  console.log(el)
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
      el.innerHTML = `<iframe frameborder='0' allowfullscreen src='${embedSrc}'></iframe>`
      return false
    }
    const videoHref = el.getAttribute('data-video-href')
    if (videoHref) {
      window.open(videoHref)
      el.preventDefault()
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
