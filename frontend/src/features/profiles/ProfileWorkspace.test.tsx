import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ProfileWorkspace } from './ProfileWorkspace'

test('guides a business user through criteria and signals', async () => {
  render(<ProfileWorkspace />)
  const name = await screen.findByRole('textbox', { name: /Service name/ })
  fireEvent.change(name, { target: { value: 'Operations transformation' } })
  expect(name).toHaveValue('Operations transformation')
  const description = screen.getByRole('textbox', { name: /Service description/ })
  fireEvent.change(description, { target: { value: 'Automation advisory for complex operations.' } })
  expect(description).toHaveValue('Automation advisory for complex operations.')
  fireEvent.click(screen.getByRole('button', { name: /Buying signals/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Add buying signal' }))
  expect(screen.getByText('Buying signal 2')).toBeInTheDocument()
})

test('saves through the profile repository boundary', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.click(screen.getByRole('button', { name: /Review/ }))
  const save = screen.getByRole('button', { name: 'Save and activate profile' })
  fireEvent.click(save)
  expect(await screen.findByText('Profile version saved')).toBeInTheDocument()
})
