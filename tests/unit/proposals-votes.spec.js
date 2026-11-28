import { beforeEach, describe, expect, it, vi } from 'vitest'

const hive = vi.hoisted(() => ({
  api: { callAsync: vi.fn() }
}))

vi.mock('../../src/services/hive', () => ({ default: hive }))

const { getVoterVoteIds, listProposalVotes } = await import('../../src/services/proposals')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('proposal vote reads', () => {
  it('keeps only voters for the requested proposal', async () => {
    hive.api.callAsync.mockResolvedValue({
      proposal_votes: [
        { voter: 'alice', proposal: { id: 2 } },
        { voter: 'bob', proposal: { id: 3 } },
        { voter: 'carol', proposal: { id: 2 } }
      ]
    })

    const votes = await listProposalVotes(2)
    expect(votes.map(vote => vote.voter)).toEqual(['alice', 'carol'])
    expect(hive.api.callAsync).toHaveBeenCalledWith('database_api.list_proposal_votes', expect.objectContaining({
      start: [2],
      order: 'by_proposal_voter'
    }))
  })

  it('uses a voter cursor for the next page and still filters the proposal', async () => {
    hive.api.callAsync.mockResolvedValue({
      proposal_votes: [
        { voter: 'dave', proposal: { id: 2 } },
        { voter: 'erin', proposal: { id: 3 } }
      ]
    })

    const votes = await listProposalVotes(2, { startVoter: 'carol', limit: 2 })
    expect(votes.map(vote => vote.voter)).toEqual(['dave'])
    expect(hive.api.callAsync).toHaveBeenCalledWith('database_api.list_proposal_votes', expect.objectContaining({
      start: [2, 'carol'],
      limit: 2
    }))
  })

  it('keeps only the requested voter when listing their proposal ids', async () => {
    hive.api.callAsync.mockResolvedValue({
      proposal_votes: [
        { voter: 'alice', proposal: { id: 2 } },
        { voter: 'bob', proposal: { id: 3 } },
        { voter: 'alice', proposal: { id: 78 } }
      ]
    })

    await expect(getVoterVoteIds('@Alice')).resolves.toEqual(new Set([2, 78]))
    expect(hive.api.callAsync).toHaveBeenCalledWith('database_api.list_proposal_votes', expect.objectContaining({
      start: ['@Alice'],
      order: 'by_voter_proposal'
    }))
  })

  it('returns no ids for an empty voter', async () => {
    await expect(getVoterVoteIds('')).resolves.toEqual(new Set())
    expect(hive.api.callAsync).not.toHaveBeenCalled()
  })
})
