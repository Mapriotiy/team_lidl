import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ProfileWorkspace } from './ProfileWorkspace'

test('guides a business user through a three-step profile', async () => {
  render(<ProfileWorkspace />)
  const ai = await screen.findByRole('button', { name: /Applied AI/ })
  fireEvent.click(ai)
  expect(ai).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { name: 'Applied AI' })).toBeInTheDocument()
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

test('offers distinct service templates', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('button', { name: /RPA & automation/ })
  expect(screen.getByRole('button', { name: /Cybersecurity/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Automation engineering/ })).not.toBeInTheDocument()
})

test('replaces research signals when the selected service changes', async () => {
  render(<ProfileWorkspace />)
  fireEvent.click(await screen.findByRole('button', { name: /Cybersecurity/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(screen.getByDisplayValue(/confirmed a recent security incident/)).toBeInTheDocument()
  expect(screen.getByDisplayValue(/NIS2, DORA/)).toBeInTheDocument()
  expect(screen.queryByDisplayValue(/cost-reduction or operational-efficiency/)).not.toBeInTheDocument()
  expect(screen.getByText('Buying signal 4')).toBeInTheDocument()
  expect(screen.getByText('Warning 2')).toBeInTheDocument()
})

test('saves through the profile repository boundary', async () => {
  render(<ProfileWorkspace />)
  fireEvent.click(await screen.findByRole('button', { name: /RPA & automation/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save profile and discover companies' }))
  expect(await screen.findByText('Profile saved')).toBeInTheDocument()
})

test('duplicates a profile without overwriting the saved version', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })

  fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))

  expect(screen.getByText('Service profile · Unsaved')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /Profile name/ })).toHaveValue('RPA copy')
  expect(screen.getByRole('combobox', { name: 'Saved profile' })).toHaveValue('')
})

test('creates a custom profile without a coded service template', async () => {
  render(<ProfileWorkspace />)
  await screen.findByRole('heading', { name: 'Tell us what a good opportunity looks like' })
  fireEvent.click(screen.getByRole('button', { name: 'New profile' }))

  fireEvent.change(screen.getByRole('textbox', { name: /Profile name/ }), { target: { value: 'Supply chain advisory' } })
  fireEvent.change(screen.getByRole('textbox', { name: /Service offered/ }), { target: { value: 'Supply-chain consulting' } })
  fireEvent.change(screen.getByRole('textbox', { name: /How we help/ }), { target: { value: 'We improve planning and logistics operations.' } })

  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Financial services' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add signal' }))
  fireEvent.change(screen.getByRole('textbox', { name: /Signal question/ }), { target: { value: 'Is the company modernising its supply chain?' } })
  fireEvent.change(screen.getByRole('textbox', { name: /Evidence that counts/ }), { target: { value: 'A named and dated supply-chain programme.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile and discover companies' }))

  expect(await screen.findByText('Profile saved')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Saved profile' })).toHaveValue('profile-new')
})
