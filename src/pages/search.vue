<template>
  <q-page class="search-page">
    <header class="search-head">
      <div class="search-head__text">
        <div class="home-eyebrow">Search</div>
        <h1 class="page-title">Search Hive</h1>
        <p class="page-intro">
          Accounts, posts, tags, communities, blocks, transactions, proposals and witnesses in one place.
        </p>
      </div>
      <div class="search-head__actions">
        <q-btn
          v-if="canSave"
          flat
          no-caps
          :icon="isSaved ? 'bookmark' : 'bookmark_border'"
          :label="isSaved ? 'Saved' : 'Save search'"
          :aria-pressed="isSaved"
          @click="toggleSavedSearch"
        />
      </div>
    </header>

    <div class="search-bar" role="search">
      <q-input
        ref="qInput"
        v-model="query"
        class="search-bar__input"
        outlined
        dense
        label="Search or paste a Hive URL"
        aria-label="Search Hive"
        placeholder="@account, #tag, block, tx id, proposal, post URL…"
        autocomplete="off"
        @keyup.enter="submit"
        @keydown.down.prevent="onInputArrow(1)"
        @keydown.up.prevent="onInputArrow(-1)"
      >
        <template #prepend>
          <q-icon name="search" aria-hidden="true" />
        </template>
        <template #append>
          <q-btn v-if="query" flat dense round icon="close" aria-label="Clear search" title="Clear search" @click="clearSearch" />
          <q-btn flat dense round icon="arrow_forward" aria-label="Run search" title="Run search" :loading="loading" @click="submit" />
        </template>
      </q-input>
    </div>

    <nav class="search-tabs" aria-label="Search result types">
      <button
        v-for="tab in typeTabs"
        :key="tab.value"
        type="button"
        class="search-tab"
        :class="{ 'search-tab--active': filters.type === tab.value }"
        :aria-pressed="filters.type === tab.value"
        @click="setType(tab.value)"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="search-tab__count">{{ tab.count }}</span>
      </button>
    </nav>

    <div class="search-layout">
      <div class="search-main">
        <section v-if="!query.trim()" class="search-start home-card home-panel" aria-labelledby="search-start-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Start here</div>
              <h2 id="search-start-title" class="home-panel__title">What are you looking for?</h2>
            </div>
          </div>
          <div class="home-panel__body search-start__body">
            <div class="search-chips" role="group" aria-label="Example searches">
              <button v-for="example in examples" :key="example.value" type="button" class="search-chip" @click="useExample(example.value)">
                <q-icon :name="example.icon" size="15px" aria-hidden="true" />
                {{ example.label }}
              </button>
            </div>
            <ol class="search-tips">
              <li>Type an account name to see its profile, posts and witness status.</li>
              <li>Use <code>#tag</code> or a community id such as <code>hive-174578</code> to explore a topic.</li>
              <li>Paste a hive.blog, peakd or hive.ausbit.dev post link to jump straight to it.</li>
              <li>Paste a block number, transaction id or proposal number to verify it exists.</li>
            </ol>
          </div>
        </section>

        <section v-if="query.trim()" class="search-status" aria-live="polite">
          <template v-if="loading">Searching…</template>
          <template v-else-if="totalCount">{{ totalCount }} {{ totalCount === 1 ? 'result' : 'results' }} for “{{ submittedQuery }}”</template>
          <template v-else>No results for “{{ submittedQuery }}”. Try a shorter or differently spelled query.</template>
        </section>

        <div ref="groupsEl" class="search-groups" @keydown="onGroupsKeydown">
          <section
            v-for="group in visibleGroups"
            :key="group.id"
            class="search-group home-card home-panel"
            :aria-labelledby="'search-group-' + group.id"
          >
            <div class="home-panel__head">
              <div class="search-group__heading">
                <div class="home-eyebrow">{{ group.eyebrow }}</div>
                <h2 :id="'search-group-' + group.id" class="home-panel__title">{{ group.label }}</h2>
              </div>
              <div class="home-panel__actions">
                <span v-if="group.id === 'posts' && result?.semantic?.ok" class="search-semantic-badge">
                  <q-icon name="auto_awesome" size="13px" aria-hidden="true" />
                  Semantic
                </span>
                <span
                  v-else-if="group.id === 'posts' && result?.semantic?.attempted && !loading"
                  class="search-semantic-note"
                  title="HiveSense did not answer, so these are keyword matches."
                >Keyword only</span>
                <button
                  v-if="group.id === 'posts' && group.moreRows"
                  type="button"
                  class="search-more"
                  @click="showMorePosts"
                >{{ group.moreLabel }}</button>
                <router-link v-if="group.more" :to="group.more" class="home-panel__link">View all</router-link>
              </div>
            </div>
            <div class="home-panel__body">
              <result-list
                :rows="group.rows"
                :active-key="activeKey"
                :empty="group.error || group.empty || 'No matches in this group.'"
                @hover="setActive"
                @open="openRow"
              />
              <div v-if="group.error" class="search-group__error" role="status">
                <q-icon name="cloud_off" size="15px" aria-hidden="true" />
                {{ group.error }}
              </div>
            </div>
          </section>
        </div>

        <section v-if="analytics" class="search-analytics home-card home-panel" aria-labelledby="search-analytics-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Topic analytics</div>
              <h2 id="search-analytics-title" class="home-panel__title">{{ analytics.label }}</h2>
            </div>
            <span class="search-analytics__window">Last 14 days</span>
          </div>
          <div class="home-panel__body search-analytics__body">
            <dl class="search-stats">
              <div class="search-stat">
                <dt>Posts</dt>
                <dd>{{ analytics.posts }}</dd>
              </div>
              <div class="search-stat">
                <dt>Authors</dt>
                <dd>{{ analytics.authors }}</dd>
              </div>
              <div class="search-stat">
                <dt>Posts / day</dt>
                <dd>{{ analytics.postsPerDay }}</dd>
              </div>
              <div class="search-stat">
                <dt>Median payout</dt>
                <dd>{{ formatHbd(analytics.medianPayout) }}</dd>
              </div>
              <div class="search-stat">
                <dt>Top 10% share</dt>
                <dd>{{ analytics.topDecileShare }}%</dd>
              </div>
              <div class="search-stat">
                <dt>Comments</dt>
                <dd>{{ analytics.comments }}</dd>
              </div>
            </dl>

            <div class="search-cadence" role="img" :aria-label="'Posting cadence: ' + cadenceSummary">
              <span
                v-for="day in analytics.cadence"
                :key="day.key"
                class="search-cadence__bar"
                :style="{ height: cadenceHeight(day.count) + '%' }"
                :title="day.label + ': ' + day.count + ' posts'"
              />
            </div>

            <div class="search-analytics__columns">
              <div v-if="analytics.topAuthors.length">
                <h3 class="search-subhead">Top authors</h3>
                <ul class="search-author-list">
                  <li v-for="author in analytics.topAuthors" :key="author.author">
                    <button type="button" class="search-author" @click="filterAuthor(author.author)">
                      @{{ author.author }}
                      <span>{{ author.posts }} posts · {{ formatHbd(author.payout) }}</span>
                    </button>
                  </li>
                </ul>
              </div>
              <div v-if="analytics.relatedTags.length">
                <h3 class="search-subhead">Related tags</h3>
                <div class="search-chips">
                  <button
                    v-for="tag in analytics.relatedTags"
                    :key="tag.tag"
                    type="button"
                    class="search-chip"
                    @click="filterTag(tag.tag)"
                  >
                    #{{ tag.tag }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="recommendedAuthors.length" class="search-authors home-card home-panel" aria-labelledby="search-authors-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Written by experts</div>
              <h2 id="search-authors-title" class="home-panel__title">Authors who write about this</h2>
            </div>
          </div>
          <div class="home-panel__body search-authors__body">
            <p class="search-authors__hint">Ranked by thematic specialisation from the HiveSense author index.</p>
            <div class="search-chips">
              <button
                v-for="account in recommendedAuthors"
                :key="account"
                type="button"
                class="search-chip"
                @click="filterAuthor(account)"
              >
                @{{ account }}
              </button>
            </div>
          </div>
        </section>

        <section v-if="savedSearches.length" class="search-saved home-card home-panel" aria-labelledby="search-saved-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">On this device</div>
              <h2 id="search-saved-title" class="home-panel__title">Saved searches</h2>
            </div>
          </div>
          <div class="home-panel__body search-saved__body">
            <ul class="search-saved__list">
              <li v-for="saved in savedSearches" :key="saved.url" class="search-saved__item">
                <router-link :to="saved.url" class="search-saved__link">
                  <q-icon name="bookmark" size="15px" aria-hidden="true" />
                  <span class="search-saved__label">{{ saved.label }}</span>
                  <span class="search-saved__meta">{{ saved.description }}</span>
                </router-link>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="delete_outline"
                  color="red-4"
                  :aria-label="'Remove saved search ' + saved.label"
                  title="Remove saved search"
                  @click="removeSavedSearch(saved.url)"
                />
              </li>
            </ul>
            <div class="search-saved__actions">
              <q-btn flat dense no-caps icon="archive" label="Export saved searches" @click="exportSavedSearches" />
              <q-btn flat dense no-caps icon="upload_file" label="Import" @click="triggerSavedImport" />
              <input ref="savedImport" type="file" accept="application/json,.json" class="search-file-input" aria-label="Import saved searches JSON file" @change="onSavedImport" />
            </div>
          </div>
        </section>
      </div>

      <aside class="search-side" aria-label="Search filters">
        <section class="home-card home-panel" aria-labelledby="search-sort-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Order</div>
              <h2 id="search-sort-title" class="home-panel__title">Sort and window</h2>
            </div>
          </div>
          <div class="home-panel__body search-fields">
            <fieldset class="search-fieldset">
              <legend class="search-legend">Sort posts</legend>
              <div class="search-options" role="group" aria-label="Sort posts">
                <button
                  v-for="option in sortOptions"
                  :key="option.value"
                  type="button"
                  class="search-option"
                  :class="{ 'search-option--active': filters.sort === option.value }"
                  :aria-pressed="filters.sort === option.value"
                  @click="setSort(option.value)"
                >
                  <span class="search-option__label">{{ option.label }}</span>
                  <span class="search-option__hint">{{ option.description }}</span>
                </button>
              </div>
            </fieldset>
            <q-select
              :model-value="filters.period"
              :options="periodOptions"
              emit-value
              map-options
              dense
              outlined
              label="Posting window"
              aria-label="Posting window"
              @update:model-value="setPeriod"
            />
            <div class="search-smart">
              <q-toggle
                :model-value="filters.smart"
                label="Smart search"
                color="primary"
                aria-label="Use semantic search for posts"
                @update:model-value="setSmart"
              />
              <p class="search-smart__hint">
                Adds AI semantic matches (HiveSense) that understand meaning, not just
                keywords. Turns off automatically when no node offers it.
              </p>
            </div>
          </div>
        </section>

        <section v-if="facets || hasFilters" class="home-card home-panel" aria-labelledby="search-facet-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Narrow down</div>
              <h2 id="search-facet-title" class="home-panel__title">{{ facetTitle }}</h2>
            </div>
            <div v-if="hasFilters" class="home-panel__actions">
              <q-btn flat dense no-caps label="Clear" @click="clearAllFilters" />
            </div>
          </div>
          <div class="home-panel__body search-fields">
            <div v-if="facets?.tags?.length">
              <h3 class="search-subhead">Tags</h3>
              <div class="search-chips">
                <button
                  v-for="tag in facets.tags"
                  :key="tag.value"
                  type="button"
                  class="search-chip"
                  :class="{ 'search-chip--active': filters.tags.includes(tag.value) }"
                  :aria-pressed="filters.tags.includes(tag.value)"
                  @click="filterTag(tag.value, { toggle: true })"
                >
                  #{{ tag.value }}
                </button>
              </div>
            </div>
            <div v-if="facets?.communities?.length">
              <h3 class="search-subhead">Communities</h3>
              <div class="search-chips">
                <button
                  v-for="community in facets.communities"
                  :key="community.value"
                  type="button"
                  class="search-chip"
                  :class="{ 'search-chip--active': filters.communities.includes(community.value) }"
                  :aria-pressed="filters.communities.includes(community.value)"
                  @click="filterCommunity(community.value)"
                >
                  {{ communityLabel(community.value) }}
                </button>
              </div>
            </div>
            <div v-if="hasFilters" class="search-active-filters">
              <h3 class="search-subhead">Active filters</h3>
              <div class="search-chips">
                <button
                  v-for="tag in filters.tags"
                  :key="'active-tag-' + tag"
                  type="button"
                  class="search-chip search-chip--active"
                  :aria-label="'Remove tag filter ' + tag"
                  @click="filterTag(tag, { toggle: true })"
                >
                  #{{ tag }} <q-icon name="close" size="13px" aria-hidden="true" />
                </button>
                <button
                  v-for="community in filters.communities"
                  :key="'active-community-' + community"
                  type="button"
                  class="search-chip search-chip--active"
                  :aria-label="'Remove community filter ' + community"
                  @click="filterCommunity(community)"
                >
                  {{ community }} <q-icon name="close" size="13px" aria-hidden="true" />
                </button>
                <button
                  v-for="author in filters.authors"
                  :key="'active-author-' + author"
                  type="button"
                  class="search-chip search-chip--active"
                  :aria-label="'Remove author filter ' + author"
                  @click="clearAuthor(author)"
                >
                  @{{ author }} <q-icon name="close" size="13px" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p v-if="!(facets?.tags?.length) && !(facets?.communities?.length) && !hasFilters" class="search-hint">
              Run a keyword search to gather tag and community facets.
            </p>
          </div>
        </section>

        <section class="home-card home-panel" aria-labelledby="search-help-title">
          <div class="home-panel__head">
            <div>
              <div class="home-eyebrow">Keyboard</div>
              <h2 id="search-help-title" class="home-panel__title">Search shortcuts</h2>
            </div>
          </div>
          <div class="home-panel__body">
            <dl class="search-keys">
              <div><dt><kbd>/</kbd> or <kbd>Ctrl K</kbd></dt><dd>Open search</dd></div>
              <div><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move between results</dd></div>
              <div><dt><kbd>↵</kbd></dt><dd>Open the active result</dd></div>
              <div><dt><kbd>Esc</kbd></dt><dd>Clear focus or the query</dd></div>
            </dl>
          </div>
        </section>
      </aside>
    </div>
  </q-page>
