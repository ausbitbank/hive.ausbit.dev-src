<template>
  <form class="comment-form" @submit.prevent="submit">
    <header class="comment-form__header">
      <q-avatar v-if="loggedInUser" size="34px">
        <q-img :src="avatarUrl(loggedInUser)" :alt="'Avatar of @' + loggedInUser" />
      </q-avatar>
      <div class="comment-form__ident">
        <div class="comment-form__title">{{ isEdit ? 'Edit comment' : heading }}</div>
        <div v-if="isEdit" class="comment-form__context">
          Editing your comment{{ parentAuthor ? ' to @' + parentAuthor : '' }} · the permlink stays the same
        </div>
        <div v-else-if="context" class="comment-form__context">{{ context }}</div>
      </div>
      <q-btn
        flat
        dense
        no-caps
        class="comment-form__preview-toggle"
        :icon="preview ? 'edit' : 'visibility'"
        :label="$q.screen.gt.xs ? (preview ? 'Write' : 'Preview') : ''"
        :aria-label="preview ? 'Write comment' : 'Preview comment'"
        :title="preview ? 'Write comment' : 'Preview comment'"
        :disable="!preview && !body.trim()"
        @click="preview = !preview"
      />
    </header>

    <div v-if="!preview" class="comment-form__editor-wrap">
      <div class="comment-form__toolbar" role="toolbar" aria-label="Comment formatting">
        <q-btn flat dense round size="sm" icon="format_bold" aria-label="Bold" title="Bold" @click="wrapSelection('**', '**', 'bold text')" />
        <q-btn flat dense round size="sm" icon="format_italic" aria-label="Italic" title="Italic" @click="wrapSelection('*', '*', 'italic text')" />
        <q-btn flat dense round size="sm" icon="title" aria-label="Heading" title="Heading" @click="prefixLines('## ')" />
        <q-btn flat dense round size="sm" icon="format_quote" aria-label="Quote" title="Quote" @click="prefixLines('> ')" />
        <q-btn flat dense round size="sm" icon="format_list_bulleted" aria-label="Bullet list" title="Bullet list" @click="prefixLines('- ')" />
        <q-btn flat dense round size="sm" icon="format_list_numbered" aria-label="Numbered list" title="Numbered list" @click="prefixLines('1. ')" />
        <q-separator vertical class="q-mx-xs" />
        <q-btn flat dense round size="sm" icon="link" aria-label="Insert link" title="Insert link" @click="wrapSelection('[', '](https://)', 'link text')" />
        <q-btn flat dense round size="sm" icon="image" aria-label="Insert image" title="Insert image" @click="wrapSelection('![', '](https://)', 'image description')" />
        <q-btn flat dense round size="sm" icon="code" aria-label="Inline code" title="Inline code" @click="wrapSelection('`', '`', 'code')" />
        <span class="comment-form__count" :title="body.length + ' characters'">{{ body.length }}</span>
      </div>

      <textarea
        ref="textarea"
        v-model="body"
        class="comment-form__textarea"
        :placeholder="placeholder"
        :aria-label="placeholder"
        rows="8"
        @keydown.ctrl.enter.prevent="submit"
        @keydown.meta.enter.prevent="submit"
      />

      <div class="comment-form__hint">
        <span>Markdown supported</span>
        <span>Ctrl+Enter to {{ submitText.toLowerCase() }}</span>
      </div>
    </div>

    <div v-else class="comment-form__preview">
      <render v-if="body.trim()" :input="body" class="postbody" />
      <div v-else class="comment-form__empty">Nothing to preview yet.</div>
    </div>

    <footer class="comment-form__actions">
      <span class="comment-form__auth">
        <template v-if="loggedInUser">Posting as @{{ loggedInUser }}</template>
        <template v-else>Log in to join the conversation.</template>
      </span>
      <q-space />
      <q-btn flat no-caps label="Cancel" @click="$emit('cancel')" />
      <q-btn
        unelevated
        no-caps
        color="primary"
        :disable="!canSubmit"
        :loading="submitting"
        :icon="isEdit ? 'save' : 'send'"
        :label="submitText"
        @click="submit"
      />
    </footer>
  </form>
</template>

<style scoped>
.comment-form {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  text-align: left;
}

.comment-form__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.95rem 1rem 0.75rem;
}

.comment-form__ident {
  flex: 1;
  min-width: 0;
}

.comment-form__preview-toggle {
  flex: none;
  margin-left: auto;
}

.comment-form__title {
  font-size: 1rem;
  font-weight: 600;
}

.comment-form__context {
  margin-top: 0.1rem;
  color: #90a4ae;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.comment-form__editor-wrap {
  padding: 0 1rem;
}

.comment-form__toolbar {
  display: flex;
  align-items: center;
  gap: 0.05rem;
  overflow-x: auto;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: rgba(255, 255, 255, 0.035);
}

.comment-form__toolbar .q-btn {
  flex: none;
}

.comment-form__count {
  flex: none;
  margin-left: auto;
  padding: 0 0.3rem;
  color: #90a4ae;
  font-size: 0.72rem;
}

