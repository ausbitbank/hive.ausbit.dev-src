<template>
    <q-card class="fixed-center" bordered>
        <q-card-section>
          <q-img src="statics/sign_in_with_hive.png" class="img-responsive" />
        </q-card-section>
        <q-separator inset spaced/>
        <q-card-section class="text-left">
          <p>Open your Hive Authentication App</p>
          <div v-if="params.link">
            <template v-if="$q.platform.is.mobile">
              <p>Scan the QR code</p>
              <center><a target="_blank" rel="noreferrer noopener" :href="params.link"><qrcode-vue :value="qrcode" size=175 level="M" background="#dbdbdb"/></a></center>
            </template>
            <template v-else>
              <p>Scan the QR code</p>
              {{ params.link }}
              <center><qrcode-vue :value="qrcode" size=175 level="M" background="#dbdbdb"/></center>
            </template>
          </div>
          <p v-if="params.uuid">HASWait.txt_checkuuid</p>
          <center><p v-if="params.uuid" class="text-bold">{{params.uuid}}</p></center>
          <p>Approve or Reject the request</p>
        </q-card-section>
        <q-linear-progress v-if="params.timeout" :value="progress" rounded color="negative" class="q-mt-sm" />
    </q-card>
</template>

<script>
// Code from arcange, slightly modified for OCD/style consistency
import QrcodeVue from 'qrcode.vue'

export default {
  components: { QrcodeVue },
  props: {
    params: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      interval: undefined,
      counter: 0,
      progress: 1
    }
  },
  computed: {
    qrcode () {
      return this.params.link
    }
  },
  mounted () {
    this.counter = this.params.timeout
    this.interval = setInterval(() => {
      if (this.counter) {
        this.counter--
        this.progress = this.counter / this.params.timeout
      }
    }, 1000)
  },

  beforeDestroy () {
    clearInterval(this.interval)
  }
}
</script>

<style scoped>
.login {
margin-top: 50px;
text-align: center;
min-width: 300px;
background: #dbdbdb;
}
</style>
