import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const { listProfiles, searchEuTenders } = vi.hoisted(() => ({
  listProfiles: vi.fn(),
  searchEuTenders: vi.fn(),
}))

vi.mock('../../api/profiles', async (load) => ({
  ...await load<typeof import('../../api/profiles')>(),
  listProfiles,
}))
vi.mock('../../api/euTenders', () => ({ searchEuTenders }))

import { TenderWorkspace } from './TenderWorkspace'

beforeEach(() => {
  listProfiles.mockReset().mockResolvedValue([{ id: 'profile-1', name: 'RPA', current_version: { id: 'version-1', version: 1, configuration: { service_description: '', icp: {}, signals: [] }, icp_criteria: [], created_at: '2026-01-01' }, created_at: '2026-01-01', updated_at: '2026-01-01' }])
  searchEuTenders.mockReset().mockResolvedValue({
    profile_id: 'profile-1', profile_name: 'RPA', query: 'automation', queries: ['automation', 'process automation'], total: 8, retrieved_at: '2026-09-26T12:00:00Z', warnings: [], calls: [],
    opportunities: [{
      call: { identifier: 'DIGITAL-2026', title: 'Automation services framework', url: 'https://example.eu/call', status: 'open', start_date: null, deadline: '2026-12-31T00:00:00Z', programme: 'Digital Europe', summary: 'Public buyers seek process automation expertise.', opportunity_type: 'public_procurement', budget: 2_000_000 },
      fit_score: 79, recommendation: 'partner', matched_terms: ['automation', 'workflow'], risks: ['Eligibility requirements have not been extracted yet.'], decision_summary: 'Relevant funded demand exists, but participation needs verification.', next_actions: ['Verify applicant eligibility.', 'Find a consortium partner.'],
      dimensions: [
        { id: 'capability_fit', label: 'Capability fit', score: 90, explanation: 'Two service-profile terms match.' },
        { id: 'eligibility', label: 'Eligibility', score: null, explanation: 'Not available from search metadata.' },
      ],
    }],
  })
})

test('turns portal calls into an explainable tender decision brief', async () => {
  render(<TenderWorkspace />)

  await waitFor(() => expect(searchEuTenders).toHaveBeenCalledWith('profile-1', 20))
  expect(await screen.findByRole('heading', { name: 'Automation services framework' })).toBeInTheDocument()
  expect(screen.getAllByText('Find a partner').length).toBeGreaterThan(0)
  expect(screen.getAllByText('79')).toHaveLength(2)
  expect(screen.getByText('Programmes represented')).toBeInTheDocument()
  expect(screen.getByText('Screening decision')).toBeInTheDocument()
  expect(screen.getByText('Recommended next steps')).toBeInTheDocument()
  expect(screen.getByText('Eligibility')).toBeInTheDocument()
  expect(screen.getByText('Unknown')).toBeInTheDocument()
  expect(screen.getByLabelText('Search portfolio')).toHaveTextContent('process automation')
  expect(screen.getByText('Eligibility requirements have not been extracted yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /open official call/i })).toHaveAttribute('href', 'https://example.eu/call')
})
