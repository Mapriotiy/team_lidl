import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { App } from './App'

test('shows the three initial service profiles', () => {
  render(<App />)

  expect(screen.getByText('Process automation')).toBeInTheDocument()
  expect(screen.getByText('Cybersecurity')).toBeInTheDocument()
  expect(screen.getByText('Software development')).toBeInTheDocument()
})