</template>

<style scoped>
.search-page {
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: var(--space-4) var(--space-3) var(--space-6);
}

.search-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.search-head__text .page-intro {
  margin: var(--space-2) 0 0;
}

.search-head__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.search-bar {
  margin: var(--space-4) 0 var(--space-3);
}

.search-bar__input :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.03);
}

.search-tabs {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.search-tab {
  flex: none;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  white-space: nowrap;
}

.search-tab:hover {
  border-color: rgba(79, 195, 247, 0.4);
  color: #e4eaed;
}

.search-tab:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 2px;
}

.search-tab--active {
  border-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.14);
  color: #e4eaed;
}

.search-tab__count {
  margin-left: 0.3rem;
  color: #81d4fa;
  font-variant-numeric: tabular-nums;
}

.search-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: var(--space-4);
  align-items: start;
  margin-top: var(--space-4);
}

.search-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.search-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.search-status {
  color: #90a4ae;
  font-size: 0.8rem;
}

.search-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.search-group__heading {
  min-width: 0;
}

.search-group__error {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.35rem;
  color: #ffb74d;
  font-size: 0.72rem;
}

.search-start__body,
.search-analytics__body,
.search-saved__body,
.search-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem 0.9rem;
}

.search-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.search-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
}

.search-chip:hover {
  border-color: rgba(79, 195, 247, 0.4);
  color: #e4eaed;
}

