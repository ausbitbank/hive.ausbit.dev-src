<template>
  <q-page class="post-page">
    <div class="post-shell">
      <div class="post-error" v-if="error !== null">
        <q-card flat bordered class="post-state-card">
          <q-icon name="error_outline" size="2.2em" color="orange" aria-hidden="true" />
          <h1 class="post-state-card__title">Post not available</h1>
          <p class="post-state-card__text">{{ error.name }}: {{ error.message }}</p>
          <p v-if="error.data" class="post-state-card__text">{{ error.data }}</p>
          <q-btn
            v-if="error.cause && error.cause.code === -31999 && typeof error.cause.data === 'string' && error.cause.data.startsWith('Post ')"
            class="q-mb-md"
            label="Find the transaction"
            color="primary"
            icon="search"
            no-caps
            @click="findDeletedPost(error.data)"
          />
          <div class="row q-gutter-sm justify-center">
            <q-btn outline no-caps color="primary" icon="arrow_back" label="Back to browse" to="/created" />
            <q-btn flat no-caps color="primary" icon="refresh" label="Retry" @click="init" />
          </div>
        </q-card>
      </div>

      <div v-else-if="!post" class="post-loading" aria-label="Loading post" role="status" aria-busy="true">
        <div class="post-loading__article">
          <q-skeleton type="rect" height="30px" width="68%" />
          <q-skeleton type="rect" height="16px" width="42%" class="q-mt-md" />
          <q-skeleton type="rect" height="16px" width="30%" class="q-mt-sm" />
          <q-skeleton type="rect" height="420px" class="q-mt-lg" />
        </div>
        <aside class="post-loading__sidebar" aria-hidden="true">
          <q-skeleton type="rect" height="190px" />
          <q-skeleton type="rect" height="230px" />
        </aside>
      </div>

      <profile-skin v-else :account="account" :author="author" context="post" :reputation="post && post.author_reputation">
      <div v-if="postModeration.primary" class="post-moderation">
        <moderation-notice
          :decision="postModeration"
          :show-disclosure="moderationStore && moderationStore.shouldDisclose"
          @dismiss-disclosure="moderationMarkDisclosure"
          @show="moderationShowItem(postModeration)"
          @show-author="moderationShowAuthor(postModeration)"
          @hide-author="moderationHideAuthor(postModeration)"
          @ignore-voter="moderationToggleIgnoredVoter"
        />
      </div>
      <div class="post-grid">
          <article class="post-article">
            <q-card flat bordered class="post-article-card">
              <header class="post-hero">
                <div class="post-hero__eyebrow">
                  <router-link v-if="communityTitle" :to="linkCommunity(communityName)">
                    {{ communityTitle }}
                  </router-link>
                  <router-link v-else-if="post.category" :to="linkDetect(post.category)">
                    {{ post.category }}
                  </router-link>
                  <span class="post-hero__dot">·</span>
                  <time :datetime="post.created">{{ formattedCreated }}</time>
                  <template v-if="isEdited">
                    <span class="post-hero__dot">·</span>
                    <span class="post-hero__muted">edited {{ timeDelta(post.last_update) }}</span>
                  </template>
                </div>

                <h1 class="post-hero__title">{{ stripHtml(post.title) || ('Comment by @' + author) }}</h1>

                <div class="post-reply-to" v-if="post.parent_author">
                  Reply to
                  <router-link :to="linkAccount(post.parent_author)">{{ post.parent_author }}</router-link> /
                  <router-link :to="linkPost(post.parent_author, post.parent_permlink)">{{ post.parent_permlink }}</router-link>
                </div>

                <div v-if="crossPostSource" class="post-crosspost">
                  <q-icon name="repeat" size="15px" aria-hidden="true" />
                  <span>Cross-post of</span>
                  <router-link :to="linkPost(crossPostSource.author, crossPostSource.permlink)">
                    @{{ crossPostSource.author }}/{{ crossPostSource.permlink }}
                  </router-link>
                </div>

                <div v-if="hasAiDisclosure || isPortfolio || isCollection || countdownLabel" class="post-badges">
                  <span v-if="hasAiDisclosure" class="post-badge post-badge--ai" tabindex="0">
                    <q-icon name="smart_toy" size="14px" aria-hidden="true" />
                    AI-assisted
                    <q-tooltip>{{ aiToolLabels.join(' · ') }}</q-tooltip>
                  </span>
                  <span v-if="isPortfolio" class="post-badge">
                    <q-icon name="collections" size="14px" aria-hidden="true" />
                    Portfolio
                  </span>
                  <span v-if="isCollection" class="post-badge">
                    <q-icon name="library_books" size="14px" aria-hidden="true" />
                    Collection
                  </span>
                  <span v-if="countdownLabel" class="post-badge post-badge--countdown">
                    <q-icon name="timer" size="14px" aria-hidden="true" />
                    {{ countdownLabel }}
                  </span>
                </div>

                <div class="post-hero__meta">
                  <router-link :to="linkAccount(author)" class="post-author">
                    <q-avatar size="32px">
                      <q-img :src="GetHiveAvatarUrl(author)" :alt="'Avatar of @' + author" />
                    </q-avatar>
                    <span class="post-author__name">@{{ author }}</span>
                    <span class="post-author__rep" :title="'Reputation ' + reputation">{{ reputation }}</span>
                  </router-link>
                  <span class="post-hero__dot">·</span>
                  <span>{{ readingTime }} min read</span>
                  <span class="post-hero__dot">·</span>
                  <span>{{ tidyNumber(wordCount) }} words</span>
                  <span class="post-hero__dot">·</span>
                  <button type="button" class="post-hero__linkbtn" @click="scrollToComments">{{ commentCount }} comments</button>
                  <template v-if="reblogCount">
                    <span class="post-hero__dot">·</span>
                    <span>{{ reblogCount }} reblogs</span>
                  </template>
                </div>

                <div class="post-hero__actions">
                  <vote
                    v-if="loggedInUser"
                    :author="author"
                    :permlink="permlink"
                    :votes="post.active_votes || []"
                    @Voted="refreshPost"
                  />
                  <q-btn
                    v-else
                    class="vote-control__btn vote-control__btn--up"
                    size="sm"
                    dense
                    flat
                    no-caps
                    icon="thumb_up_off_alt"
                    :label="voteCount + ' votes'"
                    aria-label="View votes on this post"
                    @click="showVotes = true"
                  />
                  <q-btn class="post-action-btn" v-if="loggedInUser" flat dense no-caps icon="comment" label="Reply" @click="showReply = true" />
                  <q-btn class="post-action-btn" flat dense no-caps icon="share" label="Share" @click="showShareDialog = true" />
                  <reblog class="post-action-btn" v-if="loggedInUser" label="Reblog this post" :author="author" :permlink="permlink" :reblogged="alreadyReblogged" />
                </div>
              </header>

              <div class="post-body-section">
                <render v-if="displayBody" :input="displayBody" class="postbody" preload />
                <VaultLockedSection
                  v-if="vaultMetadata"
                  :metadata="vaultMetadata"
                  :plaintext="vaultPlaintext"
                  :state="vaultState"
                  :plan="vaultPlan"
                  :blog="blogAccountName"
                  :reader-account="readerAccount"
                  @subscribe="onVaultSubscribe"
                  @restore="onVaultRestore"
                  @retry="onVaultRetry"
                />
                <q-skeleton v-if="!displayBody && !vaultMetadata" type="rect" height="220px" />
              </div>

              <footer v-if="postTags.length" class="post-tags" aria-label="Post tags">
                <template v-for="tag in postTags" :key="tag">
                  <router-link v-if="linkTag(tag)" :to="linkTag(tag)" class="post-tag">#{{ tag }}</router-link>
                  <span v-else class="post-tag" :title="'#' + tag + ' is not a valid Hive tag'">#{{ tag }}</span>
                </template>
              </footer>
            </q-card>
          </article>

        <aside class="post-sidebar" aria-label="Post information">
          <q-card flat bordered class="home-card post-side-card post-author-card">
            <div class="post-side-card__head">
              <h2 class="post-side-card__title">Author</h2>
            </div>
            <div class="post-side-card__body">
              <div class="post-author-card__top">
                <q-avatar size="48px" class="post-author-card__avatar">
                  <q-img :src="GetHiveAvatarUrl(author)" :alt="'Avatar of @' + author" />
                </q-avatar>
                <div class="post-author-card__ident">
                  <span v-if="displayAuthor" class="post-author-card__display">{{ displayAuthor }}</span>
                  <router-link :to="linkAccount(author)" class="post-author-card__name" :title="'@' + author">@{{ author }}</router-link>
                  <span class="post-author-card__rep">Reputation <strong>{{ reputation }}</strong></span>
                </div>
              </div>
              <p v-if="authorAbout" class="post-author-card__about">{{ authorAbout }}</p>
              <q-btn outline no-caps color="primary" icon="person" label="Open profile" :to="linkAccount(author)" class="post-side-card__action" />
            </div>
          </q-card>

          <q-card flat bordered class="home-card post-side-card">
            <div class="post-side-card__head">
              <h2 class="post-side-card__title">Post details</h2>
              <span class="post-side-card__hint">On-chain</span>
            </div>
            <div class="post-side-card__body">
              <dl class="post-facts">
                <div class="post-fact">
                  <dt><q-icon name="calendar_today" aria-hidden="true" /><span>Published</span></dt>
                  <dd><time :datetime="post.created">{{ formattedCreated }}</time></dd>
                </div>
                <div class="post-fact" v-if="isEdited">
                  <dt><q-icon name="edit" aria-hidden="true" /><span>Edited</span></dt>
                  <dd>{{ timeDelta(post.last_update) }}</dd>
                </div>
                <div class="post-fact" v-if="communityTitle">
                  <dt><q-icon name="forum" aria-hidden="true" /><span>Community</span></dt>
                  <dd :title="communityTitle"><router-link :to="linkCommunity(communityName)">{{ communityTitle }}</router-link></dd>
                </div>
                <div class="post-fact" v-if="post.category && post.category !== communityName">
                  <dt><q-icon name="label" aria-hidden="true" /><span>Tag</span></dt>
                  <dd :title="post.category">
                    <router-link v-if="linkDetect(post.category)" :to="linkDetect(post.category)">{{ post.category }}</router-link>
                    <span v-else :title="'#' + post.category + ' is not a valid Hive tag'">{{ post.category }}</span>
                  </dd>
                </div>
                <div class="post-fact" v-if="postMeta && postMeta.app">
                  <dt><q-icon name="fingerprint" aria-hidden="true" /><span>App</span></dt>
                  <dd :title="postMeta.app">{{ postMeta.app }}</dd>
                </div>
                <div class="post-fact">
                  <dt><q-icon name="thumb_up" aria-hidden="true" /><span>Votes</span></dt>
                  <dd><button type="button" class="post-fact__button" @click="showVotes = true">{{ tidyNumber(voteCount) }}</button></dd>
                </div>
                <div class="post-fact" v-if="payoutDisplay">
                  <dt><q-icon name="monetization_on" aria-hidden="true" /><span>Payout</span></dt>
                  <dd>{{ payoutDisplay }}</dd>
                </div>
                <div
                  class="post-fact"
                  v-for="bene in post.beneficiaries || []"
                  :key="bene.account + '-' + bene.weight"
                >
                  <dt><q-icon name="alt_route" aria-hidden="true" /><span>Beneficiary</span></dt>
                  <dd :title="'@' + bene.account">@{{ bene.account }} {{ bene.weight / 100 }}%</dd>
                </div>
              </dl>

              <ul v-if="postNotices.length" class="post-notices" aria-label="Post reward notices">
                <li v-for="notice in postNotices" :key="notice.text" class="post-notice">
                  <q-icon :name="notice.icon" size="16px" aria-hidden="true" />
                  <span>{{ notice.text }}</span>
                </li>
              </ul>
            </div>
          </q-card>

          <q-card flat bordered class="home-card post-side-card">
            <div class="post-side-card__head">
              <h2 class="post-side-card__title">Actions</h2>
            </div>
            <div class="post-side-card__body post-side-card__actions">
              <sats-zap-button :account="post.author" :permlink="post.permlink" />
              <tip-button :account="post.author" />
              <template v-if="isOwnPost">
                <q-btn outline no-caps color="primary" icon="edit" label="Edit post" class="post-side-card__action" :to="editLink" />
                <q-btn outline no-caps color="negative" icon="delete_outline" label="Delete post" class="post-side-card__action" :disable="hasReplies" @click="deleteOpen = true" />
                <span v-if="hasReplies" class="post-side-card__hint">Replies must be removed before this post can be deleted.</span>
              </template>
              <q-btn outline no-caps color="primary" icon="code" label="Full post metadata" class="post-side-card__action">
                <q-popup-proxy>
                  <q-card class="post-meta-card">
                    <json-viewer :data="post" :deep="1" title="Post metadata" />
                  </q-card>
                </q-popup-proxy>
              </q-btn>
            </div>
          </q-card>

          <nav class="post-external" aria-label="View this post on other Hive front ends">
            <span class="post-external__label">View on</span>
            <a :href="linkHiveBlogPost(author, permlink)" target="_blank" rel="noopener noreferrer">Hive.blog</a>
            <span class="post-external__dot" aria-hidden="true">·</span>
            <a :href="linkPeakdPost(author, permlink)" target="_blank" rel="noopener noreferrer">PeakD</a>
            <span class="post-external__dot" aria-hidden="true">·</span>
            <a :href="linkEcencyPost(author, permlink)" target="_blank" rel="noopener noreferrer">Ecency</a>
          </nav>
        </aside>

        <comments class="post-comments" :author="author" :permlink="permlink" :comment-count="commentCount" :refresh-token="commentRefreshToken" />

        <section v-if="similarPosts.length" class="home-card home-panel post-similar" aria-labelledby="post-similar-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Semantic</div>
              <h2 id="post-similar-title" class="home-panel__title">Similar posts</h2>
            </div>
          </div>
          <div class="home-panel__body post-similar__body">
            <ul class="post-similar__list">
              <li v-for="item in similarPosts" :key="item.author + '/' + item.permlink">
                <router-link :to="'/@' + item.author + '/' + item.permlink" class="post-similar__link">
                  <span class="post-similar__title">{{ item.title || excerpt(item.body) || 'Untitled post' }}</span>
                  <span class="post-similar__meta">@{{ item.author }} · {{ item.created ? createdLabel(item.created) : 'Hive' }}</span>
                </router-link>
              </li>
            </ul>
          </div>
        </section>
      </div>
      </profile-skin>
    </div>

    <q-dialog v-model="showVotes">
      <votes-dialog v-if="post" :votes="post.active_votes || []" :author="post.author" :permlink="post.permlink" />
    </q-dialog>

    <q-dialog v-model="showReply">
      <q-card class="post-dialog-card post-comment-card">
        <comment-form
          v-if="post"
          heading="Reply to post"
          :context="'Replying to @' + author"
          submit-label="Reply"
          :parent-author="post.author"
          :parent-permlink="post.permlink"
          @cancel="showReply = false"
          @posted="onCommentPosted"
        />
      </q-card>
    </q-dialog>

    <q-dialog v-model="showShareDialog">
      <q-card class="post-share-card">
        <q-card-section>
          <div class="post-share-card__title">Share this post</div>
          <shareButtons v-if="post" :title="post.title" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteOpen">
      <q-card class="post-delete-card">
        <q-card-section>
          <div class="home-eyebrow">Delete</div>
          <h2 class="home-panel__title">Delete this post?</h2>
          <p class="post-delete-card__text">
            This queues a <code>delete_comment</code> operation for
            @{{ author }}/{{ permlink }}. Deletion is permanent on chain, and the
            URL stops resolving.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="deleteOpen = false" />
          <q-btn unelevated no-caps color="negative" icon="delete_forever" label="Delete" @click="confirmDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.post-page {
  min-width: 0;
}

