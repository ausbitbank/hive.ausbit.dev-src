<template>
  <dl class="props-list">
    <div v-for="prop in entries" :key="prop[0]" class="props-row">
      <dt class="props-row__label">{{ prop[0] }}</dt>
      <dd class="props-row__value">
        <router-link v-if="accountLinks.includes(prop[0]) && prop[1]" :to="returnAccountLink(prop[1])">@{{ prop[1] }}</router-link>
        <a v-else-if="prop[0] === 'url' && safeWebsite(prop[1])" :href="safeWebsite(prop[1])" target="_blank" rel="noopener noreferrer">
          {{ prop[1] }}
          <q-icon name="open_in_new" size="13px" aria-hidden="true" />
        </a>
        <template v-else>{{ prop[1] }}</template>
      </dd>
    </div>
  </dl>
</template>
<script>
import { safeExternalUrl } from 'src/utils/safeUrl'

export default {
  name: 'propsList',
  props: ['obj', 'ignoreKeys'],
  data () {
    return {
      accountLinks: ['proxy', 'recovery_account', 'reset_account', 'owner']
    }
  },
  computed: {
    entries () {
      const ignored = Array.isArray(this.ignoreKeys) ? this.ignoreKeys : []
      return Object.entries(this.obj || {}).filter(([key]) => !ignored.includes(key))
    }
  },
  methods: {
    returnAccountLink (account) { return '/@' + account },
    safeWebsite (value) { return safeExternalUrl(value) }
  }
}
</script>

<style scoped>
.props-list {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.props-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.35rem 0;
  border-top: 1px solid var(--border-subtle);
}

.props-row:first-child {
  border-top: 0;
}

.props-row__label {
  flex: none;
  max-width: 45%;
  color: #90a4ae;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.props-row__value {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: #e4eaed;
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}

.props-row__value a {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  color: #4fc3f7;
  font-weight: 500;
  text-decoration: none;
}

.props-row__value a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.props-row__value a .q-icon {
  color: #78909c;
}
</style>