.search-chip:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 2px;
}

.search-chip--active {
  border-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.14);
  color: #e4eaed;
}

.search-tips {
  margin: 0;
  padding-left: 1.1rem;
  color: #90a4ae;
  font-size: 0.78rem;
  line-height: 1.6;
}

.search-tips code {
  color: #81d4fa;
}

.search-analytics__window {
  color: #90a4ae;
  font-size: 0.7rem;
}

.search-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.search-stat {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.search-stat dt {
  color: #90a4ae;
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.search-stat dd {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.92rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.search-cadence {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 56px;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.search-cadence__bar {
  flex: 1;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, rgba(79, 195, 247, 0.85), rgba(79, 195, 247, 0.35));
}

.search-analytics__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.8rem;
}

.search-subhead {
  margin: 0 0 0.35rem;
  color: #cfd8dc;
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.search-author-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-author {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.25rem 0.35rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: #81d4fa;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  text-align: left;
}

.search-author span {
  color: #90a4ae;
  font-size: 0.7rem;
  white-space: nowrap;
}

.search-author:hover {
  background: rgba(79, 195, 247, 0.08);
}

.search-author:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 1px;
}

.search-fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

.search-legend {
  margin-bottom: 0.35rem;
  padding: 0;
  color: #90a4ae;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.search-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
}

.search-option {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  color: #b0bec5;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.search-option--active {
  border-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.12);
  color: #e4eaed;
}

.search-option:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 2px;
}

