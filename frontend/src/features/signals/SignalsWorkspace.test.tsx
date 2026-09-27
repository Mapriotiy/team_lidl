import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { companyFixture } from '../companies/fixtures'
import * as repository from '../companies/repository'
import { SignalsWorkspace } from './SignalsWorkspace'

afterEach(() => vi.restoreAllMocks())

test('shows recent verified activity and question fire rates', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: companyFixture.id }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.spyOn(repository, 'getCompany').mockResolvedValue(structuredClone(companyFixture))
  const onOpenCompany = vi.fn()

  render(<SignalsWorkspace onBack={vi.fn()} onOpenCompany={onOpenCompany} />)

  const recent = await screen.findByRole('heading', { name: 'Recent activity' })
  expect(screen.getByRole('heading', { name: 'How often each question fires' })).toBeInTheDocument()
  expect(within(recent.closest('section')!).getAllByText('Confirmed')).toHaveLength(2)
  expect(screen.getByText('Is an exclusive incumbent partner confirmed?').parentElement).toHaveTextContent('0 / 1')
  expect(screen.getAllByRole('link', { name: 'View evidence ↗' })[0]).toHaveAttribute('href', 'https://example.com/lufthansa/efficiency')
  fireEvent.click(screen.getAllByRole('button', { name: companyFixture.name })[0])
  expect(onOpenCompany).toHaveBeenCalledWith(companyFixture.id)
})
