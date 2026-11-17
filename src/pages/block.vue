<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Hive block {{ blockNum }}</h1>
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
import { setPageMeta } from 'src/utils/pageMeta'
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
  watch: {
    blockNum: function () {
      this.blockNum = parseInt(this.$route.params.blockNum)
    }
  },
  computed: {
  },
  methods: {
  },
  mounted () {
    setPageMeta({
      title: 'Hive block ' + this.blockNum,
      description: 'Hive block ' + this.blockNum + ' — transactions, operations, witness and timestamp on the Hive blockchain.',
      url: '/block/' + this.blockNum
    })
  }
}
</script>
