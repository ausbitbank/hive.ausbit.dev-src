<template>
  <section v-if="names.length" class="skin-circle" aria-labelledby="skin-circle-title">
    <h2 id="skin-circle-title" class="skin-shelf__label">Hive Circle</h2>
    <ul class="skin-circle__list">
      <li v-for="name in names" :key="name" class="skin-circle__item">
        <router-link :to="'/@' + name" class="skin-circle__link" :aria-label="'@' + name + ' — Hive Circle'">
          <q-avatar size="42px" class="skin-circle__avatar">
            <q-img :src="avatarFor(name)" alt="" loading="lazy" />
          </q-avatar>
          <span class="skin-circle__name">{{ displayName(name) }}</span>
        </router-link>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.skin-circle__list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.skin-circle__item {
  min-width: 0;
}

.skin-circle__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  width: 68px;
  color: var(--skin-text, var(--c-text));
  font-size: 0.68rem;
  text-decoration: none;
}

.skin-circle__link:hover .skin-circle__name,
.skin-circle__link:focus-visible .skin-circle__name {
  color: var(--skin-primary, var(--c-primary));
  text-decoration: underline;
}

.skin-circle__avatar {
  border: 2px solid color-mix(in srgb, var(--skin-primary, var(--c-primary)) 55%, transparent);
}

.skin-circle__name {
  overflow: hidden;
  max-width: 100%;
  color: var(--skin-muted, var(--c-text-muted));
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<script>
import { safeJsonParse } from 'src/utils/safeHtml'
import { hiveAvatarUrl } from 'src/utils/avatar'

function profileFor (account) {
  if (!account) return {}
  if (account.profile && typeof account.profile === 'object') return account.profile
  return safeJsonParse(account.posting_json_metadata, {}).profile || {}
}

export default {
  name: 'HiveCircle',
  props: {
    names: { type: Array, default: () => [] },
    accounts: { type: Array, default: () => [] }
  },
  computed: {
    byName () {
      const map = new Map()
      for (const account of this.accounts) {
        if (account?.name) map.set(String(account.name).toLowerCase(), account)
      }
      return map
    }
  },
  methods: {
    avatarFor (name) {
      const account = this.byName.get(String(name).toLowerCase())
      const profile = profileFor(account)
      return profile.profile_image || hiveAvatarUrl(name, 'small')
    },
    displayName (name) {
      const account = this.byName.get(String(name).toLowerCase())
      const profile = profileFor(account)
      const display = typeof profile.name === 'string' ? profile.name.trim() : ''
      return display || name
    }
  }
}
</script>
