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

test('keeps research navigation focused on sourcing and evidence', async () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: 'Opportunities' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Companies' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Research' })).toBeInTheDocument()
})

test('shows buying signal guidance from the first page', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.click(screen.getByRole('button', { name: /Buying signals/ }))
  expect(screen.getByText('Public facts that may indicate a genuine need for your service.')).toBeInTheDocument()
})
