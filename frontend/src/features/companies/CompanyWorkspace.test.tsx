import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { CompanyWorkspace } from './CompanyWorkspace'

test('separates evidence, interpretation and unknown facts', async () => {
  render(<CompanyWorkspace />)
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getAllByText(/Observed fact/).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Sales interpretation').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
})

test('persists shortlist and note actions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'op-1', status: 'shortlisted', note: 'Review with the automation team.' }) }))
  render(<CompanyWorkspace opportunityId="op-1" />)
  await screen.findByRole('heading', { name: 'Lufthansa Group' })
  fireEvent.click(screen.getByRole('button', { name: 'Shortlist' }))
  expect(await screen.findByRole('button', { name: 'Restore' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByLabelText('Account note'), { target: { value: 'Review with the automation team.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
  expect(await screen.findByText('Saved and persisted.')).toBeInTheDocument()
})