.search-option__label {
  font-size: 0.78rem;
  font-weight: 600;
}

.search-option__hint {
  color: #90a4ae;
  font-size: 0.66rem;
  line-height: 1.35;
}

.search-smart {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.search-smart__hint {
  margin: 0;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}

.search-semantic-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.45rem;
  border: 1px solid rgba(129, 212, 250, 0.35);
  border-radius: var(--radius-pill);
  color: #81d4fa;
  font-size: 0.68rem;
  white-space: nowrap;
}

.search-semantic-note {
  color: #78909c;
  font-size: 0.68rem;
  white-space: nowrap;
}

.search-more {
  padding: 0.1rem 0.5rem;
  border: 1px solid rgba(129, 212, 250, 0.35);
  border-radius: var(--radius-pill);
  background: none;
  color: #81d4fa;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  white-space: nowrap;
}

.search-more:hover {
  background: rgba(129, 212, 250, 0.08);
}

.search-more:focus-visible {
  outline: 2px solid #4fc3f7;
  outline-offset: 1px;
}

.search-authors__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-authors__hint {
  margin: 0;
  color: #90a4ae;
  font-size: 0.74rem;
}

.search-keys {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
}

.search-keys div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.search-keys dt {
  color: #e4eaed;
  font-size: 0.74rem;
}

.search-keys dd {
  margin: 0;
  color: #90a4ae;
  font-size: 0.72rem;
  text-align: right;
}

.search-keys kbd {
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.045);
  font-family: monospace;
  font-size: 0.66rem;
}

.search-hint {
  margin: 0;
  color: #90a4ae;
  font-size: 0.72rem;
  line-height: 1.5;
}

.search-active-filters {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.search-saved__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-saved__item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.25rem 0.2rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.search-saved__link {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: #e4eaed !important;
  font-size: 0.76rem;
  font-weight: 500;
  text-decoration: none;
}

.search-saved__link:hover {
  color: #81d4fa !important;
  text-decoration: none;
}

.search-saved__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-saved__meta {
  margin-left: auto;
  color: #90a4ae;
  font-size: 0.68rem;
  white-space: nowrap;
}

.search-saved__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--border-subtle);
}

