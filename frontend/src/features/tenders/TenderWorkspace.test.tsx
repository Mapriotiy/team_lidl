import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const { analyzeEuTender, listProfiles, searchEuTenders, searchMoldovaTenders } = vi.hoisted(() => ({
  analyzeEuTender: vi.fn(),
  listProfiles: vi.fn(),
  searchEuTenders: vi.fn(),
  searchMoldovaTenders: vi.fn(),
}))

vi.mock('../../api/profiles', async (load) => ({
  ...await load<typeof import('../../api/profiles')>(),
  listProfiles,
}))
vi.mock('../../api/euTenders', () => ({ analyzeEuTender, searchEuTenders, searchMoldovaTenders }))

import { TenderWorkspace } from './TenderWorkspace'

beforeEach(() => {
  listProfiles.mockReset().mockResolvedValue([{ id: 'profile-1', name: 'RPA', current_version: { id: 'version-1', version: 1, configuration: { service_description: '', icp: {}, signals: [] }, icp_criteria: [], created_at: '2026-01-01' }, created_at: '2026-01-01', updated_at: '2026-01-01' }])
  searchEuTenders.mockReset().mockResolvedValue({
    profile_id: 'profile-1', profile_name: 'RPA', query: 'automation', queries: ['automation', 'process automation'], total: 8, retrieved_at: '2026-09-26T12:00:00Z', warnings: [], calls: [],
    opportunities: [{
      call: { identifier: 'DIGITAL-2026', title: 'Automation services framework', url: 'https://example.eu/call', status: 'open', start_date: null, deadline: '2026-12-31T00:00:00Z', programme: 'Digital Europe', summary: 'Public buyers seek process automation expertise.', opportunity_type: 'public_procurement', budget: 2_000_000, currency: 'EUR', source: 'eu' },
      fit_score: 75, recommendation: 'partner', matched_terms: ['automation', 'workflow'], risks: ['Eligibility requirements have not been extracted yet.'], decision_summary: 'Relevant funded demand exists, but participation needs verification.', next_actions: ['Verify applicant eligibility.', 'Find a consortium partner.'],
      dimensions: [
        { id: 'capability_fit', label: 'Capability fit', score: 90, explanation: 'Two service-profile terms match.' },
        { id: 'eligibility', label: 'Eligibility', score: null, explanation: 'Not available from search metadata.' },
      ],
    }],
  })
  searchMoldovaTenders.mockReset().mockResolvedValue({ profile_id: 'profile-1', profile_name: 'RPA', query: 'automatizare', queries: ['automatizare'], total: 0, retrieved_at: '2026-09-26T12:00:00Z', warnings: [], calls: [], opportunities: [] })
  analyzeEuTender.mockReset().mockResolvedValue({ decision: 'partner_search', confidence: 67, evidence_coverage: 60, source_url: 'https://example.eu/call', retrieved_at: '2026-09-26T12:00:00Z', warnings: [], blockers: ['Consortium requirements are not evidenced.'], next_actions: ['Find a partner.'], facts: [{ category: 'eligibility', label: 'Applicant eligibility', status: 'supported', finding: 'Eligibility language was found.', excerpt: 'Eligible applicants are SMEs.', source_url: 'https://example.eu/call' }] })
})

test('turns portal calls into an explainable tender decision brief', async () => {
  render(<TenderWorkspace />)

  await waitFor(() => expect(searchEuTenders).toHaveBeenCalledWith('profile-1', 20))
  expect(searchMoldovaTenders).toHaveBeenCalledWith('profile-1', 20)
  expect(await screen.findByRole('heading', { name: 'Automation services framework' })).toBeInTheDocument()
  expect(screen.getAllByText('Find a partner').length).toBeGreaterThan(0)
  expect(screen.getAllByText('75')).toHaveLength(2)
  expect(screen.getByText('Programmes represented')).toBeInTheDocument()
  expect(screen.getByText('Screening decision')).toBeInTheDocument()
  expect(screen.getByText('Recommended next steps')).toBeInTheDocument()
  expect(screen.getByText('Eligibility')).toBeInTheDocument()
  expect(screen.getByText('Unknown')).toBeInTheDocument()
  expect(screen.getByLabelText('Search portfolio')).toHaveTextContent('process automation')
  expect(screen.getByText('Eligibility requirements have not been extracted yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /open official call/i })).toHaveAttribute('href', 'https://example.eu/call')

  fireEvent.click(screen.getByRole('button', { name: 'Analyze official source' }))
  expect(await screen.findByText('Partner search')).toBeInTheDocument()
  expect(screen.getByText(/eligible applicants are SMEs/i)).toBeInTheDocument()
  expect(analyzeEuTender).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'DIGITAL-2026' }))
})
