import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { ResearchActivityWorkspace } from './ResearchActivity'

afterEach(() => vi.restoreAllMocks())

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

  expect(await screen.findByText('Needs attention')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open research' }))
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  const source = screen.getByRole('link', { name: /Open original: Lufthansa Group outlines efficiency programme/ })
  expect(source).toHaveAttribute('href', 'https://example.com/lufthansa/efficiency')
  fireEvent.mouseEnter(source)
  expect(screen.getByText(/The Group announced a two-year operational-efficiency programme/)).toHaveClass('bg-[#FFE9D8]')
})
