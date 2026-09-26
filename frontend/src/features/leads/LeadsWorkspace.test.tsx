import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { LeadsWorkspace } from './LeadsWorkspace'

const lead = (overrides: Record<string, unknown>) => ({
  id: 'o1', company_id: 'c1', company_name: 'Acme', canonical_domain: 'acme.ro', profile_id: 'p1', profile_name: 'RPA',
  profile_version_id: 'v1', status: 'new', note: null, score: 80, eligibility: 'eligible', coverage: 0.5,
  collection_completion: 1, strongest_signal: 'hiring-rpa', last_researched_at: '2026-09-26T10:00:00Z', ...overrides,
})

const items = [
  lead({}),
  lead({ id: 'o2', company_id: 'c2', company_name: 'Beta', canonical_domain: 'beta.pl', score: 20, eligibility: 'needs_research', strongest_signal: null, coverage: 0 }),
  lead({ id: 'o3', company_id: 'c3', company_name: 'Gamma', canonical_domain: 'gamma.cz', score: 60, eligibility: 'excluded', status: 'shortlisted' }),
]

function stub() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items, meta: { page: 1, page_size: 100, total: items.length } }) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('ranks leads by score and counts each filter', async () => {
  stub()
  render(<LeadsWorkspace onOpenCompany={vi.fn()} />)
  const names = (await screen.findAllByRole('listitem')).filter((node) => node.closest('ul')).map((node) => node.querySelector('h2')?.textContent)
  expect(names).toEqual(['Acme', 'Gamma', 'Beta'])
  const group = screen.getByRole('group', { name: 'Lead filters' })
  expect(within(group).getByRole('button', { name: /Ready to contact\s*1/ })).toBeInTheDocument()
  expect(within(group).getByRole('button', { name: /Needs research\s*1/ })).toBeInTheDocument()
  expect(within(group).getByRole('button', { name: /Shortlisted\s*1/ })).toBeInTheDocument()
  expect(screen.getAllByText('Hiring rpa')).toHaveLength(2)
  expect(screen.getByText('None confirmed')).toBeInTheDocument()
})

test('filters, searches and opens the company research', async () => {
  stub()
  const onOpen = vi.fn()
  render(<LeadsWorkspace onOpenCompany={onOpen} />)
  await screen.findByText('Acme')
  fireEvent.click(screen.getByRole('button', { name: /Needs research\s*1/ }))
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /All leads/ }))
  fireEvent.change(screen.getByLabelText('Search leads'), { target: { value: 'gamma.cz' } })
  expect(screen.getAllByRole('listitem').filter((node) => node.closest('ul')).map((node) => node.querySelector('h2')?.textContent)).toEqual(['Gamma'])
  fireEvent.click(screen.getByRole('button', { name: 'Open research for Gamma' }))
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onOpen).toHaveBeenCalledWith('c3')
  fireEvent.click(screen.getByText('gamma.cz'))
  expect(onOpen).toHaveBeenCalledTimes(2)
})

test('reports a load failure with retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: 'Service down' }) }))
  render(<LeadsWorkspace onOpenCompany={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Service down')
})

test('shows the lead funnel', async () => {
  stub()
  render(<LeadsWorkspace onOpenCompany={vi.fn()} />)
  const funnel = await screen.findByRole('list', { name: 'Lead funnel' })
  expect(within(funnel).getByText('Researched').nextSibling).toHaveTextContent('3')
  expect(within(funnel).getByText('Signal found').nextSibling).toHaveTextContent('2')
})
