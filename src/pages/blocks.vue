<template>
  <q-page class="flex q-pa-md flex-center">
    <blocks />
  </q-page>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
import blocks from 'components/blocks.vue'
export default {
  name: 'blocksViewPage',
  components: {
    blocks
  },
  data () {
    return {
    }
  },
  computed: {
  },
  methods: {
  },
  mounted () {
    document.title = 'Recent Blocks ' + this.blockNum
  }
}
</script>
