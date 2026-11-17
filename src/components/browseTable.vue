<template>
  <q-table
    flat
    dense
    :rows="filteredPosts"
    :columns="postTableColumns"
    :visible-columns="postTableColumnsVisible"
    :row-key="row => row.post_id || (row.author + '/' + row.permlink)"
    :pagination="postTablePagination"
    separator="horizontal"
    :loading="loading"
    class="browse-table"
    no-data-label="No posts match the current view"
  >
    <template v-slot:top>
      <div class="browse-table__top">
        <div class="browse-table__label">
          <q-icon name="table_rows" size="18px" aria-hidden="true" />
          Posts table
        </div>
        <div class="browse-table__actions">
          <q-select
            v-model="postTableColumnsVisible"
            multiple
            outlined
            dense
            options-dense
            :display-value="$q.lang.table.columns"
            emit-value
            map-options
            :options="postTableColumns"
            option-value="name"
            options-cover
            class="browse-table__columns"
            aria-label="Choose table columns"
          />
          <q-btn flat dense round icon="restart_alt" aria-label="Reset table columns" title="Reset table columns" @click="resetColumns" />
          <q-btn dense outline no-caps color="primary" icon="download" label="Export CSV" @click="exportTable" />
        </div>
      </div>
    </template>

    <template v-slot:header="props">
      <q-tr :props="props">
        <q-th auto-width />
        <q-th v-for="col in props.cols" :key="col.name" :props="props">{{ col.label }}</q-th>
      </q-tr>
    </template>

    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td auto-width>
          <q-btn
            size="sm"
            color="primary"
            flat
            round
            dense
            @click="props.expand = !props.expand"
            :icon="props.expand ? 'expand_less' : 'expand_more'"
            title="View post"
            aria-label="View post details"
          />
        </q-td>
        <q-td v-for="col in props.cols" :key="col.name" :props="props">
          <router-link
            v-if="col.name === 'title'"
            :to="returnPostPath(props.row.author, props.row.permlink)"
          >
            {{ col.value }}
          </router-link>
          <span v-else>{{ col.value }}</span>
        </q-td>
      </q-tr>
      <q-tr v-if="props.expand" :props="props">
        <q-td colspan="100%">
          <post-dialog :post="props.row" style="white-space: normal" />
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<style scoped>
.browse-table {
  border-radius: var(--radius-card);
  overflow: hidden;
}

.browse-table__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.browse-table__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #b0bec5;
  font-size: 0.85rem;
  font-weight: 600;
}

.browse-table__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.browse-table__columns {
  min-width: 130px;
}

.browse-table :deep(td a) {
  color: #4fc3f7;
}
</style>

<script>
import { defineAsyncComponent } from 'vue'
import moment from 'src/utils/time'
import { exportFile } from 'quasar'

function wrapCsvValue (val, formatFn) {
  let formatted = formatFn !== undefined ? formatFn(val) : val
  formatted = formatted === undefined || formatted === null ? '' : String(formatted)
  formatted = formatted.split('"').join('""')
  return `"${formatted}"`
}

const DEFAULT_VISIBLE_COLUMNS = ['author', 'title', 'pending_payout_value', 'children', 'created']

