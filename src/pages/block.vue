<template>
  <q-page class="flex q-pa-md flex-center">
    <block :blockNum="blockNum" />
  </q-page>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
import block from 'components/block.vue'
export default {
  name: 'blockViewPage',
  components: {
    block
  },
  data () {
    return {
      blockNum: parseInt(this.$route.params.blockNum)
    }
  },
  computed: {
  },
  methods: {
  },
  mounted () {
    document.title = 'Block ' + this.blockNum
  }
}
</script>
