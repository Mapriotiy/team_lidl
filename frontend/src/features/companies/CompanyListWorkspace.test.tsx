import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { CompanyListWorkspace } from './CompanyListWorkspace'

test('shows imported companies without requiring an opportunity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'company-1', canonical_domain: 'example.ro', display_name: 'Example SA', aliases: [], industry: { value: 'Logistics', source_ids: [], is_unknown: false }, geography: { value: 'Romania', source_ids: [], is_unknown: false }, company_size: { value: 2500, source_ids: [], is_unknown: false }, operational_complexity: null }] }))
  const onOpen = vi.fn()
  render(<CompanyListWorkspace onOpen={onOpen} />)
  expect(await screen.findByRole('heading', { name: 'Example SA' })).toBeInTheDocument()
  expect(screen.getByText('example.ro')).toBeInTheDocument()
  expect(screen.getByText('2,500')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'View record' }))
  expect(onOpen).toHaveBeenCalledWith('company-1')
})
