import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { DiscoveryWorkspace } from './DiscoveryWorkspace'

test('requires candidate selection before confirmation', async () => {
  const onConfirmed = vi.fn()
  const candidate = { entity_id: 'Q1', name: 'Example SA', domain: 'example.ro', country_code: 'RO', country_name: 'Romania', industry: 'Logistics', employee_count: 2500, size_verification: 'verified', discovery_confidence: 0.92, source_url: 'https://www.wikidata.org/wiki/Q1' }
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'discovery-1', status: 'completed', request: {}, candidates: [candidate], confirmed_domains: [], created_at: '2026-09-25T00:00:00Z' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { id: 'discovery-1' }, company_ids: ['company-1'] }) }))

  render(<DiscoveryWorkspace onConfirmed={onConfirmed} />)
  fireEvent.click(screen.getByRole('button', { name: 'Find companies' }))
  expect(await screen.findByText('Example SA')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm selection' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Example SA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm selection' }))
  expect(await screen.findByText(/1 selected compan(?:y|ies) confirmed/i)).toBeInTheDocument()
  expect(onConfirmed).toHaveBeenCalledWith([{ id: 'company-1', name: 'Example SA', domain: 'example.ro' }])
})
