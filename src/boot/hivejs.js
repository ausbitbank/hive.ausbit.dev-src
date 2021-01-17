import Vue from 'vue'
import hive from '@hiveio/hive-js'
hive.api.setOptions({ url: 'https://api.hive.blog' })
hive.config.set('alternative_api_endpoints', ['https://rpc.ausbit.dev', 'https://api.deathwing.me', 'https://hived.emre.sh', 'https://hive.roelandp.nl', 'https://rpc.ecency.com', 'https://api.hivekings.com', 'https://hive-api.arcange.eu', 'https://hived.privex.io', 'https://hive.fin.3speak.co', 'https://api.hive.blog'])
Vue.prototype.$hive = hive
