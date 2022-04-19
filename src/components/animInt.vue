<template>
  <span>{{ tidyNumber(displayValue) }}</span>
</template>
<script>
import gsap from 'gsap'
export default {
  name: 'animInt',
  props: ['value'],
  components: {},
  watch: {
    value () { gsap.to(this, { tweenValue: this.value, ease: 'elastic', onUpdate: () => { this.displayValue = this.tweenValue } }) }
  },
  methods: {
    tidyNumber (x) { if (x) { var parts = x.toString().split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.') } else { return null } }
  },
  data () {
    return {
      displayValue: this.value,
      tweenValue: this.value
    }
  }
}
</script>