.post-shell {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.post-moderation {
  width: 100%;
  max-width: 960px;
  margin: var(--space-3) auto 0;
  padding: 0 var(--space-3);
}

.post-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 312px;
  grid-template-areas:
    "article sidebar"
    "comments sidebar"
    "similar similar";
  align-items: start;
  gap: var(--space-4);
}

.post-similar {
  grid-area: similar;
}

.post-article {
  grid-area: article;
  min-width: 0;
}

.post-grid .post-comments {
  grid-area: comments;
  margin-top: 0;
}

.post-article-card {
  overflow: hidden;
}

.post-hero {
  padding: 1.3rem 1.5rem 1rem;
}

.post-hero__eyebrow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.post-hero__eyebrow a {
  color: var(--c-link);
  font-weight: 600;
  text-decoration: none;
}

.post-hero__dot {
  color: var(--c-text-faint);
}

.post-hero__muted {
  letter-spacing: 0;
  text-transform: none;
}

.post-hero__title {
  margin: 0.55rem 0 0.7rem;
  font-size: clamp(1.5rem, 3vw, 2.05rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
}

.post-hero__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  color: var(--c-text-muted);
  font-size: 0.85rem;
}

.post-author {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
}

.post-author__name {
  color: var(--c-text);
}

.post-author__rep {
  padding: 0 0.35rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-muted);
  font-size: 0.72rem;
  font-weight: 500;
}

