import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('shows the opportunity workspace with fixture disclosure', async () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
  expect(screen.getByText('Process automation')).toBeInTheDocument()
  expect(screen.getByText('Cybersecurity')).toBeInTheDocument()
  expect(screen.getByText('Software development')).toBeInTheDocument()
  expect(screen.getByText(/not confirmed sales opportunities/i)).toBeInTheDocument()
  expect(await screen.findByText('Lufthansa Group')).toBeInTheDocument()
})

test('opens profile configuration from primary navigation', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Service profiles/ }))
  expect(await screen.findByText('Ideal customer profile')).toBeInTheDocument()
  expect(screen.getByText('Signal questions')).toBeInTheDocument()
})
