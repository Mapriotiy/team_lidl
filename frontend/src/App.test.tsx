import { render, screen } from '@testing-library/react'
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

