<template>
  <q-page class="flex q-pa-md flex-center">
    <block :blockNum="blockNum" />
  </q-page>
</template>
<style>
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
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
      blockNum: this.$route.params.blockNum
    }
  },
  computed: {
  },
  methods: {
  },
  mounted () {
  }
}
</script>
