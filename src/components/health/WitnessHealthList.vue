<template>
  <q-card flat bordered class="health-witness-card">
    <ul class="health-witness-list">
      <li v-for="row in rows" :key="row.owner" class="health-witness" :class="'health-witness--' + row.status">
        <span class="health-witness__rank">{{ row.rank ? '#' + row.rank : '—' }}</span>
        <router-link :to="'/@' + row.owner" class="health-witness__avatar" :aria-label="'View @' + row.owner + ' profile'">
          <q-avatar size="30px">
            <q-img :src="avatarUrl(row.owner)" :alt="'Avatar of @' + row.owner" />
          </q-avatar>
        </router-link>
        <div class="health-witness__body">
          <div class="health-witness__title">
            <router-link :to="'/@' + row.owner">{{ row.owner }}</router-link>
            <q-badge v-if="row.scheduled" color="green-9" text-color="white" class="health-witness__badge">Scheduled</q-badge>
            <q-badge v-else-if="row.rank && row.rank <= 21" color="green-9" text-color="white" class="health-witness__badge">Top 21</q-badge>
            <q-badge :color="row.status === 'critical' ? 'red-9' : (row.status === 'warning' ? 'orange-9' : 'green-9')" :text-color="row.status === 'warning' ? 'black' : 'white'" class="health-witness__badge">
              v{{ row.running_version || '?' }}
            </q-badge>
          </div>
          <div class="health-witness__meta">
            <span>{{ row.votesHp }}</span>
            <span>Missed {{ row.missed }}</span>
            <span>Feed {{ row.feedAge }}</span>
          </div>
          <ul v-if="row.primaryWarnings.length" class="health-witness__warnings">
            <li v-for="warning in row.primaryWarnings" :key="warning.id">{{ warning.label }}</li>
          </ul>
        </div>
        <q-icon
          :name="row.status === 'critical' ? 'error' : (row.status === 'warning' ? 'warning' : 'check_circle')"
          :color="row.status === 'critical' ? 'red' : (row.status === 'warning' ? 'orange' : 'green')"
          size="18px"
          :aria-label="row.status === 'ok' ? 'Witness healthy' : 'Witness has ' + row.status + ' warnings'"
        />
      </li>
    </ul>

    <div v-if="!rows.length" class="net-state">
      <q-icon name="emoji_people" size="2em" color="grey" aria-hidden="true" />
      <div>No witness data available.</div>
    </div>
  </q-card>
</template>

<style scoped>
.health-witness-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.025);
}

.health-witness-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.health-witness {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.55rem 0.8rem;
  border-top: 1px solid var(--border-subtle);
}

.health-witness:first-child {
  border-top: 0;
}

.health-witness--critical {
  box-shadow: inset 3px 0 0 rgba(239, 83, 80, 0.8);
}

.health-witness--warning {
  box-shadow: inset 3px 0 0 rgba(255, 183, 77, 0.65);
}

.health-witness__rank {
  flex: none;
  width: 2rem;
  padding-top: 0.3rem;
  color: #78909c;
  font-size: 0.7rem;
  font-weight: 600;
  text-align: right;
}

.health-witness__avatar {
  display: inline-flex;
  flex: none;
  padding-top: 0.05rem;
}

.health-witness__body {
  flex: 1;
  min-width: 0;
}

.health-witness__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.health-witness__title a {
  color: #e4eaed;
  font-size: 0.83rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.health-witness__title a:hover {
  color: #81d4fa;
}

.health-witness__badge {
  font-size: 0.56rem;
}

.health-witness__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.65rem;
  color: #90a4ae;
  font-size: 0.68rem;
}

.health-witness__warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.5rem;
  margin: 0.18rem 0 0;
  padding: 0;
  list-style: none;
  color: #ffcc80;
  font-size: 0.68rem;
}

.health-witness__warnings li::before {
  content: '! ';
  font-weight: 700;
}
</style>

<script>
export default {
  name: 'WitnessHealthList',
  props: {
    rows: { type: Array, default: () => [] },
    globalProps: { type: Object, default: null }
  },
  methods: {
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    }
  }
}
</script>
