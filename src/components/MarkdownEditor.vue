<template>
  <div ref="host" class="markdown-editor" />
</template>

<script>
import EasyMDE from 'easymde'
import 'easymde/dist/easymde.min.css'

export default {
  name: 'MarkdownEditor',
  props: {
    modelValue: { type: String, default: '' },
    configs: { type: Object, default: () => ({}) }
  },
  emits: ['update:modelValue'],
  mounted () {
    this.editor = new EasyMDE({
      element: this.$refs.host,
      initialValue: this.modelValue,
      ...this.configs
    })
    this.editor.codemirror.on('change', () => {
      this.$emit('update:modelValue', this.editor.value())
    })
  },
  watch: {
    modelValue (value) {
      if (this.editor && value !== this.editor.value()) {
        this.editor.value(value || '')
      }
    }
  },
  beforeUnmount () {
    if (this.editor) {
      this.editor.toTextArea()
      this.editor = null
    }
  }
}
</script>

<style>
.markdown-editor .EasyMDEContainer .CodeMirror {
  min-height: 180px;
}
</style>