.post-hero__linkbtn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.14em;
}

.post-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.9rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-subtle);
}

.post-hero__actions > * {
  flex: none;
}

.post-hero__actions :deep(.post-action-btn.q-btn) {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.post-hero__actions :deep(.post-action-btn.q-btn:hover) {
  border-color: color-mix(in srgb, var(--c-text) 22%, transparent);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
  color: var(--c-text-strong);
}

.post-body-section {
  padding: 1.25rem 1.5rem 1.6rem;
}

.post-reply-to {
  margin-bottom: 0.7rem;
  color: var(--c-text-muted);
  font-size: 0.82rem;
}

.post-crosspost {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.7rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 28%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.post-crosspost a {
  color: var(--c-link-hover);
  overflow-wrap: anywhere;
}

.post-badges {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.7rem;
}

.post-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  color: var(--c-text-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.post-badge--ai {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  color: var(--c-link-hover);
  cursor: help;
}

.post-badge--countdown {
  border-color: color-mix(in srgb, var(--c-warning) 30%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
  color: var(--c-warning-soft);
  font-variant-numeric: tabular-nums;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.8rem 1.5rem 1rem;
  border-top: 1px solid var(--border-subtle);
}

.post-tag {
  padding: 0.12rem 0.5rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
  color: var(--c-text-muted) !important;
  font-size: 0.74rem;
  text-decoration: none;
}

.post-tag:hover {
  background: color-mix(in srgb, var(--c-link) 16%, transparent);
  color: var(--c-link-hover) !important;
}

.post-sidebar {
  position: sticky;
  top: 64px;
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.post-side-card {
  overflow: hidden;
  flex: none;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.post-side-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 10px var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.post-side-card__title {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.3;
  text-transform: uppercase;
}

.post-side-card__hint {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.3;
  text-decoration: none;
  white-space: nowrap;
}

.post-side-card__body {
  padding: var(--space-3);
}

.post-author-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.post-author-card__avatar {
  flex: none;
  border: 1px solid var(--border-subtle);
}

.post-author-card__ident {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.post-author-card__name {
  display: block;
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-author-card__display {
  display: block;
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-author-card__name:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.post-author-card__rep {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  line-height: 1.3;
}

.post-author-card__rep strong {
  color: var(--c-text-muted);
  font-weight: 600;
}

.post-author-card__about {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 10px 0 0;
  color: var(--c-text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.post-side-card__action.q-btn {
  width: 100%;
  min-height: 38px;
  margin-top: var(--space-3);
}

.post-facts {
  margin: 0;
}

.post-fact {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-2);
  padding: 7px 0;
  color: var(--c-text-muted);
  font-size: 0.8rem;
  line-height: 1.35;
}

.post-fact + .post-fact {
  border-top: 1px solid color-mix(in srgb, var(--c-text) 5%, transparent);
}

.post-fact dt {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.post-fact dt .q-icon {
  flex: none;
  color: var(--c-text-faint);
  font-size: 15px;
}

.post-fact dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--c-text-soft);
  font-variant-numeric: tabular-nums;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-fact dd a {
  color: var(--c-link);
  text-decoration: none;
}

.post-fact dd a:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.post-fact__button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  font-variant-numeric: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.14em;
}

.post-fact__button:hover {
  color: var(--c-link-hover);
}

.post-notices {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) 0 0;
  border-top: 1px solid var(--border-subtle);
  list-style: none;
}

.post-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  color: var(--c-text-muted);
  font-size: 0.75rem;
  line-height: 1.35;
}

.post-notice .q-icon {
  flex: none;
  margin-top: 1px;
  color: var(--c-warning);
}

.post-side-card__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.post-side-card__actions :deep(.q-btn) {
  width: 100%;
  min-height: 38px;
  border-radius: var(--radius-pill);
  border-color: color-mix(in srgb, var(--c-text) 14%, transparent);
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
}

.post-side-card__actions :deep(.q-btn:hover) {
  border-color: color-mix(in srgb, var(--c-link) 45%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.post-side-card__actions :deep(.post-side-card__action) {
  margin-top: 0;
}

.post-meta-card {
  width: min(720px, 92vw);
  max-height: 80vh;
  overflow: auto;
}

.post-external {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  line-height: 1.4;
}

.post-external__label {
  color: var(--c-text-faint);
}

.post-external__dot {
  color: var(--c-text-faint);
}

.post-external a {
  color: var(--c-link);
  text-decoration: none;
}

.post-external a:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.post-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.post-loading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 312px;
  align-items: start;
  gap: var(--space-4);
  width: 100%;
  min-height: 72vh;
}

.post-loading__article,
.post-loading__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.post-loading__article {
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

@media (max-width: 1023px) {
  .post-loading {
    grid-template-columns: minmax(0, 1fr);
  }

  .post-loading__sidebar {
    display: none;
  }
}

.post-state-card__title {
  margin: 0;
  font-size: 1.35rem;
}

.post-state-card__text {
  margin: 0;
  color: var(--c-text-muted);
  overflow-wrap: anywhere;
}

.post-error {
  max-width: 680px;
  margin: 2rem auto;
}

.post-dialog-card {
  width: min(720px, 94vw);
}

.post-comment-card {
  max-height: 90vh;
  overflow: auto;
}

.post-share-card {
  width: min(540px, 94vw);
}

.post-share-card__title {
  margin-bottom: var(--space-2);
  font-weight: 600;
}

.post-side-card__hint {
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.45;
}

.post-delete-card {
  width: 430px;
  max-width: 94vw;
  background: var(--c-surface-1);
}

.post-delete-card__text {
  margin: 0.5rem 0 0;
  color: var(--c-text-muted);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

@media (max-width: 1023px) {
  .post-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "article"
      "sidebar"
      "comments"
      "similar";
  }

  .post-sidebar {
    position: static;
    max-height: none;
    overflow: visible;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .post-author-card {
    grid-column: 1 / -1;
  }

  .post-external {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .post-sidebar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 599px) {
  .post-shell {
    padding: var(--space-2) var(--space-2) var(--space-5);
  }

  .post-hero {
    padding: 1rem 0.9rem 0.8rem;
  }

  .post-body-section {
    padding: 0.9rem 0.85rem 1.2rem;
  }

  .post-tags {
    padding: 0.7rem 0.85rem 0.9rem;
  }

  .post-hero__actions .q-btn {
    font-size: 0.8rem;
  }

  .post-hero__meta {
    gap: 0.25rem 0.65rem;
  }

  .post-hero__meta .post-hero__dot {
    display: none;
  }
}

.post-similar__body {
  padding-top: 0.4rem;
}

.post-similar__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.post-similar__link {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
  text-decoration: none;
}

.post-similar__link:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
}

.post-similar__title {
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
}

.post-similar__meta {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}
</style>

<script>
import render from 'components/render.vue'
import comments from 'components/comments.vue'
import moment from 'src/utils/time'
import vote from 'components/vote.vue'
import { defineAsyncComponent } from 'vue'
const CommentForm = defineAsyncComponent(() => import('components/CommentForm.vue'))
const shareButtons = defineAsyncComponent(() => import('components/shareButtons.vue'))
const votesDialog = defineAsyncComponent(() => import('components/votesDialog.vue'))
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
import tipButton from 'components/tipButton.vue'
import satsZapButton from 'components/lightning/SatsZapButton.vue'
import { stripHtml, safeJsonParse } from 'src/utils/safeHtml'
import reblog from 'components/reblog.vue'
import { deleteCommentQueueItem, formatReputation } from 'src/services/comments'
import { AI_TOOL_LABELS, readCrossPostMetadata } from 'src/services/publish'
import { fetchAccount, fetchHiveSenseSimilar, fetchPostContent } from 'src/services/chainData'
import { setPageMeta, stripHtml as stripHtmlForMeta, BASE_URL, SITE_NAME } from 'src/utils/pageMeta'
import { hiveAvatarUrl } from 'src/utils/avatar'
import { isValidTag } from 'src/utils/hiveTag'
import { useVaultStore } from 'src/stores/vault'
import { readVaultSettings } from 'src/services/vaultSettings'
import { deriveVaultPlan } from 'src/services/vaultProduct'
import { parseVaultMetadata, splitVaultBody } from 'src/services/vaultPayload'
import ProfileSkin from 'components/theme/ProfileSkin.vue'
import VaultLockedSection from 'components/blog/VaultLockedSection.vue'
import moderation from 'src/mixins/moderation'

export default {
  name: 'postView',
  mixins: [moderation],
  components: {
    ModerationNotice: defineAsyncComponent(() => import('components/moderation/ModerationNotice.vue')),
    render,
    comments,
    vote,
    jsonViewer,
    tipButton,
    satsZapButton,
    CommentForm,
    shareButtons,
    reblog,
    votesDialog,
    ProfileSkin,
    VaultLockedSection
  },
  data () {
    return {
      post: null,
      author: this.$route.params.author,
      permlink: this.$route.params.permlink,
      showVotes: false,
      showShareDialog: false,
      showReply: false,
      deleteOpen: false,
      commentRefreshToken: 0,
      similarPosts: [],
      rebloggers: [],
      error: null,
      nowMs: Date.now(),
      countdownTimer: null,
      vaultMetadata: null,
      vaultPlan: null,
      vaultPlanError: '',
      vaultSettings: null,
      publicBody: '',
      vaultRequestId: 0
    }
  },
  watch: {
    '$route.path' () {
      this.init()
    }
  },
  computed: {
    postModeration () {
      if (!this.post) return { display: 'show', primary: null, reasons: [], overrides: [] }
      return this.moderationDecision({
        author: this.post.author || this.author,
        post: this.post,
        surface: 'post',
        itemKey: (this.post.author || this.author) + '/' + this.post.permlink
      })
    },
    account () {
      return this.$hiveStore.accounts[this.author]
    },
    communityInfo () {
      const category = this.post && this.post.category
      if (!category) return null
      return this.$hiveStore.$state.communityInfo[category] || null
    },
    communityName () {
      if (!this.post) return ''
      if (this.post.community) return this.post.community
      return this.post.category && this.post.category.startsWith('hive-') ? this.post.category : ''
    },
    communityTitle () {
      if (!this.post) return ''
      return this.post.community_title || (this.communityInfo && this.communityInfo.title) || ''
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    isOwnPost () {
      return Boolean(this.loggedInUser) && this.loggedInUser === this.author
    },
    alreadyReblogged () {
      if (!this.loggedInUser) return false
      if (this.rebloggers.length) return this.rebloggers.includes(this.loggedInUser)
      const list = this.post && Array.isArray(this.post.reblogged_by) ? this.post.reblogged_by : []
      return list.includes(this.loggedInUser)
    },
    hasReplies () {
      return Number(this.post && this.post.children) > 0
    },
    editLink () {
      return { name: 'compose', query: { edit: '@' + this.author + '/' + this.permlink } }
    },
    /** Original post this one credits, from cross_post metadata. */
    crossPostSource () {
      if (!this.post) return null
      return readCrossPostMetadata(this.postMeta)
    },
    postPastPayout () {
      if (!this.post) return false
      return moment.utc() > moment.utc(this.post.cashout_time)
    },
    postMeta () {
      return this.getPostMeta(this.post)
    },
    aiTools () {
      const tools = this.postMeta && this.postMeta.ai_tools
      return tools && typeof tools === 'object' ? tools : {}
    },
    aiToolLabels () {
      return Object.keys(this.aiTools)
        .filter(key => this.aiTools[key])
        .map(key => AI_TOOL_LABELS[key] || key.replace(/_/g, ' '))
    },
    hasAiDisclosure () {
      return this.aiToolLabels.length > 0
    },
    countdownAt () {
      const time = Date.parse(this.postMeta && this.postMeta.countdown)
      return Number.isFinite(time) ? time : 0
    },
    countdownLabel () {
      if (!this.countdownAt) return ''
      const remaining = this.countdownAt - this.nowMs
      return remaining > 0 ? this.formatCountdown(remaining) : 'Countdown ended'
    },
    isPortfolio () {
      return this.postMeta && this.postMeta.portfolio === true
    },
    isCollection () {
      if (this.postMeta && this.postMeta.collection === true) return true
      const tags = this.postMeta && this.postMeta.tags
      return Array.isArray(tags) && tags.includes('c-c-c')
    },
    displayAuthor () {
      const value = this.postMeta && this.postMeta.author
      return typeof value === 'string' ? value.trim().slice(0, 80) : ''
    },
    authorMeta () {
      return safeJsonParse(this.account && this.account.posting_json_metadata)
    },
    authorAbout () {
      return stripHtml((this.authorMeta.profile && this.authorMeta.profile.about) || '')
    },
    reputation () {
      return formatReputation(this.post && this.post.author_reputation)
    },
    postTags () {
      const tags = this.postMeta && this.postMeta.tags
      if (!Array.isArray(tags)) return []
      return tags.filter(tag => typeof tag === 'string' && tag.length > 0).slice(0, 8)
    },
    wordCount () {
      if (!this.post || !this.post.body) return 0
      return stripHtml(this.post.body).split(/\s+/).filter(Boolean).length
    },
    readingTime () {
      return Math.max(1, Math.ceil(this.wordCount / 200))
    },
    formattedCreated () {
      if (!this.post || !this.post.created) return ''
      return moment.utc(this.post.created).format('D MMM YYYY')
    },
    isEdited () {
      if (!this.post || !this.post.last_update || !this.post.created) return false
      return Math.abs(moment.utc(this.post.last_update).diff(moment.utc(this.post.created), 'minutes')) > 1
    },
    voteCount () {
      return (this.post && this.post.active_votes && this.post.active_votes.length) || 0
    },
    commentCount () {
      return Number(this.post && this.post.children) || 0
    },
    reblogCount () {
      return Number(this.post && this.post.reblogs) || 0
    },
    payoutDisplay () {
      if (!this.post) return ''
      const pending = this.post.pending_payout_value
      if (typeof pending === 'string' && parseFloat(pending) > 0) return pending
      const total = this.post.total_payout_value
      if (typeof total === 'string' && parseFloat(total) > 0) return total
      if (typeof this.post.payout === 'number' && this.post.payout > 0) return this.post.payout.toFixed(3) + ' HBD'
      return ''
    },
    maxPayoutCapped () {
      if (!this.post || typeof this.post.max_accepted_payout !== 'string') return false
      const max = parseFloat(this.post.max_accepted_payout)
      return Number.isFinite(max) && max > 0 && max < 100
    },
    postNotices () {
      if (!this.post) return []
      const notices = []
      if (this.postPastPayout && this.loggedInUser) {
        notices.push({ icon: 'schedule', text: 'Payout window ended' })
      }
      if (this.post.max_accepted_payout === '0.000 HBD') {
        notices.push({ icon: 'money_off', text: 'Author declined payout' })
      }
      if (this.post.percent_hbd === 0) {
        notices.push({ icon: 'bolt', text: 'Rewards 100% powered up' })
      }
      if (this.maxPayoutCapped) {
        notices.push({ icon: 'money_off', text: 'Rewards capped at ' + this.post.max_accepted_payout })
      }
      return notices
    },
    blogAccountName () {
      return (this.post && this.post.author) || this.author || ''
    },
    readerAccount () {
      return this.loggedInUser || ''
    },
    displayBody () {
      if (this.vaultMetadata) return this.publicBody
      return (this.post && this.post.body) || ''
    },
    vaultState () {
      if (!this.vaultMetadata || !this.post) return { status: 'locked', message: '' }
      const state = useVaultStore().postState(this.blogAccountName, this.post.permlink)
      if (state.status === 'unlocked' && state.plaintext) return state
      if (this.vaultPlanError) {
        return { status: 'error', code: 'no-plan', message: this.vaultPlanError }
      }
      return state
    },
    vaultPlaintext () {
      return this.vaultState.plaintext || ''
    }
  },
  methods: {
    loadRebloggedBy () {
      if (!this.loggedInUser || !this.author || !this.permlink) {
        this.rebloggers = []
        return
      }
      this.$hive.api.callAsync('condenser_api.get_reblogged_by', [this.author, this.permlink])
        .then(list => { this.rebloggers = Array.isArray(list) ? list : [] })
        .catch(() => { this.rebloggers = [] })
    },
    getPost (author, permlink) {
      this.$hive.api.getContentAsync(author, permlink)        .then(post => {
          this.error = null
          this.setPost(post)
        })
        .catch(error => {
          this.error = error
          this.setNotFoundMeta()
          console.error(error)
        })
    },
    setPost (post) {
      if (!post || !post.author || !post.permlink) {
        this.post = null
        this.setNotFoundMeta()
        return
      }
      this.post = post
      this.updatePageMeta(post)
      this.prepareVault(post).catch(() => {})
      this.startCountdownTimer()
      this.loadRebloggedBy()
      const category = post && post.category
      if (category && category.startsWith('hive-') && !this.$hiveStore.$state.communityInfo[category]) {
        this.$hiveStore.getCommunityInfo(category)
      }
      this.loadSimilarPosts()
    },
    loadSimilarPosts () {
      this.similarPosts = []
      if (!this.author || !this.permlink) return
      fetchHiveSenseSimilar(this.author, this.permlink, { limit: 6 })
        .then(response => {
          if (response?.ok) {
            this.similarPosts = (response.posts || [])
              .filter(item => !(item.author === this.author && item.permlink === this.permlink))
              .slice(0, 6)
          }
        })
        .catch(() => {})
    },
    createdLabel (created) {
      return created ? moment.utc(created).format('D MMM YYYY') : 'Hive'
    },
    excerpt (body) {
      if (!body) return ''
      const text = String(body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return text.length > 90 ? text.slice(0, 87).trimEnd() + '…' : text
    },
    getPostMeta (post) {
      if (!post || !post.json_metadata) return {}
      return safeJsonParse(post.json_metadata)
    },
    setNotFoundMeta () {
      setPageMeta({
        title: 'Post @' + this.author + '/' + this.permlink + ' not found — banksia.io',
        description: 'This Hive post does not exist or has been removed.',
        noindex: true
      })
    },
    updatePageMeta (post) {
      const author = (post && post.author) || this.author
      const permlink = (post && post.permlink) || this.permlink
      const metadata = this.getPostMeta(post)
      const title = post && post.title ? stripHtmlForMeta(post.title, 120) : ''
      const pageTitle = title || ('Hive post by @' + author)
      const vault = parseVaultMetadata(metadata)
      const publicBody = vault && post && post.body
        ? splitVaultBody(post.body, vault.mode).publicBody
        : (post && post.body) || ''
      const body = publicBody ? stripHtmlForMeta(publicBody.slice(0, 4000), 160) : ''
      const metaDescription = typeof metadata.description === 'string'
        ? stripHtmlForMeta(metadata.description, 160)
        : ''
      const description = metaDescription || body || ('Read @' + author + "'s post on the Hive blockchain — blocks, accounts, posts and tools at banksia.io.")
      const image = Array.isArray(metadata.image) ? metadata.image[0] : metadata.image
      const pageUrl = BASE_URL + '/@' + author + '/' + permlink
      const jsonLd = post
        ? {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title || pageTitle,
            description,
            ...(typeof image === 'string' && image ? { image: [image] } : {}),
            datePublished: post.created || undefined,
            dateModified: post.last_update || post.created || undefined,
            author: { '@type': 'Person', name: '@' + author, url: BASE_URL + '/@' + author },
            publisher: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
            url: pageUrl,
            ...(vault
              ? {
                  isAccessibleForFree: false,
                  hasPart: {
                    '@type': 'WebPageElement',
                    isAccessibleForFree: false,
                    cssSelector: '.banksia-locked'
                  }
                }
              : {})
          }
        : null
      setPageMeta({
        title: pageTitle,
        description,
        image: typeof image === 'string' ? image : undefined,
        url: '/@' + author + '/' + permlink,
        type: 'article',
        jsonLd
      })
    },
    resetVault () {
      this.vaultRequestId += 1
      this.vaultMetadata = null
      this.vaultPlan = null
      this.vaultPlanError = ''
      this.vaultSettings = null
      this.publicBody = ''
    },
    async prepareVault (post) {
      const requestId = ++this.vaultRequestId
      const metadata = parseVaultMetadata(post && post.json_metadata)
      if (!metadata) return

      this.vaultMetadata = metadata
      this.vaultPlanError = ''
      this.publicBody = splitVaultBody(post.body, metadata.mode).publicBody

      let account
      try {
        account = await fetchAccount(post.author)
      } catch {
        account = null
      }
      if (requestId !== this.vaultRequestId) return
      const settings = readVaultSettings(account).settings
      this.vaultSettings = settings
      const ref = metadata.product || settings.product
      if (!ref || typeof ref !== 'string' || !ref.includes('/')) {
        this.vaultPlanError = 'The membership plan could not be loaded.'
      } else {
        const [productAuthor, productPermlink] = ref.split('/')
        try {
          const productPost = await fetchPostContent(productAuthor, productPermlink)
          if (requestId !== this.vaultRequestId) return
          const plan = deriveVaultPlan(productPost, {
            fallback: { executions: settings.executions }
          })
          if (!plan) throw new Error('The membership product is not available.')
          this.vaultPlan = plan
        } catch {
          if (requestId === this.vaultRequestId) {
            this.vaultPlanError = 'The membership plan could not be loaded.'
          }
        }
      }

      if (requestId !== this.vaultRequestId) return
      if (!this.post || this.post.permlink !== post.permlink) return

      const store = useVaultStore()
      const existing = await store.readerKey(post.author)
      if (!existing) return

      await store.unlockPost({
        blog: post.author,
        author: post.author,
        permlink: post.permlink,
        metadata,
        settings,
        readerAccount: this.readerAccount
      }).catch(() => {})
    },
    vaultUnlockArguments () {
      if (!this.post || !this.vaultMetadata) return null
      return {
        blog: this.blogAccountName,
        author: this.post.author,
        permlink: this.post.permlink,
        metadata: this.vaultMetadata,
        settings: this.vaultSettings || {},
        readerAccount: this.readerAccount
      }
    },
    onVaultSubscribe () {
      if (!this.vaultPlan) return
      const product = this.vaultPlan.product ||
        (this.vaultPlan.author && this.vaultPlan.permlink
          ? this.vaultPlan.author + '/' + this.vaultPlan.permlink
          : '')
      if (!product) return
      this.$router.push({
        path: '/subscribe',
        query: { blog: this.blogAccountName, product }
      })
    },
    onVaultRestore () {
      const args = this.vaultUnlockArguments()
      if (!args) return
      useVaultStore().restoreAccess(args).catch(() => {})
    },
    onVaultRetry () {
      const args = this.vaultUnlockArguments()
      if (!args) return
      useVaultStore().unlockPost({ ...args, force: true }).catch(() => {})
    },
    linkHiveBlogPost (author, permlink) {
      return 'https://hive.blog/@' + author + '/' + permlink
    },
    linkPeakdPost (author, permlink) {
      return 'https://peakd.com/@' + author + '/' + permlink + '?ref=ausbitbank'
    },
    linkEcencyPost (author, permlink) {
      return 'https://ecency.com/@' + author + '/' + permlink
    },
    linkAccount (username) {
      return '/@' + username
    },
    linkPost (author, permlink) {
      return '/@' + author + '/' + permlink
    },
    linkCommunity (community) {
      return '/c/' + community + '/trending'
    },
    linkTag (tag) {
      return isValidTag(tag) ? '/trending/' + tag : null
    },
    linkDetect (link) {
      return link.startsWith('hive-') ? this.linkCommunity(link) : this.linkTag(link)
    },
    timeDelta (timestamp) {
      const now = moment.utc()
      const stamp = moment.utc(timestamp)
      const diff = stamp.diff(now, 'minutes')
      return moment.duration(diff, 'minutes').humanize(true)
    },
    formatDate (timestamp) {
      return moment.utc(timestamp).format('D MMM YYYY')
    },
    formatCountdown (remainingMs) {
      const total = Math.max(0, Math.floor(remainingMs / 1000))
      const days = Math.floor(total / 86400)
      const hours = Math.floor((total % 86400) / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const seconds = total % 60
      if (days > 0) return days + 'd ' + hours + 'h ' + minutes + 'm'
      if (hours > 0) return hours + 'h ' + minutes + 'm ' + seconds + 's'
      return minutes + 'm ' + seconds + 's'
    },
    startCountdownTimer () {
      this.stopCountdownTimer()
      if (!this.countdownAt) return
      this.nowMs = Date.now()
      this.countdownTimer = setInterval(() => {
        this.nowMs = Date.now()
        if (this.countdownAt <= this.nowMs) this.stopCountdownTimer()
      }, 1000)
    },
    stopCountdownTimer () {
      if (this.countdownTimer) clearInterval(this.countdownTimer)
      this.countdownTimer = null
    },
    tidyNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '0'
      return number.toLocaleString('en-US')
    },
    GetHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    stripHtml,
    scrollToComments () {
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    refreshPost () {
      this.getPost(this.author, this.permlink)
    },
    onCommentPosted () {
      this.showReply = false
      this.commentRefreshToken += 1
      if (this.post) this.post.children = (Number(this.post.children) || 0) + 1
    },
    confirmDelete () {
      this.deleteOpen = false
      try {
        this.$hiveStore.addToQueue(deleteCommentQueueItem({
          username: this.loggedInUser,
          author: this.author,
          permlink: this.permlink
        }))
        this.$q.notify({
          type: 'positive',
          message: 'Delete queued for broadcast',
          caption: 'The post is removed after the transaction is confirmed.'
        })
      } catch (error) {
        console.error('Failed to queue delete', error)
        this.$q.notify({ type: 'negative', message: 'Could not queue the delete' })
      }
    },
    init () {
      if (this.post && this.vaultMetadata) {
        useVaultStore().lockPost(this.blogAccountName, this.post.permlink)
      }
      this.resetVault()
      this.stopCountdownTimer()
      this.post = null
      this.error = null
      this.rebloggers = []
      this.author = this.$route.params.author
      this.permlink = this.$route.params.permlink
      this.updatePageMeta(null)
      if (this.author) this.$hiveStore.getAccount(this.author)
      this.getPost(this.author, this.permlink)
    },
    findDeletedPost (data) {
      const author = data.split(' ')[1].split('/')[0]
      this.$router.push({ path: '/@' + author + '?filter=comment,delete_comment' })
    }
  },
  mounted () {
    this.init()
  },
  beforeUnmount () {
    if (this.post && this.vaultMetadata) {
      useVaultStore().lockPost(this.blogAccountName, this.post.permlink)
    }
    this.stopCountdownTimer()
  }
}
</script>
