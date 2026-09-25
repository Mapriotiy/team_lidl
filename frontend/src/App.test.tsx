import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('shows the opportunity workspace with test data', async () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
  expect(screen.getByText('Process automation')).toBeInTheDocument()
  expect(screen.getByText('Cybersecurity')).toBeInTheDocument()
  expect(screen.getByText('Software development')).toBeInTheDocument()
  expect(await screen.findByText('Lufthansa Group')).toBeInTheDocument()
})

test('opens company evidence from the ranked opportunity list', async () => {
  render(<App />)
  const evidenceButtons = await screen.findAllByRole('button', { name: 'View evidence' })
  fireEvent.click(evidenceButtons[0])
  expect(await screen.findByRole('heading', { name: 'Lufthansa Group' })).toBeInTheDocument()
  expect(screen.getByText('Score breakdown')).toBeInTheDocument()
})

test('opens profile configuration from primary navigation', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Service profiles/ }))
  expect(await screen.findByText('Ideal customer profile')).toBeInTheDocument()
  expect(screen.getByText('Signal questions')).toBeInTheDocument()
})
