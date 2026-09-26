import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

import { EuTenderSignals } from './EuTenderSignals'

beforeEach(() => {
  listProfiles.mockReset().mockResolvedValue([{ id: 'profile-1', name: 'Automation', current_version: { id: 'version-1', version: 2, configuration: { service_description: '', icp: {}, signals: [] }, icp_criteria: [], created_at: '2026-01-01' }, created_at: '2026-01-01', updated_at: '2026-01-01' }])
  searchEuTenders.mockReset().mockResolvedValue({ profile_id: 'profile-1', profile_name: 'Automation', query: 'automation OR workflow', total: 1, retrieved_at: '2026-09-26T12:00:00Z', warnings: [], opportunities: [], calls: [{ identifier: 'call-1', title: 'Automation services framework', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/call-1', status: 'open', start_date: null, deadline: '2026-12-31T00:00:00Z', programme: 'Digital Europe', summary: 'Services for process automation.', opportunity_type: 'public_procurement', budget: null }] })
})

test('searches EU calls explicitly and labels them as market demand', async () => {
  render(<EuTenderSignals />)
  expect(screen.getByText(/do not name or qualify companies/i)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'EU tender service profile' })).toHaveValue('profile-1'))
  expect(searchEuTenders).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Find matching calls' }))
  expect(await screen.findByRole('link', { name: 'Automation services framework' })).toHaveAttribute('href', expect.stringContaining('ec.europa.eu'))
  expect(searchEuTenders).toHaveBeenCalledWith('profile-1')
})
