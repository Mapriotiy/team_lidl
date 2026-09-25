import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { CompanyWorkspace } from './CompanyWorkspace'

test('separates evidence, interpretation and unknown facts', async () => {
  render(<CompanyWorkspace />)
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getAllByText(/Observed fact/).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Sales interpretation').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
})

test('supports local shortlist and note actions', async () => {
  render(<CompanyWorkspace />)
  await screen.findByRole('heading', { name: 'Lufthansa Group' })
  fireEvent.click(screen.getByRole('button', { name: 'Shortlist' }))
  expect(screen.getByRole('button', { name: 'Shortlist' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(screen.getByLabelText('Account note'), { target: { value: 'Review with the automation team.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
  expect(screen.getByText('Note saved in this session.')).toBeInTheDocument()
})
