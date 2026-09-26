import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ResearchActivityWorkspace } from './ResearchActivity'
import * as repository from '../companies/repository'
import { companyFixture } from '../companies/fixtures'

afterEach(() => vi.restoreAllMocks())

test.each([0, 1])('shows Not enough data for a finished run with %i sources despite supported signals', async (count) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: companyFixture.id }]), { status: 200 }))
  vi.spyOn(repository, 'getCompany').mockResolvedValue({
    ...structuredClone(companyFixture),
    sources: Array.from({ length: count }, (_, index) => ({ id: `source-${index}`, title: 'Source', url: 'https://example.com', type: 'company', retrievedAt: '2026-09-25T00:00:00Z', publicationDate: null })),
  })

  render(<ResearchActivityWorkspace />)

  expect(await screen.findByText('Not enough data')).toBeInTheDocument()
  expect(screen.queryByText('Promising')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open research' }))
  expect(screen.getByText(/At least 2 distinct sources are required/)).toBeInTheDocument()
  expect(screen.queryByText(/One careers page was blocked/)).not.toBeInTheDocument()
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
  expect(screen.getByText(/%/)).toBeInTheDocument()
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
