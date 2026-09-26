import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ProfileWorkspace } from './ProfileWorkspace'

test('guides a business user through criteria and signals', async () => {
  render(<ProfileWorkspace />)
  const name = await screen.findByRole('combobox', { name: /Service name/ })
  fireEvent.change(name, { target: { value: 'AI specialists' } })
  expect(name).toHaveValue('AI specialists')
  const description = screen.getByRole('textbox', { name: /Service description/ })
  expect((description as HTMLTextAreaElement).value).toContain('responsible AI solutions')
  fireEvent.change(description, { target: { value: 'Edited AI service description.' } })
  expect(description).toHaveValue('Edited AI service description.')
  expect(screen.getByRole('button', { name: 'Restore suggested description' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add buying signal' }))
  expect(screen.getByText('Buying signal 2')).toBeInTheDocument()
})

test('prevents progress until a service role is selected', async () => {
  render(<ProfileWorkspace />)
  const service = await screen.findByRole('combobox', { name: /Service name/ })
  expect(service).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Ideal customer/ })).toBeDisabled()
  fireEvent.change(service, { target: { value: 'RPA developers' } })
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
})

test('saves through the profile repository boundary', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('heading', { name: 'Define who your service is for' })
  fireEvent.change(screen.getByRole('combobox', { name: /Service name/ }), { target: { value: 'RPA developers' } })
  for (let step = 0; step < 4; step += 1) fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  const save = screen.getByRole('button', { name: 'Save and activate profile' })
  fireEvent.click(save)
  expect(await screen.findByText('Profile version saved')).toBeInTheDocument()
})
