<template>
  <div id="app-root">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted () {
    // Quasar initialises its Dark plugin during app creation and can apply the
    // static `dark: true` config after the theme boot. Re-apply once the app is
    // mounted so the saved light theme wins and Quasar components get the
    // correct body--light class.
    this.$appearance?.apply(this.$q)
  }
}
</script>
