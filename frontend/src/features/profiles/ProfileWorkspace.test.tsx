import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ProfileWorkspace } from './ProfileWorkspace'

test('edits profile criteria and adds a signal', async () => {
  render(<ProfileWorkspace />)
  const name = await screen.findByLabelText('Profile name')
  fireEvent.change(name, { target: { value: 'Automation advisory' } })
  expect(name).toHaveValue('Automation advisory')
  fireEvent.click(screen.getByRole('button', { name: '+ Add signal' }))
  expect(screen.getByText('Signal 3')).toBeInTheDocument()
})

test('saves through the profile repository boundary', async () => {
  render(<ProfileWorkspace />)
  const save = await screen.findByRole('button', { name: 'Save new version' })
  fireEvent.click(save)
  expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeInTheDocument()
})
