<template>
    <span>
    <q-spinner-grid size="2em" color="primary" v-if="witnesses === null" />
    <q-card flat bordered v-if="witnesses !== null">
        <q-card-section class="text-center">
            <div class="text-h5">
                Witnesses
            </div>
            <div v-for="witness in witnesses" :key="witness.index">
                <div>
                    <div>
                        <span class="text-bold">{{ witness.owner }} </span>
                        <q-badge outline :color="getVersionColor(witness.running_version)">
                            v{{ witness.running_version }}
                        </q-badge>
                        <q-tooltip content-class="bg-dark">
                            <vue-json-pretty :data="witness" :custom-value-formatter="customLinkFormatter" />
                        </q-tooltip>
                    </div>
                </div>
            </div>
        </q-card-section>
        <q-card-section style="text-center">
            <a href="https://peakd.com/me/witnesses"><q-btn icon="info" color="primary" label="Vote Witnesses" /></a>
            <div class="text-center"><router-link to="witnesses"><q-btn dense push icon="link" /></router-link></div>
        </q-card-section>
    </q-card>
    </span>
</template>
<style scoped>
a {text-decoration: none; color: #3344dd }
a:link { color: #3344dd; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
</style>
<script>
import hive from '@hiveio/hive-js'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
export default {
  name: 'witnesses',
  props: [],
  components: { VueJsonPretty },
  data () {
    return {
      witnesses: null
    }
  },
  computed: {
  },
  methods: {
    getWitnessesByVote () {
      hive.api.getWitnessesByVoteAsync('', 40)
        .then((response) => { this.witnesses = response })
    },
    customLinkFormatter (data, key, parent, defaultFormatted) {
      if (key === 'head_block_number' || key === 'last_irreversible_block_num' || key === 'last_confirmed_block_num') {
        return `<a href="/block/${data}">${data}</a>`
      } else if (key === 'url') {
        return `<a href="${data}">${data}</a>`
      } else {
        return defaultFormatted
      }
    },
    votesToHp (votes) {
      return this.numberWithCommas(((votes * this.hivePerMvests) / 1000000000000).toFixed(0))
    },
    votesToHpRaw (votes) {
      return ((votes * this.hivePerMvests) / 1000000000000).toFixed(0)
    },
    getVersionColor (version) {
      return 'green'
    }
  },
  mounted () {
    this.getWitnessesByVote()
  }
}
</script>
