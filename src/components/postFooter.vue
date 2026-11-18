<template>
  <q-card-section dense class="post-footer" :class="{ 'post-footer--compact': compact }">
    <template v-if="!compact">
      <q-chip v-if="post.stats && post.stats.is_pinned" dense class="post-footer__chip post-footer__chip--pinned" icon="push_pin">Pinned</q-chip>
      <router-link :to="linkAccount(post.author)" class="post-footer__author" :title="'@' + post.author">
        <q-avatar size="22px" class="post-footer__avatar"><q-img :src="getHiveAvatarUrl(post.author)" :alt="'Avatar of @' + post.author" /></q-avatar>
        <span class="post-footer__author-name">@{{ post.author }}</span>
      </router-link>
      <router-link :to="linkCommunity(post.community)" v-if="post.community_title" class="post-footer__community" :title="post.community_title">
        <q-avatar size="16px" aria-hidden="true"><q-img :src="getHiveAvatarUrl(post.community)" alt="" /></q-avatar>
        <span>{{ post.community_title }}</span>
      </router-link>
      <q-chip v-if="post.author_role" dense class="post-footer__chip">{{ post.author_role }}</q-chip>
      <span v-if="post.author_title" class="post-footer__title">{{ post.author_title }}</span>
      <time class="post-footer__time" :datetime="post.created" :title="post.created">{{ timeDelta(post.created) }}</time>
    </template>
    <q-btn
      class="post-footer__action"
      dense
      :icon="compact ? 'reply' : 'comment'"
      flat
      no-caps
      :label="compact ? 'Reply' : post.children"
      :aria-label="'Reply to this ' + (compact ? 'comment' : 'post')"
      title="Reply"
      @click="replyOpen = true"
    />
    <q-btn class="post-footer__action post-footer__payout" flat dense no-caps :aria-label="'View payouts for this ' + (compact ? 'comment' : 'post')" title="Payout">
      <q-icon name="img:/statics/hive.svg" class="post-footer__payout-icon" v-if="!post.token" />
      <span title="Hive Rewards" v-if="!post.is_paidout && post.pending_payout_value">{{ post.pending_payout_value.split(' ')[0] }}</span>
      <span title="Token Rewards" v-else-if="!post.is_paidout && post.pending_token && post.precision">{{ post.pending_token / Math.pow(10, post.precision) }} {{ post.token }}</span>
      <span title="Hive Rewards" v-else>{{ post.payout }}</span>
      <q-popup-proxy v-if="!post.pending_token">
        <votes-dialog :votes="post.active_votes" :simple="true" />
      </q-popup-proxy>
    </q-btn>
    <vote v-on:Voted="showVoteEarly" :votes="post.active_votes" :author="post.author" :permlink="post.permlink" />
    <q-btn class="post-footer__action post-footer__more" dense icon="more_horiz" flat no-caps aria-label="More post actions" title="More post actions">
      <q-popup-proxy>
        <q-list dense class="post-footer__menu">
          <q-item v-if="!compact" clickable @click="postDialogVisible = true">
            <q-item-section avatar>
              <q-icon name="visibility" />
            </q-item-section>
            <q-item-section>
              View post
            </q-item-section>
          </q-item>
          <q-item clickable>
            <q-item-section avatar>
              <q-icon name="share" />
            </q-item-section>
            <q-item-section>
              <reblog :author="post.author" :permlink="post.permlink" />
            </q-item-section>
          </q-item>
          <template v-if="isOwnPost">
            <q-separator />
            <q-item clickable @click="editOpen = true">
              <q-item-section avatar>
                <q-icon name="edit" />
              </q-item-section>
              <q-item-section>
                Edit
              </q-item-section>
            </q-item>
            <q-item clickable :disable="hasReplies" @click="deleteOpen = true">
              <q-item-section avatar>
                <q-icon name="delete_outline" color="red-4" />
              </q-item-section>
              <q-item-section>
                Delete
                <div v-if="hasReplies" class="post-footer__menu-hint">Replies must be removed first</div>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-popup-proxy>
    </q-btn>
    <q-dialog v-if="!compact" v-model="postDialogVisible">
      <postDialog :post="post" />
    </q-dialog>
    <q-dialog v-model="replyOpen">
      <q-card class="post-footer__composer">
        <comment-form
          heading="Reply"
          :context="'Replying to @' + post.author"
          submit-label="Reply"
          :parent-author="post.author"
          :parent-permlink="post.permlink"
          @cancel="replyOpen = false"
          @posted="onCommentPosted"
        />
      </q-card>
    </q-dialog>
    <q-dialog v-model="editOpen">
      <q-card class="post-footer__composer">
        <comment-form
          v-if="editOpen"
          mode="edit"
          :parent-author="post.parent_author || ''"
          :parent-permlink="post.parent_permlink || post.permlink"
          :author="post.author"
          :permlink="post.permlink"
          :initial-body="post.body || ''"
          :json-metadata="post.json_metadata"
          @cancel="editOpen = false"
          @posted="onCommentPosted"
        />
      </q-card>
    </q-dialog>
    <q-dialog v-model="deleteOpen">
      <q-card class="post-footer__confirm">
        <q-card-section>
          <div class="home-eyebrow">Delete</div>
          <h2 class="home-panel__title">Delete this {{ compact ? 'comment' : 'post' }}?</h2>
          <p class="post-footer__confirm-text">
            This queues a <code>delete_comment</code> operation for
            @{{ post.author }}/{{ post.permlink }}. Deletion is permanent on chain.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="deleteOpen = false" />
          <q-btn unelevated no-caps color="negative" icon="delete_forever" label="Delete" @click="confirmDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card-section>
