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
