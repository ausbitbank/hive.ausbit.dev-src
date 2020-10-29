<template>
    <span>
    <span v-for="prop in Object.entries(this.obj)" :key="prop.index">
    <q-list bordered separator dense v-if="!ignoreKeys.includes(prop[0])">
        <q-item>
            <q-item-section side class="text-bold">
                {{ prop[0] }}
            </q-item-section>
            <q-item-section class="text-right wrap">
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
  }
}
</script>
