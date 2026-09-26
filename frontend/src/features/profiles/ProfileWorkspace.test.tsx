import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ProfileWorkspace } from './ProfileWorkspace'

test('guides a business user through a three-step profile', async () => {
  render(<ProfileWorkspace />)
  const ai = await screen.findByRole('button', { name: /Applied AI/ })
  fireEvent.click(ai)
  expect(ai).toHaveAttribute('aria-pressed', 'true')
  expect((screen.getByRole('textbox', { name: /How we help/ }) as HTMLTextAreaElement).value).toContain('responsible AI solutions')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Financial services' }))
  expect(screen.getByRole('button', { name: /Financial services/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add signal' }))
  expect(screen.getByText('Buying signal 2')).toBeInTheDocument()
})

test('prevents progress until a service is selected', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Who we target/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /RPA & automation/ }))
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})

test('saves through the profile repository boundary', async () => {
  render(<ProfileWorkspace />)
  fireEvent.click(await screen.findByRole('button', { name: /RPA & automation/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save profile and discover companies' }))
  expect(await screen.findByText('Profile saved')).toBeInTheDocument()
})
