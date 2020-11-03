<template>
    <vue-json-pretty :data="data" :customValueFormatter="customLinkFormatter" :deep="deep" :showLength="showLength" />
</template>
<script>
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import DOMPurify from 'dompurify'
export default {
  name: 'jsonViewer',
  components: { VueJsonPretty },
  props: {
    data: {
      // type: Object,
      required: true
    },
    deep: {
      type: Number,
      required: false,
      default: Infinity
    },
    showLength: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  methods: {
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (['head_block_number', 'last_irreversible_block_num', 'last_confirmed_block_num'].includes(key)) {
        return `<a href="/block/${data}">${data}</a>`
      } else if (['url', 'profile_image', 'cover_image'].includes(key)) {
        return `<a href="${data}">${data}</a>`
      } else if (['to', 'from', 'comment_author', 'curator', 'author', 'parent_author', 'voter', 'account', 'producer', 'from_account', 'to_account', 'new_account_name', 'creator', 'producer', 'receiver', 'payer', 'treasury'].includes(key)) {
        return `<a href="/@${data}">${data}</a>`
      } else if (['permlink', 'parent_permlink'].includes(key)) {
        return `<a href="/@${parent.author}/${parent.permlink}">${data}</a>`
      } else if (['json_metadata', 'json'].includes(key)) {
        return DOMPurify.sanitize(defaultFormatted)
      } else if (['comment_permlink'].includes(key)) {
        return `<a href="/@${parent.comment_author}/${parent.comment_permlink}">${data}</a>`
      } else {
        return DOMPurify.sanitize(defaultFormatted)
      }
    }
  }
}
</script>