.search-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 1023px) {
  .search-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .search-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .search-options {
    grid-template-columns: 1fr;
  }

  .search-saved__meta {
    display: none;
  }
}
</style>

<script>
import { exportFile } from 'quasar'
import moment from 'src/utils/time'
import ResultList from 'src/components/search/ResultList.vue'
import { formatHbd } from 'src/services/proposals'
import { runUnifiedSearch } from 'src/services/searchReads'
import {
  PERIOD_OPTIONS,
  POSTS_PAGE_SIZE,
  SEARCH_TYPE_LABELS,
  SEARCH_TYPES,
  SORT_OPTIONS,
  hasActiveFilters,
  normalizeSearchState,
  parseSearchState,
  searchToQuery,
  toggleFacet
} from 'src/services/unifiedSearch'
import {
  SAVED_SEARCH_LIMIT,
  addSavedSearch,
  defaultSavedSearches,
  importSavedSearches,
  readSavedSearches,
  removeSavedSearch,
  savedSearchRecord,
  serializeSavedSearches,
  writeSavedSearches
} from 'src/services/savedSearches'
import { setPageMeta } from 'src/utils/pageMeta'

const EXAMPLES = [
  { label: 'Popular tags', value: '#photography', icon: 'tag' },
  { label: 'A community', value: 'hive-174578', icon: 'groups' },
  { label: 'An account', value: '@ausbitbank', icon: 'person' },
  { label: 'Trending posts', value: 'hive', icon: 'article' },
  { label: 'A block', value: 'block 100000000', icon: 'view_agenda' }
]

function rowKey (group, item, index) {
  return group + '-' + (item.id || item.value || item.author || item.name || item.txId || item.blockNum || index)
}

