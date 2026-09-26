import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { DiscoveryWorkspace } from './DiscoveryWorkspace'
import { listProfiles } from '../../api/profiles'
import { createDiscoveryRun, confirmDiscoveryRun, listDiscoveryRegions } from '../../api/discovery'
import { submitResearch } from '../../api/research'

vi.mock('../../api/profiles', () => ({
  listProfiles: vi.fn(),
  selectDefaultProfile: (profiles: unknown[]) => profiles[0],
}))
vi.mock('../../api/discovery', () => ({ createDiscoveryRun: vi.fn(), confirmDiscoveryRun: vi.fn(), listDiscoveryRegions: vi.fn() }))
vi.mock('../../api/research', () => ({ submitResearch: vi.fn(), importCompanies: vi.fn() }))
let version = 0
const candidate = { entity_id: 'Q1', name: 'Example SA', domain: 'example.ro', country_code: 'RO', country_name: 'Romania', industry: 'Logistics', employee_count: 2500, size_verification: 'needs_verification' as const, discovery_confidence: 0.55, source_url: 'https://www.wikidata.org/wiki/Q1' }
const run = { id: 'run', status: 'completed', request: { country_codes: ['RO'], minimum_employees: 1000, include_unknown_size: true, industry: null, limit: 100 }, candidates: [candidate], confirmed_domains: [], created_at: '2026-09-25T00:00:00Z' }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); version++
  vi.mocked(listProfiles).mockResolvedValue([{ id: 'profile', name: 'Automation', current_version: { id: `version-${version}`, version: 1, configuration: { service_description: 'Automation', icp: { geographies: ['Romania'], industries: ['Logistics'], company_size: '1,000+ employees' }, signals: [] }, created_at: '' }, created_at: '', updated_at: '' }])
  vi.mocked(listDiscoveryRegions).mockResolvedValue([{ id: 'eastern-europe', name: 'Eastern Europe', country_codes: ['RO'] }, { id: 'north-america', name: 'North America', country_codes: ['US', 'CA'] }])
  vi.mocked(createDiscoveryRun).mockResolvedValue(run)
  vi.mocked(confirmDiscoveryRun).mockResolvedValue({ run, company_ids: ['company'] })
  vi.mocked(submitResearch).mockResolvedValue({ id: 'research' } as never)
})

test('switches discovery region and sends its country set to the API', async () => {
  render(<DiscoveryWorkspace />)
  await screen.findByRole('button', { name: 'Example SA' })

  fireEvent.change(screen.getByRole('combobox', { name: 'Region for discovery' }), { target: { value: 'north-america' } })

  expect(createDiscoveryRun).toHaveBeenLastCalledWith(expect.objectContaining({ country_codes: ['US', 'CA'] }), expect.any(AbortSignal))
})

test('automatically uses the saved profile and queues selected research', async () => {
  render(<DiscoveryWorkspace />)
  expect(await screen.findByRole('button', { name: 'Example SA' })).toBeInTheDocument()
  expect(createDiscoveryRun).toHaveBeenCalledWith(expect.objectContaining({ country_codes: ['RO'], minimum_employees: 1000 }), expect.any(AbortSignal))
  expect(screen.getByText(/2[,.]500/)).toBeInTheDocument()
  expect(screen.queryByText(/Unconfirmed/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Research selected' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Example SA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Research selected' }))
  expect(await screen.findByText(/1 company queued/)).toBeInTheDocument()
  expect(submitResearch).toHaveBeenCalledWith('company', `version-${version}`, `discovery-run-version-${version}-company`)
})

test('keeps results and selections when returning, and opens source details', async () => {
  const first = render(<DiscoveryWorkspace />)
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Example SA' }))
  first.unmount()
  render(<DiscoveryWorkspace />)
  expect(await screen.findByRole('checkbox', { name: 'Select Example SA' })).toBeChecked()
  expect(createDiscoveryRun).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Example SA' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /View company information/ })).toHaveAttribute('href', candidate.source_url)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('keeps failed research selected for retry', async () => {
  vi.mocked(submitResearch).mockRejectedValue(new Error('Unavailable'))
  render(<DiscoveryWorkspace />)
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Example SA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Research selected' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('remain selected')
  expect(screen.getByRole('checkbox', { name: 'Select Example SA' })).toBeChecked()
})

test('loads another 25 results and filters without searching again', async () => {
  vi.mocked(createDiscoveryRun).mockResolvedValue({ ...run, candidates: Array.from({ length: 30 }, (_, index) => ({ ...candidate, name: `Company ${index}`, domain: `company${index}.ro` })) })
  render(<DiscoveryWorkspace />)
  await screen.findByRole('button', { name: 'Load more' })
  expect(screen.getAllByRole('checkbox')).toHaveLength(25)
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(30)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search companies' }), { target: { value: 'company29.ro' } })
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  expect(createDiscoveryRun).toHaveBeenCalledTimes(1)
})

test('sorts discovered companies by clicking column headings', async () => {
  vi.mocked(createDiscoveryRun).mockResolvedValue({ ...run, candidates: [
    { ...candidate, name: 'Alpha', domain: 'alpha.ro', employee_count: 100 },
    { ...candidate, name: 'Zeta', domain: 'zeta.ro', employee_count: 5000 },
  ] })
  render(<DiscoveryWorkspace />)
  await screen.findByRole('button', { name: 'Alpha' })

  fireEvent.click(screen.getByRole('button', { name: /^Sort by Employee count/ }))
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Zeta')
  fireEvent.click(screen.getByRole('button', { name: /^Sort by Company/ }))
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alpha')
  expect(screen.queryByRole('button', { name: /^Sort by Confidence/ })).not.toBeInTheDocument()
})

test('discovers and queues companies for the selected service profile', async () => {
  vi.mocked(listProfiles).mockResolvedValue([
    { id: 'rpa', name: 'RPA', current_version: { id: 'rpa-version', version: 1, configuration: { service_description: 'Automation', icp: { geographies: ['Romania'], industries: ['Logistics'] }, signals: [] }, created_at: '' }, created_at: '', updated_at: '' },
    { id: 'cyber', name: 'Cybersecurity', current_version: { id: 'cyber-version', version: 1, configuration: { service_description: 'Security', icp: { geographies: ['Romania'], industries: ['Financial services'] }, signals: [] }, created_at: '' }, created_at: '', updated_at: '' },
  ])
  render(<DiscoveryWorkspace />)
  await screen.findByRole('button', { name: 'Example SA' })

  fireEvent.change(screen.getByRole('combobox', { name: 'Service profile for discovery' }), { target: { value: 'cyber' } })
  await vi.waitFor(() => expect(createDiscoveryRun).toHaveBeenLastCalledWith(expect.objectContaining({ industries: ['Financial services'] }), expect.any(AbortSignal)))
  expect(screen.getByRole('combobox', { name: 'Service profile for discovery' })).toHaveValue('cyber')
  expect(screen.getByText(/Financial services/)).toBeInTheDocument()

  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Example SA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Research selected' }))
  await vi.waitFor(() => expect(submitResearch).toHaveBeenCalledWith('company', 'cyber-version', 'discovery-run-cyber-version-company'))
})
