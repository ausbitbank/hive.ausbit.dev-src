<template>
  <q-table :dense="$q.screen.lt.md || true" :grid="postTableGridStyle" label="Posts as table view" :data="filteredPosts" :columns="postTableColumns" :visible-columns="postTableColumnsVisible" row-key="post_id" :pagination="postTablePagination" separator="cell" :loading="loading">
    <template v-slot:top>
      <q-space />
      <q-checkbox v-model="postTableGridStyle" label="Grid" class="q-mr-xs" />
      <q-select v-model="postTableColumnsVisible" multiple outlined dense options-dense :display-value="$q.lang.table.columns" emit-value map-options :options="postTableColumns" option-value="name" options-cover style="min-width: 150px" />
      <q-btn dense flat color="primary" icon="archive" label="Export to csv" no-caps @click="exportTable" />
      <q-space />
    </template>
    <template v-slot:header="props">
      <q-tr :props="props">
        <q-th auto-width />
        <q-th v-for="col in props.cols" :key="col.name" :props="props" >
          {{ col.label }}
        </q-th>
      </q-tr>
    </template>
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td auto-width>
          <q-btn size="xs" color="primary" round dense @click="props.expand = !props.expand" :icon="props.expand ? 'remove' : 'add'" title="View Post" />
        </q-td>
        <q-td v-for="col in props.cols" :key="col.name" :props="props" >{{ col.value }}</q-td>
      </q-tr>
      <q-tr v-show="props.expand" :props="props">
        <q-td colspan="100%">
          <post-dialog :post="props.row" style="white-space: normal" />
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>
<script>
import { exportFile } from 'quasar'
function wrapCsvValue (val, formatFn) {
  let formatted = formatFn !== undefined
    ? formatFn(val)
    : val
  formatted = formatted === undefined || formatted === null
    ? ''
    : String(formatted)
  formatted = formatted.split('"').join('""')
  return `"${formatted}"`
}

export default {
  name: 'browseTable',
  props: ['filteredPosts'],
  data () {
    return {
      postTableColumns: [
        { name: 'author', label: 'Author', field: 'author', required: false, sortable: true, align: 'left' },
        { name: 'title', label: 'Title', field: row => row.title, format: val => `${val.substring(0, 100)}`, required: false, sortable: true, align: 'left' },
        { name: 'post_id', label: 'Post Id', field: 'post_id', required: false, sortable: true, align: 'left' },
        { name: 'permlink', label: 'Permlink', field: 'permlink', required: false, sortable: true, align: 'left' },
        { name: 'created', label: 'Created', field: 'created', required: false, sortable: true, align: 'left' },
        { name: 'payout_at', label: 'Payout At', field: 'payout_at', required: false, sortable: true, align: 'left' },
        { name: 'is_paidout', label: 'Paid Out', field: 'is_paidout', required: false, sortable: true, align: 'left' },
        { name: 'payout', label: 'Payout', field: 'payout', required: false, sortable: true, align: 'left' },
        { name: 'updated', label: 'Updated', field: 'updated', required: false, sortable: true, align: 'left' },
        { name: 'children', label: 'Comments', field: 'children', required: false, sortable: true, align: 'left' },
        { name: 'category', label: 'Category', field: 'category', required: false, sortable: true, align: 'left' },
        { name: 'beneficiaries', label: 'Beneficiaries', field: 'beneficiaries', format: val => `${JSON.stringify(val)}`, required: false, sortable: true, align: 'left' },
        { name: 'app', label: 'App', field: row => row.json_metadata.app, required: false, sortable: true, align: 'left' },
        { name: 'format', label: 'Format', field: row => row.json_metadata.format, required: false, sortable: true, align: 'left' },
        { name: 'total_votes', label: 'Total Votes', field: row => row.stats.total_votes, required: false, sortable: true, align: 'left' },
        { name: 'flag_weight', label: 'Flag Weight', field: row => row.stats.flag_weight, required: false, sortable: true, align: 'left' },
        { name: 'author_reputation', label: 'Author Reputation', field: 'author_reputation', required: false, sortable: true, align: 'left' },
        { name: 'url', label: 'Url', field: 'url', required: false, sortable: true, align: 'left' },
        { name: 'community', label: 'Community', field: 'community', required: false, sortable: true, align: 'left' },
        { name: 'community_title', label: 'Community Title', field: 'community_title', required: false, sortable: true, align: 'left' },
        { name: 'author_role', label: 'Author Role', field: 'author_role', required: false, sortable: true, align: 'left' },
        { name: 'author_title', label: 'Author Title', field: 'author_title', required: false, sortable: true, align: 'left' },
        { name: 'community_title', label: 'Community Title', field: 'community_title', required: false, sortable: true, align: 'left' },
        { name: 'tags', label: 'Tags', field: row => row.json_metadata.tags.join(', '), required: false, sortable: false, align: 'left' },
        { name: 'pending_payout_value', label: 'Pending Payout Value', field: 'pending_payout_value', required: false, sortable: true, sort: (a, b, rowA, rowB) => parseFloat(a.split(' ')[0]) - parseFloat(b.split(' ')[0]), align: 'left' },
        { name: 'author_payout_value', label: 'Author Payout Value', field: 'author_payout_value', required: false, sortable: true, sort: (a, b, rowA, rowB) => parseFloat(a.split(' ')[0]) - parseFloat(b.split(' ')[0]), align: 'left' },
        { name: 'curator_payout_value', label: 'Curator Payout Value', field: 'curator_payout_value', required: false, sortable: true, sort: (a, b, rowA, rowB) => parseFloat(a.split(' ')[0]) - parseFloat(b.split(' ')[0]), align: 'left' },
        { name: 'promoted', label: 'Promotion Value', field: 'promoted', required: false, sortable: true, sort: (a, b, rowA, rowB) => parseFloat(a.split(' ')[0]) - parseFloat(b.split(' ')[0]), align: 'left' }
      ],
      postTableColumnsVisible: ['author', 'title', 'pending_payout_value'],
      postTableGridStyle: false,
      postTablePagination: { rowsPerPage: 0 }
    }
  },
  components: {
    postDialog: () => import('components/postDialog.vue')
  },
  methods: {
    returnPostPath (author, permlink) { return '/@' + author + '/' + permlink },
    exportTable () { // naive encoding to csv format
      const content = [this.postTableColumns.map(col => wrapCsvValue(col.label))].concat(
        this.filteredPosts.map(row => this.postTableColumns.map(col => wrapCsvValue(
          typeof col.field === 'function'
            ? col.field(row)
            : row[col.field === undefined ? col.name : col.field],
          col.format
        )).join(','))
      ).join('\r\n')
      const status = exportFile('posts-expost.csv', content, 'text/csv')
      if (status !== true) { this.$q.notify({ message: 'Browser denied file download...', color: 'negative', icon: 'warning' }) }
    }
  },
  mounted () {
    if (this.$route.query.columns) {
      this.postTableColumnsVisible = this.$route.query.columns.split(',')
    }
  }
}
</script>
