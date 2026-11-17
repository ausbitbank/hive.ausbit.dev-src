<template>
  <q-page class="flex q-pa-md flex-center">
    <h1 class="sr-only">Hive API nodes</h1>
    <div>
        <nodes />
   </div>
  </q-page>
</template>
<script>
import nodes from 'components/nodes.vue'
export default {
  name: 'nodePage',
  components: { nodes },
  mounted () {
    document.title = 'Hive API Nodes'
  }
}
</script>