</template>
<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { deleteCommentQueueItem } from 'src/services/comments'
export default {
  name: 'postFooter',
  props: {
    post: { type: Object, required: true },
    compact: { type: Boolean, default: false }
  },
  emits: ['posted'],
  data () {
    return {
      votedWeight: null,
      postDialogVisible: false,
      replyOpen: false,
      editOpen: false,
      deleteOpen: false
    }
  },
  components: {
    reblog: defineAsyncComponent(() => import('components/reblog.vue')),
    vote: defineAsyncComponent(() => import('components/vote.vue')),
    postDialog: defineAsyncComponent(() => import('components/postDialog.vue')),
    commentForm: defineAsyncComponent(() => import('components/CommentForm.vue')),
    votesDialog: defineAsyncComponent(() => import('components/votesDialog.vue'))
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username }
    },
    isOwnPost () {
      return Boolean(this.loggedInUser) && this.loggedInUser === this.post.author
    },
    hasReplies () {
      return Number(this.post.children) > 0
    },
    postMeta: function () {
      if (this.post.json_metadata) {
        return this.post.json_metadata
      } else {
        return null
      }
    },
    downVotes: function () {
      return null
    },
    myVote: function () {
      if (this.votedWeight !== null) {
        return { voter: this.loggedInUser, weight: this.votedWeight, author: this.post.author, permlink: this.post.permlink, rshares: this.votedWeight }
      } else {
        if (this.post !== undefined) {
          return (this.post.active_votes || []).filter(this.filterMyVote)[0]
        } else {
          return null
        }
      }
    },
    voteIcon: function () {
      if (this.myVote !== undefined) {
        if (Math.sign(this.myVote.rshares) === 1) {
          return 'favorite'
        } else {
          return 'favorite_border'
        }
      } else {
        return 'favorite_border'
      }
    }
  },
  methods: {
    linkAccount (account) { return '/@' + account },
    linkCommunity (community) { return '/c/' + community + '/created' },
    filterMyVote (op) { return op.voter === this.loggedInUser },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    timeDelta (timestamp) {
      var now = moment.utc()
      var stamp = moment.utc(timestamp)
      var diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    showVoteEarly (weight) {
      this.votedWeight = weight
    },
    onCommentPosted () {
      this.replyOpen = false
      this.editOpen = false
      this.$emit('posted')
    },
    confirmDelete () {
      this.deleteOpen = false
      try {
        this.$hiveStore.addToQueue(deleteCommentQueueItem({
          username: this.loggedInUser,
          author: this.post.author,
          permlink: this.post.permlink
        }))
        this.$q.notify({
          type: 'positive',
          message: 'Delete queued for broadcast',
          caption: 'It is removed after the transaction is confirmed.'
        })
        this.$emit('posted')
      } catch (error) {
        console.error('Failed to queue delete', error)
        this.$q.notify({ type: 'negative', message: 'Could not queue the delete' })
      }
    }
  }
}
</script>

<style scoped>
.post-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.76rem;
}

.post-footer__author {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: #cfd8dc;
  font-weight: 600;
  text-decoration: none;
}

.post-footer__author:hover {
  color: #81d4fa;
  text-decoration: none;
}

.post-footer__avatar {
  flex: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.post-footer__author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-footer__community {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 180px;
  padding: 0.1rem 0.45rem 0.1rem 0.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  font-size: 0.7rem;
  text-decoration: none;
}

.post-footer__community span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-footer__community:hover {
  border-color: rgba(79, 195, 247, 0.4);
  color: #fff;
  text-decoration: none;
}

.post-footer__chip.q-chip {
  margin: 0;
  padding: 0 0.45rem;
  height: 22px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #90a4ae;
  font-size: 0.68rem;
}

.post-footer__chip--pinned.q-chip {
  border-color: rgba(255, 183, 77, 0.35);
  background: rgba(255, 183, 77, 0.08);
  color: #ffcc80;
}

.post-footer__title {
  min-width: 0;
  overflow: hidden;
  color: #90a4ae;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-footer__time {
  color: #78909c;
  font-size: 0.7rem;
  white-space: nowrap;
}

.post-footer__action.q-btn {
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  color: #90a4ae;
  font-size: 0.74rem;
  font-weight: 600;
}

.post-footer__action.q-btn .q-icon {
  font-size: 16px;
}

.post-footer__action.q-btn .q-btn__content .q-icon {
  color: #78909c;
}

.post-footer__action.q-btn:hover {
  border-color: var(--border-subtle);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.post-footer__action.q-btn:hover .q-btn__content .q-icon {
  color: #4fc3f7;
}

.post-footer__payout-icon {
  color: #e31337 !important;
}

.post-footer__more {
  margin-left: auto;
}

.post-footer__menu {
  min-width: 190px;
  padding: 0.25rem 0;
}

.post-footer__menu .q-item {
  min-height: 38px;
  color: #cfd8dc;
  font-size: 0.82rem;
}

.post-footer__menu .q-item__section--avatar .q-icon {
  color: #78909c;
}

.post-footer__menu .q-item:hover {
  background: rgba(79, 195, 247, 0.08);
  color: #fff;
}

.post-footer__menu-hint {
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.3;
}

.post-footer__confirm {
  width: 430px;
  max-width: 94vw;
  background: #1d1d1d;
}

.post-footer__confirm-text {
  margin: 0.5rem 0 0;
  color: #b0bec5;
  font-size: 0.82rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.post-footer--compact {
  padding: 0.2rem 0 0;
  gap: 0.25rem 0.4rem;
  border-top: 0;
  text-align: left;
}

.post-footer--compact .q-btn {
  margin-left: 0;
}

.post-footer__composer {
  width: min(720px, 94vw);
  max-height: 90vh;
  overflow: auto;
}
</style>