export default {
  name: 'SearchPage',
  components: { ResultList },
  data () {
    return {
      query: '',
      submittedQuery: '',
      filters: normalizeSearchState({}),
      result: null,
      loading: false,
      activeKey: '',
      typeTabs: SEARCH_TYPES.map(type => ({ value: type, label: SEARCH_TYPE_LABELS[type], count: 0 })),
      sortOptions: SORT_OPTIONS,
      periodOptions: PERIOD_OPTIONS,
      examples: EXAMPLES,
      savedSearches: [],
      searchToken: 0,
      postsVisible: POSTS_PAGE_SIZE
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username || null
    },
    canSave () {
      return Boolean(String(this.query || '').trim() && this.$route.query.q)
    },
    isSaved () {
      const url = this.currentUrl
      return this.savedSearches.some(item => item.url === url)
    },
    currentUrl () {
      return this.buildUrl(this.query, this.filters)
    },
    hasFilters () {
      return hasActiveFilters(this.filters)
    },
    groups () {
      const result = this.result
      if (!result) return []
      const groups = []

      groups.push({
        id: 'accounts',
        type: 'accounts',
        label: 'Accounts',
        eyebrow: 'Profile',
        rows: (result.accounts.items || []).map((account, index) => {
          const profile = account.posting_json_metadata || account.json_metadata || {}
          const about = typeof profile === 'object' ? profile.profile?.about : ''
          return {
            key: rowKey('account', { id: account.name }, index),
            title: '@' + account.name,
            description: about || 'Hive account',
            badge: this.reputation(account.reputation),
            icon: 'person',
            path: '/@' + account.name
          }
        }),
        error: result.accounts.error
      })

      groups.push({
        id: 'posts',
        type: 'posts',
        label: 'Posts',
        eyebrow: 'Content',
        rows: (result.posts.items || []).slice(0, this.postsVisible).map((post, index) => ({
          key: rowKey('post', post, index),
          title: post.title || 'Untitled post',
          description: '@' + post.author + ' · ' + moment.utc(post.created).fromNow() + ' · ' + (post.community_title || post.category || 'Hive'),
          badge: post.pending_payout_value || null,
          icon: post.semantic ? 'auto_awesome' : 'article',
          path: '/@' + post.author + '/' + post.permlink
        })),
        moreRows: Math.max(0, (result.posts.items || []).length - this.postsVisible),
        moreLabel: 'Show ' + Math.min(POSTS_PAGE_SIZE, Math.max(0, (result.posts.items || []).length - this.postsVisible)) + ' more',
        error: result.posts.error
      })

      groups.push({
        id: 'tags',
        type: 'tags',
        label: 'Tags',
        eyebrow: 'Topic',
        rows: (result.tags.items || []).map((tag, index) => ({
          key: rowKey('tag', { value: tag.tag }, index),
          title: '#' + tag.tag,
          description: 'Trending and new posts tagged #' + tag.tag,
          badge: tag.count ? tag.count + ' recent' : '',
          icon: 'tag',
          path: '/trending/' + tag.tag
        })),
        error: result.tags.error
      })

      groups.push({
        id: 'communities',
        type: 'communities',
        label: 'Communities',
        eyebrow: 'Space',
        rows: (result.communities.items || []).map((community, index) => ({
          key: rowKey('community', { id: community.name }, index),
          title: community.title || community.name,
          description: community.name + (community.about ? ' · ' + community.about : ''),
          badge: community.subscribers ? Number(community.subscribers).toLocaleString('en-US') + ' members' : '',
          icon: 'groups',
          path: '/c/' + community.name
        })),
        error: result.communities.error
      })

      groups.push({
        id: 'blocks',
        type: 'blocks',
        label: 'Blocks',
        eyebrow: 'Chain',
        rows: (result.blocks.items || []).map((block, index) => ({
          key: rowKey('block', block, index),
          title: 'Block ' + Number(block.blockNum).toLocaleString('en-US'),
          description: 'Witness @' + block.witness + ' · ' + moment.utc(block.timestamp).fromNow() + ' · ' + block.txCount + ' transactions',
          icon: 'view_agenda',
          path: '/b/' + block.blockNum
        })),
        error: result.blocks.error
      })

      groups.push({
        id: 'transactions',
        type: 'transactions',
        label: 'Transactions',
        eyebrow: 'Chain',
        rows: (result.transactions.items || []).map((tx, index) => ({
          key: rowKey('tx', tx, index),
          title: tx.txId.slice(0, 16) + '…',
          description: 'Open the transaction and its operations',
          icon: 'receipt_long',
          path: '/tx/' + tx.txId
        })),
        error: result.transactions.error
      })

      groups.push({
        id: 'proposals',
        type: 'proposals',
        label: 'Proposals',
        eyebrow: 'DHF',
        rows: (result.proposals.items || []).map((proposal, index) => ({
          key: rowKey('proposal', { id: proposal.proposal_id ?? proposal.id }, index),
          title: proposal.subject || 'Proposal #' + proposal.proposal_id,
          description: 'By @' + (proposal.creator || 'unknown') + ' · #' + (proposal.proposal_id ?? proposal.id),
          icon: 'account_balance',
          path: '/proposals/' + (proposal.proposal_id ?? proposal.id)
        })),
        error: result.proposals.error
      })

      groups.push({
        id: 'witnesses',
        type: 'witnesses',
        label: 'Witnesses',
        eyebrow: 'Governance',
        rows: (result.witnesses.items || []).map((witness, index) => ({
          key: rowKey('witness', { id: witness.owner }, index),
          title: '@' + witness.owner,
          description: witness.url || 'Hive witness',
          badge: witness.votes ? Number(witness.votes).toLocaleString('en-US') + ' votes' : '',
          icon: 'how_to_vote',
          path: '/witness/' + witness.owner
        })),
        error: result.witnesses.error
      })

      return groups
        .filter(group => {
          if (this.filters.type !== 'all') return this.filters.type === group.type
          // Without an explicit type, quick-jump groups stay visible only when
          // they have rows; otherwise the page fills with empty panels.
          return group.rows.length > 0 || Boolean(group.error)
        })
        .map(group => ({
          ...group,
          more: group.type === 'tags' && this.submittedQuery && result.plan.kind === 'tag'
            ? '/trending/' + result.plan.tags
            : ''
        }))
        .filter(group => group.rows.length || group.error || this.result)
    },
    visibleGroups () {
      if (!this.submittedQuery) return []
      return this.groups.filter(group => group.rows.length > 0 || Boolean(group.error))
    },
    totalCount () {
      return this.groups.reduce((total, group) => total + group.rows.length, 0)
    },
    facets () {
      const context = this.result
      if (!context) return null
      return context.facets || null
    },
    facetTitle () {
      if (this.result?.authorContext) return 'Facets for @' + this.result.authorContext.author
      const label = this.result?.plan?.tags || this.result?.plan?.communities
      return label ? 'Refine #' + label : 'Refine results'
    },
    analytics () {
      return this.result?.analytics || null
    },
    recommendedAuthors () {
      return this.result?.recommendedAuthors || []
    },
    cadenceSummary () {
      if (!this.analytics) return ''
      return this.analytics.cadence.map(day => day.label + ' ' + day.count).join(', ')
    }
  },
  watch: {
    '$route.query': {
      deep: true,
      handler () {
        this.hydrateFromRoute()
      }
    }
  },
  created () {
    this.savedSearches = readSavedSearches(window.localStorage)
    this.hydrateFromRoute()
  },  mounted () {
    this.setMeta()
    window.addEventListener('hive:open-search', this.focusSearch)
    if (!this.query.trim() && !this.$route.query.q) {
      this.$nextTick(() => this.$refs.qInput?.focus())
    }
  },
  beforeUnmount () {
    window.removeEventListener('hive:open-search', this.focusSearch)
  },
  methods: {
    formatHbd,
    setMeta () {
      const text = this.submittedQuery
      setPageMeta({
        title: text ? 'Search: ' + text + ' — hive.ausbit.dev' : 'Search Hive — accounts, posts, tags and more',
        description: text
          ? 'Hive search results for “' + text + '”: accounts, posts, tags, communities, blocks, transactions, proposals and witnesses.'
          : 'Search accounts, posts, tags, communities, blocks, transactions, proposals and witnesses on hive.ausbit.dev.',
        url: '/search',
        noindex: true
      })
    },
    hydrateFromRoute () {
      const routeQuery = this.$route.query
      let params = new URLSearchParams()
      for (const [key, value] of Object.entries(routeQuery)) {
        for (const entry of Array.isArray(value) ? value : [value]) {
          if (entry !== undefined && entry !== null) params.append(key, String(entry))
        }
      }
      // Pretty URLs (`/search/posts/photography`) win over omitted query keys.
      const pathType = this.$route.params && this.$route.params.type
      const pathTerm = this.$route.params && this.$route.params.term
      this.query = params.get('q') || (pathTerm ? String(pathTerm) : '')
      if (pathType && !params.get('type')) params.set('type', pathType)
      this.filters = parseSearchState(params.toString())
      this.updateTypeCounts()
      if (this.query.trim()) {
        this.submit({ fromRoute: true })
      } else {
        this.result = null
        this.submittedQuery = ''
        this.setMeta()
      }
    },
    async submit ({ fromRoute = false } = {}) {
      const text = this.query.trim()
      const expected = this.buildUrl(text, this.filters)
      if (!fromRoute && expected !== this.$route.fullPath) {
        this.$router.push(expected).catch(() => {})
        return
      }
      const token = ++this.searchToken
      this.submittedQuery = text
      this.postsVisible = POSTS_PAGE_SIZE
      if (!text) {
        this.result = null
        this.loading = false
        this.setMeta()
        return
      }
      this.loading = true
      this.setMeta()
      try {
        const result = await runUnifiedSearch(text, this.filters)
        if (token !== this.searchToken) return
        this.result = result
        this.activeKey = ''
        this.updateTypeCounts()
      } catch (error) {
        console.error('Search failed', error)
        if (token === this.searchToken) this.result = null
      } finally {
        if (token === this.searchToken) this.loading = false
      }
    },
    buildUrl (text, state) {
      const params = new URLSearchParams()
      const query = String(text || '').trim()
      if (query) params.set('q', query)
      const extra = searchToQuery(state)
      const search = [params.toString(), extra].filter(Boolean).join('&')
      return '/search' + (search ? '?' + search : '')
    },
    updateTypeCounts () {
      if (!this.result) {
        this.typeTabs = SEARCH_TYPES.map(type => ({ value: type, label: SEARCH_TYPE_LABELS[type], count: 0 }))
        return
      }
      const counts = {
        accounts: this.result.accounts.items.length,
        posts: Math.min(this.result.posts.items.length, this.postsVisible),
        tags: this.result.tags.items.length,
        communities: this.result.communities.items.length,
        blocks: this.result.blocks.items.length,
        transactions: this.result.transactions.items.length,
        proposals: this.result.proposals.items.length,
        witnesses: this.result.witnesses.items.length
      }
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
      this.typeTabs = SEARCH_TYPES.map(type => ({
        value: type,
        label: SEARCH_TYPE_LABELS[type],
        count: type === 'all' ? total : counts[type]
      }))
    },
    pushState (state) {
      this.filters = normalizeSearchState(state)
      this.$router.push(this.buildUrl(this.query, this.filters)).catch(() => {})
    },
    setType (type) {
      this.pushState({ ...this.filters, type })
    },
    setSort (sort) {
      this.pushState({ ...this.filters, sort })
    },
    setPeriod (period) {
      this.pushState({ ...this.filters, period })
    },
    setSmart (smart) {
      this.pushState({ ...this.filters, smart: Boolean(smart) })
    },
    showMorePosts () {
      const total = (this.result?.posts?.items || []).length
      this.postsVisible = Math.min(total, this.postsVisible + POSTS_PAGE_SIZE)
      this.activeKey = ''
      this.updateTypeCounts()
    },
    filterTag (tag, { toggle = false } = {}) {
      const tags = toggle ? toggleFacet(this.filters.tags, tag) : [String(tag).replace(/^#/, '').toLowerCase()]
      this.pushState({ ...this.filters, tags, type: 'posts' })
    },
    filterCommunity (community) {
      const list = this.filters.communities.includes(community)
        ? this.filters.communities.filter(item => item !== community)
        : [...this.filters.communities, community]
      this.pushState({ ...this.filters, communities: list, type: 'posts' })
    },
    filterAuthor (author) {
      this.pushState({ ...this.filters, authors: [author], type: 'posts' })
    },
    clearAuthor (author) {
      this.pushState({ ...this.filters, authors: this.filters.authors.filter(item => item !== author) })
    },
    clearAllFilters () {
      const state = normalizeSearchState({ type: this.filters.type })
      const target = this.buildUrl(this.query, state)
      this.filters = state
      if (target !== this.$route.fullPath) this.$router.push(target).catch(() => {})
    },
    communityLabel (name) {
      const match = (this.result?.communities.items || []).find(item => item.name === name)
      return match?.title || name
    },
    useExample (value) {
      this.query = value
      const target = this.buildUrl(value, { ...this.filters, type: 'all', page: 1 })
      if (target !== this.$route.fullPath) {
        this.filters = normalizeSearchState({ ...this.filters, type: 'all' })
        this.$router.push(target).catch(() => {})
      }
    },
    focusSearch () {
      this.$refs.qInput?.focus()
    },
    clearSearch () {
      this.query = ''
      const target = this.buildUrl('', this.filters)
      if (target !== this.$route.fullPath) this.$router.push(target).catch(() => {})
    },
    onInputArrow (step) {
      const rows = this.flatRows
      if (!rows.length) return
      const index = rows.findIndex(row => row.key === this.activeKey)
      this.setActive(rows[(index + step + rows.length) % rows.length])
      this.focusActive()
    },
    onGroupsKeydown (event) {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const rows = this.flatRows
      if (!rows.length) return
      event.preventDefault()
      const index = rows.findIndex(row => row.key === this.activeKey)
      let next = index
      if (event.key === 'ArrowDown') next = (index + 1) % rows.length
      if (event.key === 'ArrowUp') next = (index - 1 + rows.length) % rows.length
      if (event.key === 'Home') next = 0
      if (event.key === 'End') next = rows.length - 1
      this.setActive(rows[next])
      this.$nextTick(() => this.focusActive())
    },
    flatRows () {
      return this.visibleGroups.flatMap(group => group.rows)
    },
    setActive (row) {
      if (!row) return
      this.activeKey = row.key
    },
    focusActive () {
      const element = this.$el?.querySelector('.result-row--active')
      if (element) element.focus()
    },
    openRow (row) {
      if (row.path) this.$router.push(row.path).catch(() => {})
    },
    reputation (value) {
      const score = Number(value)
      if (!Number.isFinite(score) || score === 0) return ''
      if (score > 1e9) return String(Math.round(Math.log10(Math.abs(score) / 1e9) * 9 + 25))
      return String(Math.round(score))
    },
    cadenceHeight (count) {
      const max = Math.max(1, ...(this.analytics?.cadence || []).map(day => day.count))
      return Math.max(3, Math.round((Number(count) || 0) / max * 100))
    },
    toggleSavedSearch () {
      const url = this.currentUrl
      if (this.isSaved) {
        this.removeSavedSearch(url)
        return
      }
      const label = (this.filters.type !== 'all' ? SEARCH_TYPE_LABELS[this.filters.type] + ': ' : '') + '“' + this.query.trim() + '”'
      const description = [
        this.filters.tags.length ? this.filters.tags.map(tag => '#' + tag).join(' ') : '',
        this.filters.communities.join(', '),
        this.filters.authors.map(author => '@' + author).join(', '),
        this.filters.sort !== 'relevance' ? this.filters.sort : ''
      ].filter(Boolean).join(' · ') || 'Search on this device'
      this.setSavedSearches(addSavedSearch(this.savedSearches, savedSearchRecord({ label, url, description })))
      this.$q.notify({ type: 'positive', message: 'Search saved', caption: 'Available in Saved searches on this device.' })
    },
    removeSavedSearch (url) {
      this.setSavedSearches(removeSavedSearch(this.savedSearches, url))
      this.$q.notify({ message: 'Saved search removed' })
    },
    setSavedSearches (list) {
      this.savedSearches = list
      writeSavedSearches(window.localStorage, list)
    },
    exportSavedSearches () {
      if (!this.savedSearches.length) return
      const status = exportFile(
        'hive-saved-searches-' + moment().format('YYYY-MM-DD') + '.json',
        serializeSavedSearches(this.savedSearches),
        'application/json'
      )
      if (status === true) this.$q.notify({ type: 'positive', message: 'Saved searches exported' })
      else this.$q.notify({ type: 'negative', message: 'Could not export saved searches', caption: String(status) })
    },
    triggerSavedImport () {
      this.$refs.savedImport?.click()
    },
    async onSavedImport (event) {
      const input = event.target
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const text = await file.text()
        const parsed = importSavedSearches(text)
        if (parsed.error) {
          this.$q.notify({ type: 'negative', message: 'Import failed', caption: parsed.error })
          return
        }
        const merged = defaultSavedSearches([...this.savedSearches, ...parsed.searches])
        this.setSavedSearches(merged)
        this.$q.notify({ type: 'positive', message: 'Saved searches imported', caption: parsed.searches.length + ' added (limit ' + SAVED_SEARCH_LIMIT + ').' })
      } catch (error) {
        this.$q.notify({ type: 'negative', message: 'Could not read that file', caption: error.message })
      }
    }
  }
}
</script>
