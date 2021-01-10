<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card>
      <q-card-section>
        Testing domain resolution of .crypto and .eth top level domains
      </q-card-section>
      <q-card-section>
        <q-input label="Domain name" v-model="domain" /><q-btn dense @click="resolve(domain, 'eth')" icon="search" />
      </q-card-section>
      <q-card-section>
        {{ msg }}
      </q-card-section>
    </q-card>
  </q-page>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #884488; }
:target { background-color: #ffa; }
</style>
<script>
const { default: Resolution } = require('@unstoppabledomains/resolution')
const resolution = new Resolution()
export default {
  name: 'cryptoDomains',
  components: {
  },
  data () {
    return {
      domain: this.$route.params.domain,
      msg: ''
    }
  },
  computed: {
  },
  methods: {
    resolve (domain, currency) {
      resolution
        .addr(domain, currency)
        .then((address) => this.showMsg(this.domain + ' resolves to ' + address))
        .catch(console.error)
    },
    showMsg (newMsg) {
      this.msg = newMsg
    },
    init () {
      if (this.domain !== null) {
        this.resolve(this.domain, 'eth')
      }
    }
  },
  mounted () {
    document.title = 'Domain Resolver'
    this.init()
  }
}
</script>
