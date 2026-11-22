import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiListCommunities } = vi.hoisted(() => ({ apiListCommunities: vi.fn() }))

vi.mock('../../src/services/api', () => ({ apiListCommunities }))

async function chainData () {
  return import('../../src/services/chainData')
}

describe('fetchCommunityDirectoryPage', () => {
  beforeEach(() => {
    vi.resetModules()
    apiListCommunities.mockReset()
    apiListCommunities.mockResolvedValue([
      { name: 'hive-1', title: 'One' },
      null,
      { name: '', title: 'Bad' },
      { name: 'hive-2', title: 'Two' }
    ])
  })

  it('passes paging, query and sort to the bridge and drops malformed rows', async () => {
    const data = await chainData()
    const rows = await data.fetchCommunityDirectoryPage({
      sort: 'subs',
      query: '  photography ',
      last: 'hive-10',
      limit: 500
    })

    expect(apiListCommunities).toHaveBeenCalledWith({
      last: 'hive-10',
      limit: 100,
      query: 'photography',
      sort: 'subs'
    })
    expect(rows.map(row => row.name)).toEqual(['hive-1', 'hive-2'])
  })

  it('caches pages until forced and falls back to the rank sort', async () => {
    const data = await chainData()
    await data.fetchCommunityDirectoryPage({ sort: 'bogus', limit: 0 })
    await data.fetchCommunityDirectoryPage({ sort: 'bogus', limit: 0 })
    expect(apiListCommunities).toHaveBeenCalledTimes(1)
    expect(apiListCommunities).toHaveBeenLastCalledWith({
      last: '',
      limit: 36,
      query: null,
      sort: 'rank'
    })

    await data.fetchCommunityDirectoryPage({ sort: 'bogus', limit: 0, force: true })
    expect(apiListCommunities).toHaveBeenCalledTimes(2)
  })

  it('returns an empty list when the node sends a non-array response', async () => {
    apiListCommunities.mockResolvedValue(null)
    const data = await chainData()
    expect(await data.fetchCommunityDirectoryPage()).toEqual([])
  })
})
