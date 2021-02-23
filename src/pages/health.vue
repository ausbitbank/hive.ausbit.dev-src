<template>
    <q-page class="flex q-pa-md">
        <div class="q-pa-md row items-start q-gutter-md content-start content-stretch self-stretch col-grow justify-center">
        <witnesses :showMissed="true" :showLastBlock="true" :limit="22" :globalProps="globalProps" v-if="globalProps" />
        <q-card flat bordered>
            <q-card-section class="text-h6 text-center" v-if="globalProps">
                Participation Rate {{ (globalProps.participation_count / 128) * 100}} %
            </q-card-section>
            <q-card-section v-if="globalProps">
                <json-viewer :data="globalProps" />
                <div v-if="accountCount">Account Count : {{ tidyNumber(accountCount) }}</div>
            </q-card-section>
        </q-card>
        <nodes />
        <div>
            <span v-for="n in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="n.index">
                <block v-if="globalProps.last_irreversible_block_num !== undefined" :blockNum="globalProps.last_irreversible_block_num - n" view="simple" />
            </span>
        </div>
        </div>
    </q-page>
</template>
<script>
import witnesses from 'components/witnesses.vue'
import nodes from 'components/nodes.vue'
import jsonViewer from 'components/jsonViewer.vue'
import block from 'components/block.vue'
export default {
  name: 'health',
  components: {
    witnesses,
    jsonViewer,
    nodes,
    block
  },
  data () {
    return {
      hardforkVersion: null,
      config: null,
      accountCount: null
    }
  },
  computed: {
    globalProps: {
      get () {
        return this.$store.state.hive.globalProps
      }
    }
  },
  methods: {
    getGlobalProps () {
      this.$hive.api.getDynamicGlobalPropertiesAsync()
        .then(res => { this.globalProps = res })
    },
    tidyNumber (x) {
      var parts = x.toString().split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    }
  },
  mounted () {
    document.title = 'Hive Network Health'
    this.$store.dispatch('hive/getGlobalProps')
    this.$hive.api.getAccountCountAsync()
      .then(res => { if (res) { this.accountCount = res } })
  }
}
</script>
