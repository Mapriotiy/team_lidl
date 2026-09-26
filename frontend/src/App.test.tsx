import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('opens on the guided service profile', async () => {
  render(<App />)
  expect(screen.getByText('LeadRadar')).toBeInTheDocument()
  expect(screen.queryByText('Team LIDL')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Import companies' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Service Profile' })).toHaveAttribute('aria-current', 'step')
  expect(await screen.findByRole('heading', { name: 'Define who your service is for' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ideal customer/ })).toBeInTheDocument()
})

test('keeps research navigation focused on sourcing and evidence', async () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: 'Opportunities' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Companies' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Research' })).toBeInTheDocument()
  const workflow = screen.getByRole('navigation', { name: 'Primary' })
  expect(workflow).toHaveTextContent('↓')
  expect(within(workflow).queryByText('✓')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Service Profile' })).toHaveTextContent('1')
  expect(screen.getByRole('button', { name: 'Discover companies' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Research' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Research' })).toHaveTextContent('3')
  expect(screen.getByRole('button', { name: 'Research' })).not.toHaveTextContent('✓')
})

test('shows buying signal guidance from the first page', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.change(screen.getByRole('combobox', { name: /Service name/ }), { target: { value: 'Business analysts' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('Public facts that may indicate a genuine need for your service.')).toBeInTheDocument()
})

test('advances to company discovery after saving the service profile', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.change(screen.getByRole('combobox', { name: /Service name/ }), { target: { value: 'Automation engineers' } })
  for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save and activate profile' }))
  expect(await screen.findByRole('heading', { name: 'Discover companies' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Discover companies' })).toHaveAttribute('aria-current', 'step')
})
