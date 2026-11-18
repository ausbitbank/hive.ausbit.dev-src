<template>
  <q-btn class="reblog-btn" no-caps dense flat :disable="reblogged" :aria-label="reblogged ? 'Already reblogged' : 'Reblog this post'" :title="reblogged ? 'You already reblogged this post' : 'Reblog this post'">
    <q-icon name="repeat" size="17px" aria-hidden="true" />
    <span class="reblog-btn__label">{{ reblogged ? 'Reblogged' : (label || 'Reblog') }}</span>
    <q-popup-proxy v-if="!reblogged">
      <q-card flat class="reblog-card">
        <div class="reblog-card__head">
          <q-icon name="repeat" size="20px" class="reblog-card__icon" aria-hidden="true" />
          <div>
            <div class="reblog-card__eyebrow">Share to your followers</div>
            <h3 class="reblog-card__title">Reblog this post?</h3>
          </div>
        </div>
        <p class="reblog-card__text">@{{ author }}'s post will appear on your blog and feed. You can undo it later.</p>
        <div class="reblog-card__actions">
          <q-btn flat dense no-caps label="Cancel" color="grey" v-close-popup />
          <q-btn dense no-caps label="Yes" color="primary" @click="reblog(author, permlink)" />
        </div>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>
<script>
export default {
  name: 'reblog',
  data () {
    return {
      reblogged: false
    }
  },
  props: ['author', 'permlink', 'label'],
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    }
  },
  methods: {
    undoReblog (author, permlink) {
      // a normal reblog, but with delete: delete in the params
      var json = '["reblog",{"account":"' + this.loggedInUser + '","author":"' + author + '","permlink":"' + permlink + '", "delete":"delete"}]'
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
    },
    async reblog (author, permlink) {
      var json = '["reblog",{"account":"' + this.loggedInUser + '","author":"' + author + '","permlink":"' + permlink + '"}]'
      this.$hiveStore.addToQueue([this.loggedInUser, 'posting', ['custom_json', { required_posting_auths: [this.loggedInUser], id: 'follow', json: json }]])
      this.reblogged = true
      this.$q.notify({ type: 'positive', message: 'Reblog queued for @' + author, position: 'top', timeout: 2500 })
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

.reblog-btn.q-btn:hover:not(.disabled) {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.reblog-btn.q-btn.disabled {
  opacity: 0.6;
}

.reblog-btn.q-btn.disabled .q-icon {
  color: #81c784;
}

.reblog-card {
  width: min(300px, 92vw);
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