export default {
  name: 'browseTable',
  props: ['filteredPosts', 'loading'],
  data () {
    return {
      postTableColumns: [
        { name: 'author', label: 'Author', field: 'author', required: false, sortable: true, align: 'left' },
        { name: 'title', label: 'Title', field: row => row.title || ('Comment by @' + row.author), format: val => `${String(val).substring(0, 100)}`, required: false, sortable: true, align: 'left' },
        { name: 'post_id', label: 'Post ID', field: 'post_id', required: false, sortable: true, align: 'left' },
        { name: 'permlink', label: 'Permlink', field: 'permlink', required: false, sortable: true, align: 'left' },
        { name: 'created', label: 'Created', field: 'created', required: false, sortable: true, align: 'left', format: val => val ? moment.utc(val).format('D MMM YY') : '' },
        { name: 'payout_at', label: 'Payout At', field: 'payout_at', required: false, sortable: true, align: 'left', format: val => val ? moment.utc(val).format('D MMM YY') : '' },
        { name: 'is_paidout', label: 'Paid Out', field: 'is_paidout', required: false, sortable: true, align: 'left' },
        { name: 'payout', label: 'Payout', field: 'payout', required: false, sortable: true, align: 'left' },
        { name: 'updated', label: 'Updated', field: 'updated', required: false, sortable: true, align: 'left', format: val => val ? moment.utc(val).format('D MMM YY') : '' },
        { name: 'children', label: 'Comments', field: 'children', required: false, sortable: true, align: 'left' },
        { name: 'category', label: 'Category', field: 'category', required: false, sortable: true, align: 'left' },
        { name: 'beneficiaries', label: 'Beneficiaries', field: 'beneficiaries', format: val => `${JSON.stringify(val)}`, required: false, sortable: true, align: 'left' },
        { name: 'app', label: 'App', field: row => (row.json_metadata && row.json_metadata.app) || '', required: false, sortable: true, align: 'left' },
        { name: 'format', label: 'Format', field: row => (row.json_metadata && row.json_metadata.format) || '', required: false, sortable: true, align: 'left' },
        { name: 'total_votes', label: 'Total Votes', field: row => (row.stats && row.stats.total_votes) || '', required: false, sortable: true, align: 'left' },
        { name: 'flag_weight', label: 'Flag Weight', field: row => (row.stats && row.stats.flag_weight) || '', required: false, sortable: true, align: 'left' },
        { name: 'author_reputation', label: 'Author Reputation', field: 'author_reputation', required: false, sortable: true, align: 'left' },
        { name: 'url', label: 'URL', field: 'url', required: false, sortable: true, align: 'left' },
        { name: 'community', label: 'Community', field: 'community', required: false, sortable: true, align: 'left' },
        { name: 'community_title', label: 'Community Title', field: 'community_title', required: false, sortable: true, align: 'left' },
        { name: 'author_role', label: 'Author Role', field: 'author_role', required: false, sortable: true, align: 'left' },
        { name: 'author_title', label: 'Author Title', field: 'author_title', required: false, sortable: true, align: 'left' },
        { name: 'tags', label: 'Tags', field: row => (row.json_metadata && Array.isArray(row.json_metadata.tags) ? row.json_metadata.tags.join(', ') : ''), required: false, sortable: false, align: 'left' },
        { name: 'pending_payout_value', label: 'Pending Payout', field: 'pending_payout_value', required: false, sortable: true, sort: (a, b) => parseFloat(a) - parseFloat(b), align: 'left' },
        { name: 'author_payout_value', label: 'Author Payout', field: 'author_payout_value', required: false, sortable: true, sort: (a, b) => parseFloat(a) - parseFloat(b), align: 'left' },
        { name: 'curator_payout_value', label: 'Curator Payout', field: 'curator_payout_value', required: false, sortable: true, sort: (a, b) => parseFloat(a) - parseFloat(b), align: 'left' },
        { name: 'promoted', label: 'Promotion Value', field: 'promoted', required: false, sortable: true, sort: (a, b) => parseFloat(a) - parseFloat(b), align: 'left' }
      ],
      postTableColumnsVisible: [...DEFAULT_VISIBLE_COLUMNS],
      postTablePagination: { rowsPerPage: 0 }
    }
  },
  components: {
    postDialog: defineAsyncComponent(() => import('components/postDialog.vue'))
  },
  watch: {
    postTableColumnsVisible (value) {
      if (!Array.isArray(value) || value.length === 0) {
        this.postTableColumnsVisible = ['author', 'title']
      }
    }
  },
  methods: {
    returnPostPath (author, permlink) { return '/@' + author + '/' + permlink },
    resetColumns () {
      this.postTableColumnsVisible = [...DEFAULT_VISIBLE_COLUMNS]
    },
    exportTable () {
      const content = [this.postTableColumns.map(col => wrapCsvValue(col.label))].concat(
        this.filteredPosts.map(row => this.postTableColumns.map(col => wrapCsvValue(
          typeof col.field === 'function'
            ? col.field(row)
            : row[col.field === undefined ? col.name : col.field],
          col.format
        )).join(','))
      ).join('\r\n')
      const status = exportFile('posts-export.csv', content, 'text/csv')
      if (status !== true) { this.$q.notify({ message: 'Browser denied file download...', color: 'negative', icon: 'warning' }) }
    }
  },
  mounted () {
    const requested = String(this.$route.query.columns || '')
      .split(',')
      .map(name => name.trim())
      .filter(name => this.postTableColumns.some(column => column.name === name))

    if (requested.length) this.postTableColumnsVisible = requested
  }
}
</script>
