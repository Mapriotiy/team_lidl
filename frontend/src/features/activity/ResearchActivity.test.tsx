import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ResearchActivityWorkspace } from './ResearchActivity'
import * as repository from '../companies/repository'
import { companyFixture } from '../companies/fixtures'

afterEach(() => vi.restoreAllMocks())

test('shows only the current selection and links to complete research history', async () => {
  const historical = { ...structuredClone(companyFixture), id: 'company-history', name: 'Historical Company', domain: 'history.example' }
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: companyFixture.id }, { id: historical.id }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.spyOn(repository, 'getCompany').mockImplementation(async (id) => structuredClone(id === historical.id ? historical : companyFixture))
  const onOpenHistory = vi.fn()

  render(<ResearchActivityWorkspace companyIds={[companyFixture.id]} onOpenHistory={onOpenHistory} />)

  expect((await screen.findAllByText(companyFixture.name)).length).toBeGreaterThan(0)
  expect(screen.queryByText(historical.name)).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Selected company research' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'View research history' }))
  expect(onOpenHistory).toHaveBeenCalledOnce()
})

test.each([0, 1])('shows Not enough data for a finished run with %i sources despite supported signals', async (count) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: companyFixture.id }]), { status: 200 }))
  vi.spyOn(repository, 'getCompany').mockResolvedValue({
    ...structuredClone(companyFixture),
    sources: Array.from({ length: count }, (_, index) => ({ id: `source-${index}`, title: 'Source', url: 'https://example.com', type: 'company', retrievedAt: '2026-09-25T00:00:00Z', publicationDate: null })),
  })

  render(<ResearchActivityWorkspace />)

  expect(await screen.findByText('Not enough data')).toBeInTheDocument()
  expect(screen.queryByText('Promising')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open research for Lufthansa Group' }))
  expect(screen.getByText(/At least 2 distinct sources are required/)).toBeInTheDocument()
  expect(screen.queryByText(/One careers page was blocked/)).not.toBeInTheDocument()
})

test('does not turn completed checks without evidence into research confidence', async () => {
  const company = {
    ...structuredClone(companyFixture),
    id: 'company-without-signals',
    name: 'No Signal Company',
    coverage: 0,
    evidence: [],
    assessments: Array.from({ length: 6 }, (_, index) => ({ id: `assessment-${index}`, question: `Signal ${index}`, status: 'insufficient_evidence' as const, strength: null, interpretation: 'No direct evidence found.', evidenceIds: [] })),
    sources: Array.from({ length: 7 }, (_, index) => ({ id: `source-${index}`, title: `Source ${index}`, url: `https://example.com/${index}`, type: 'company', retrievedAt: '2026-09-26T12:00:00Z', publicationDate: null })),
    researchRuns: [{ id: 'partial-run', profileVersionId: 'profile-version-rpa-1', status: 'partial' as const, startedAt: '2026-09-26T12:00:00Z', finishedAt: '2026-09-26T12:05:00Z', collected: 7, collectionTotal: 11, assessed: 6, assessmentTotal: 6, warning: 'Four pages could not be collected.' }],
  }
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: company.id }]), { status: 200 }))
  vi.spyOn(repository, 'getCompany').mockResolvedValue(company)

  render(<ResearchActivityWorkspace />)

  expect(await screen.findByText('Needs attention')).toBeInTheDocument()
  expect(screen.getByText('0%')).toBeInTheDocument()
  expect(screen.getByText('No verified signals')).toBeInTheDocument()
  expect(screen.queryByText('60%')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open research for No Signal Company' }))
  expect(screen.getByText('0% confidence')).toBeInTheDocument()
  expect(screen.getByText('No signals with verified facts were found for this company.')).toBeInTheDocument()
})

test('opens company research and links facts to original excerpts', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{
    id: 'company-lufthansa',
    canonical_domain: 'lufthansagroup.com',
    display_name: 'Lufthansa Group',
    aliases: [],
    industry: null,
    geography: null,
    company_size: null,
    operational_complexity: null,
  }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

  render(<ResearchActivityWorkspace />)

  expect(await screen.findByText('Promising')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Sort by Confidence/ })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Signal heatmap' })).toBeInTheDocument()
  expect(screen.getAllByText(/%/).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Open research' }))
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Signals and supporting facts' })).toBeInTheDocument()
  expect(screen.getByText('Promising signal')).toBeInTheDocument()
  const source = screen.getByRole('link', { name: /Open original: Lufthansa Group outlines efficiency programme/ })
  expect(source).toHaveAttribute('href', 'https://example.com/lufthansa/efficiency')
  expect(screen.getByText(/The Group announced a two-year operational-efficiency programme/)).toBeInTheDocument()
  expect(screen.queryByText('Is an exclusive incumbent partner confirmed?')).not.toBeInTheDocument()
  const summary = screen.getByRole('region', { name: 'Research summary' })
  expect(within(summary).getByText('2')).toBeInTheDocument()
  expect(within(summary).getByText('Signals with facts')).toBeInTheDocument()

  const sourceInventory = screen.getByText('Collected sources').closest('details')
  expect(sourceInventory).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('Collected sources'))
  expect(sourceInventory).toHaveAttribute('open')
  expect(screen.getByText('3 public documents · 1 company · 1 careers · 1 report')).toBeInTheDocument()

  expect(screen.queryByRole('heading', { name: 'Research history and diagnostics' })).not.toBeInTheDocument()
  const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
  expect(headings.indexOf('Collected sources')).toBeGreaterThan(headings.indexOf('Signals and supporting facts'))
})

test('queues fresh research without deleting previous runs', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
    const payload = init?.method === 'POST'
      ? { id: 'run-refresh', status: 'queued' }
      : [{ id: companyFixture.id }]
    return Promise.resolve(new Response(JSON.stringify(payload), { status: init?.method === 'POST' ? 202 : 200, headers: { 'Content-Type': 'application/json' } }))
  })
  render(<ResearchActivityWorkspace />)

  fireEvent.click(await screen.findByRole('button', { name: 'Open research' }))
  fireEvent.click(screen.getByRole('button', { name: 'Run fresh research' }))

  expect(await screen.findByText(/Existing sources, scores, and run history are preserved/)).toBeInTheDocument()
  const submission = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(submission?.[0]).toEqual(expect.stringContaining('/research-runs'))
  expect(JSON.parse(String(submission?.[1]?.body))).toMatchObject({
    company_id: companyFixture.id,
    profile_version_id: 'profile-version-rpa-1',
  })
})

test('allows all saved research for a company to be deleted', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify([{ id: companyFixture.id }]), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  render(<ResearchActivityWorkspace />)

  fireEvent.click(await screen.findByRole('button', { name: `Delete research for ${companyFixture.name}` }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent(`Delete research for ${companyFixture.name}?`)
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/companies/${companyFixture.id}/research`), expect.objectContaining({ method: 'DELETE' })))
  await vi.waitFor(() => expect(screen.queryByText(companyFixture.name)).not.toBeInTheDocument())
  expect(screen.getByText(/No saved research yet/)).toBeInTheDocument()
})
