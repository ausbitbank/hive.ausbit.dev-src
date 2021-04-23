<template>
    <span>
    <span v-for="prop in Object.entries(this.obj)" :key="prop.index">
    <q-list bordered separator dense v-if="!ignoreKeys.includes(prop[0])">
        <q-item>
            <q-item-section side class="text-bold text-grey">
                {{ prop[0] }}
            </q-item-section>
            <q-item-section class="text-right wrap" v-if="['proxy', 'recovery_account', 'reset_account', 'owner'].includes(prop[0]) && prop[1] !== null">
                <router-link :to="returnAccountLink(prop[1])">{{ prop[1] }}</router-link>
            </q-item-section>
            <q-item-section class="text-right wrap" v-else-if="['url'].includes(prop[0]) && prop[1] !== null">
                <a :href="prop[1]">{{ prop[1] }}</a>
            </q-item-section>
            <q-item-section class="text-right wrap" v-else>
                {{ prop[1] }}
            </q-item-section>
        </q-item>
    </q-list>
    </span>
    </span>
</template>
<script>
export default {
  name: 'propsList',
  props: ['obj', 'ignoreKeys'],
  data () {
    return {
    }
  },
  methods: {
    returnAccountLink (account) { return '@' + account }
  }
}
</script>
