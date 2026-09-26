import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('opens on the guided service profile', async () => {
  render(<App />)
  expect(screen.getByText('LeadRadar')).toBeInTheDocument()
  expect(screen.queryByText('Team LIDL')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Import companies' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Service Profile' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Define who your service is for' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ideal customer/ })).toBeInTheDocument()
})

test('opens company evidence from the ranked opportunity list', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Opportunities' }))
  const evidenceButtons = await screen.findAllByRole('button', { name: 'View evidence' })
  fireEvent.click(evidenceButtons[0])
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getByText('Score breakdown')).toBeInTheDocument()
})

test('shows buying signal guidance from the first page', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.click(screen.getByRole('button', { name: /Buying signals/ }))
  expect(screen.getByText('Public facts that may indicate a genuine need for your service.')).toBeInTheDocument()
})
