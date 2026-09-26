import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { IcpScoringWorkspace } from './IcpScoringWorkspace'

const profile = {
  id: 'p1', name: 'RPA', created_at: '2026-09-26', updated_at: '2026-09-26',
  current_version: {
    id: 'v1', version: 3, created_at: '2026-09-26',
    icp_criteria: [
      { key: 'geography', values: ['Eastern Europe'], countries: ['PL', 'RO'], worldwide: false, employees: null, include_unknown: true, unresolved: [], note: null },
      { key: 'company_size', values: [], countries: [], worldwide: false, employees: { minimum: 1000, maximum: null }, include_unknown: false, unresolved: [], note: null },
    ],
    configuration: {
      service_description: 'RPA', icp: {},
      signals: [
        { id: 's1', question: 'Is there an efficiency program?', positive_criteria: [], exclusions: [], weight: 20, effect: 'positive', freshness_window_days: 365 },
        { id: 's2', question: 'Already runs a large RPA CoE?', positive_criteria: [], exclusions: [], weight: 10, effect: 'disqualifier', freshness_window_days: 365 },
      ],
    },
  },
}

test('shows the ideal customer, deal-breakers and signal weights for the profile', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [profile] }))
  const onEdit = vi.fn()
  render(<IcpScoringWorkspace onEditProfile={onEdit} />)
  expect(await screen.findByRole('heading', { name: 'Ideal customer' })).toBeInTheDocument()
  expect(screen.getByText('Eastern Europe')).toBeInTheDocument()
  expect(screen.getByText('1,000+ employees')).toBeInTheDocument()
  expect(screen.getByText('Excludes').parentElement).toHaveTextContent('Already runs a large RPA CoE?')
  expect(screen.getByLabelText('Weight: Is there an efficiency program?')).toHaveValue(20)
  fireEvent.click(screen.getByRole('button', { name: 'Edit criteria' }))
  expect(onEdit).toHaveBeenCalled()
})
