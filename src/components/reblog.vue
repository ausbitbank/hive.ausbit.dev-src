<template>
  <q-btn
    class="reblog-btn"
    :class="{ 'reblog-btn--active': isReblogged }"
    no-caps
    dense
    flat
    :aria-label="isReblogged ? 'Remove your reblog' : 'Reblog this post'"
    :title="isReblogged ? 'Remove your reblog' : 'Reblog this post'"
  >
    <q-icon name="repeat" size="17px" aria-hidden="true" />
    <span class="reblog-btn__label">{{ isReblogged ? 'Reblogged' : (label || 'Reblog') }}</span>
    <!-- A reblog is public on the chain, so both sharing and removing it are
         only sent after this explicit confirmation step. -->
    <q-popup-proxy v-if="loggedInUser" @show="confirming = false">
      <q-card flat class="reblog-card">
        <div class="reblog-card__head">
          <q-icon name="repeat" size="20px" class="reblog-card__icon" aria-hidden="true" />
          <div>
            <div class="reblog-card__eyebrow">{{ isReblogged ? 'Remove from your blog' : 'Share to your followers' }}</div>
            <h3 class="reblog-card__title">{{ isReblogged ? 'Remove this reblog?' : 'Reblog this post?' }}</h3>
          </div>
        </div>
        <p class="reblog-card__text">
          <template v-if="isReblogged">
            @{{ author }}'s post will disappear from your blog and feed. The post itself is not deleted.
          </template>
          <template v-else>
            @{{ author }}'s post will appear on your blog and feed. It shows publicly on your account, so reblog
            only posts you are happy to share.
          </template>
        </p>
        <div class="reblog-card__actions">
          <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
          <q-btn
            dense
            no-caps
            :color="isReblogged ? 'red' : 'primary'"
            :label="isReblogged ? 'Yes, remove' : 'Yes, reblog'"
            :loading="busy"
            @click="submit"
          />
        </div>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>
<script>
import { shortFormReblogQueueItem } from 'src/services/shortForm'

export default {
  name: 'reblog',
  props: {
    author: { type: String, required: true },
    permlink: { type: String, required: true },
    label: { type: String, default: '' },
    // Externally known state (e.g. `reblogged_by` from the chain). When true
    // the control offers to remove the reblog instead of creating one.
    reblogged: { type: Boolean, default: false }
  },
  emits: ['queued'],
  data () {
    return {
      busy: false,
      confirming: false,
      optimistic: null
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    isReblogged () {
      return this.optimistic === null ? this.reblogged : this.optimistic
    }
  },
  watch: {
    reblogged (value) {
      // A fresh chain read wins over the optimistic queued state.
      if (value === this.optimistic) this.optimistic = null
    },
    author () {
      this.optimistic = null
    },
    permlink () {
      this.optimistic = null
    }
  },
  methods: {
    async submit () {
      if (this.busy) return
      if (!this.loggedInUser) {
        this.$q.notify({ type: 'info', message: 'Log in to reblog.' })
        return
      }
      const remove = this.isReblogged
      this.busy = true
      try {
        const item = shortFormReblogQueueItem({
          username: this.loggedInUser,
          post: { author: this.author, permlink: this.permlink },
          remove
        })
        this.$hiveStore.addToQueue(item)
        this.optimistic = !remove
        this.$q.notify({
          type: remove ? 'info' : 'positive',
          message: remove
            ? 'Reblog removal queued for @' + this.author
            : 'Reblog queued for @' + this.author,
          position: 'top',
          timeout: 2500
        })
        this.$emit('queued', { author: this.author, permlink: this.permlink, reblogged: !remove })
      } catch (error) {
        this.$q.notify({ type: 'negative', message: error?.message || 'Could not queue the reblog change' })
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style scoped>
.reblog-btn.q-btn {
  min-height: 30px;
  gap: 0.3rem;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  font-size: 0.78rem;
  font-weight: 600;
}

.reblog-btn.q-btn .q-icon {
  font-size: 17px;
}

.reblog-btn.q-btn:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.reblog-btn--active.q-btn {
  border-color: rgba(129, 199, 132, 0.4);
  color: #a5d6a7;
}

.reblog-btn--active.q-btn .q-icon {
  color: #81c784;
}

.reblog-card {
  width: min(320px, 92vw);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: #10181d;
  box-shadow: var(--shadow-pop);
}

.reblog-card__head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: var(--space-3) var(--space-3) 0;
}

.reblog-card__icon {
  flex: none;
  color: #4fc3f7;
}

.reblog-card__eyebrow {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.reblog-card__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
}

.reblog-card__text {
  margin: 0.4rem 0 0;
  padding: 0 var(--space-3);
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}

.reblog-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.3rem;
  padding: var(--space-2) var(--space-3) var(--space-3);
}
</style>
