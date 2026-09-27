import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('opens on the guided service profile', async () => {
  render(<App />)
  expect(screen.getByText('LeadRadar')).toBeInTheDocument()
  expect(screen.queryByText('Team LIDL')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Import companies' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Service Profile' })).toHaveAttribute('aria-current', 'step')
  expect(await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Who we target/ })).toBeInTheDocument()
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
  expect(screen.getByRole('button', { name: 'Research' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Research' })).toHaveTextContent('3')
  expect(screen.getByRole('button', { name: 'Research' })).not.toHaveTextContent('✓')
})

test('shows buying signal guidance from the first page', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })
  fireEvent.click(screen.getByRole('button', { name: /Process excellence/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('Evidence of active need, change, or investment.')).toBeInTheDocument()
})

test('opens the ranked leads list from the sidebar', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Leads' }))
  expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Lead filters' })).toHaveTextContent('Ready to contact')
})

test('opens settings from the sidebar without adding data sources to primary navigation', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Settings sections' })).toHaveTextContent('Data sources')
  expect(within(screen.getByRole('navigation', { name: 'Primary' })).queryByText('Data sources')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Switch to dark appearance' })).toBeInTheDocument()
})

test('advances to company discovery after saving the service profile', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })
  fireEvent.click(screen.getByRole('button', { name: /Cybersecurity/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save profile and discover companies' }))
  expect(await screen.findByRole('heading', { name: 'Discover companies' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Discover companies' })).toHaveAttribute('aria-current', 'step')
})
