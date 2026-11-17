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
import { setPageMeta } from 'src/utils/pageMeta'
export default {
  name: 'nodePage',
  components: { nodes },
  mounted () {
    setPageMeta({
      title: 'Hive API nodes — status, version and latency',
      description: 'Live status, version, block height and latency for public Hive API nodes. Pick the fastest node for hive.ausbit.dev.',
      url: '/nodes'
    })
  }
}
</script>