.comment-form__textarea {
  display: block;
  width: 100%;
  min-height: 180px;
  max-height: 50vh;
  resize: vertical;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--border-subtle);
  border-top: 0;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: #0d1419;
  color: #e4eaed;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.65;
}

.comment-form__textarea:focus {
  outline: 2px solid rgba(79, 195, 247, 0.6);
  outline-offset: -1px;
}

.comment-form__hint {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.15rem 0;
  color: #78909c;
  font-size: 0.7rem;
}

.comment-form__preview {
  min-height: 180px;
  margin: 0 1rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.comment-form__empty {
  color: #78909c;
}

.comment-form__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.9rem 1rem 1rem;
}

.comment-form__auth {
  color: #78909c;
  font-size: 0.74rem;
}

@media (max-width: 599px) {
  .comment-form__header {
    padding: 0.8rem 0.8rem 0.6rem;
  }

  .comment-form__editor-wrap {
    padding: 0 0.8rem;
  }

  .comment-form__preview {
    margin: 0 0.8rem;
  }

  .comment-form__actions {
    justify-content: flex-end;
    padding: 0.8rem;
  }

  .comment-form__auth {
    flex-basis: 100%;
  }

  .comment-form__textarea {
    min-height: 160px;
  }
}
</style>

<script>
import render from 'components/render.vue'
import { commentQueueItem } from 'src/services/comments'

export default {
  name: 'commentForm',
  components: { render },
  props: {
    parentAuthor: { type: String, required: true },
    parentPermlink: { type: String, required: true },
    heading: { type: String, default: 'Write a comment' },
    context: { type: String, default: '' },
    submitLabel: { type: String, default: 'Reply' },
    placeholder: { type: String, default: 'Write a comment…' },
    autofocus: { type: Boolean, default: true },
    /**
     * Edit mode: existing comment text to load. The permlink and parent fields
     * must describe the comment being edited, not the reply target.
     */
    mode: { type: String, default: 'create' },
    initialBody: { type: String, default: '' },
    author: { type: String, default: '' },
    permlink: { type: String, default: '' },
    jsonMetadata: { type: [String, Object], default: null }
  },
  emits: ['posted', 'cancel'],
  data () {
    return {
      body: this.mode === 'edit' ? String(this.initialBody || '') : '',
      preview: false,
      submitting: false
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    isEdit () {
      return this.mode === 'edit'
    },
    canSubmit () {
      if (!this.loggedInUser || this.submitting) return false
      if (!this.body.trim().length) return false
      if (!this.isEdit) return true
      // An edit must actually change something.
      return this.body.trim() !== String(this.initialBody || '').trim()
    },
    submitText () {
      return this.isEdit ? 'Save edit' : this.submitLabel
    }
  },
  mounted () {
    if (this.autofocus) {
      this.$nextTick(() => this.$refs.textarea?.focus())
    }
  },
  methods: {
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    wrapSelection (before, after, placeholder) {
      const textarea = this.$refs.textarea
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = this.body.slice(start, end) || placeholder
      this.body = this.body.slice(0, start) + before + selected + after + this.body.slice(end)
      this.$nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
      })
    },
    prefixLines (prefix) {
      const textarea = this.$refs.textarea
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const lineStart = this.body.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      let blockEnd = end > start ? end : this.body.indexOf('\n', start)
      if (blockEnd === -1) blockEnd = this.body.length
      const segment = this.body.slice(lineStart, blockEnd)
      const replacement = segment.split('\n').map(line => prefix + line).join('\n')
      this.body = this.body.slice(0, lineStart) + replacement + this.body.slice(blockEnd)
      this.$nextTick(() => {
        textarea.focus()
        const position = lineStart + replacement.length
        textarea.setSelectionRange(position, position)
      })
    },
    parseMetadata () {
      const value = this.jsonMetadata
      if (!value) return null
      if (typeof value === 'object') return value
      try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    },
    submit () {
      if (!this.canSubmit) return

      const username = this.loggedInUser
      const body = this.body.trim()
      if (!body) return

      this.submitting = true
      try {
        const permlink = this.isEdit
          ? this.permlink
          : this.$hive.formatter.commentPermlink(this.parentAuthor, this.parentPermlink)

        this.$hiveStore.addToQueue(commentQueueItem({
          username,
          parentAuthor: this.isEdit ? this.author : this.parentAuthor,
          parentPermlink: this.parentPermlink,
          body,
          permlink,
          mode: this.isEdit ? 'edit' : 'create',
          previousMetadata: this.parseMetadata(),
          beneficiaries: this.$hiveStore.user.settings.beneficiary || []
        }))

        this.$q.notify({
          type: 'positive',
          message: this.isEdit ? 'Edit queued for broadcast' : this.submitText + ' queued for broadcast',
          caption: 'It will appear after the transaction is confirmed.'
        })
        if (!this.isEdit) this.body = ''
        this.preview = false
        this.$emit('posted', { permlink, body, mode: this.mode })
      } catch (error) {
        console.error('Failed to queue comment', error)
        this.$q.notify({ type: 'negative', message: 'Could not queue the comment' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>
