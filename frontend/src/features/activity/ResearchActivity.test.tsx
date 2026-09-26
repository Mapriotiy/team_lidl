import { fireEvent, render, screen } from '@testing-library/react'
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
  expect(screen.getByText(/One careers page was blocked/)).toBeInTheDocument()
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
  expect(screen.getByText(/%/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open research' }))
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getByText('Promising signal')).toBeInTheDocument()
  const source = screen.getByRole('link', { name: /Open original: Lufthansa Group outlines efficiency programme/ })
  expect(source).toHaveAttribute('href', 'https://example.com/lufthansa/efficiency')
  fireEvent.mouseEnter(source)
  expect(screen.getByText(/The Group announced a two-year operational-efficiency programme/)).toHaveClass('bg-[#FFE9D8]')
})
