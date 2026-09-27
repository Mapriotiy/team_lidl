import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { companyFixture } from '../companies/fixtures'
import { SignalHeatmap } from './SignalHeatmap'

test('compares signals and opens the selected company evidence', () => {
  const onOpen = vi.fn()
  const onConfigureSignals = vi.fn()
  render(<SignalHeatmap companies={[companyFixture]} onConfigureSignals={onConfigureSignals} onOpen={onOpen} />)
  fireEvent.click(screen.getByRole('button', { name: 'Configure signal questions' }))
  expect(onConfigureSignals).toHaveBeenCalledOnce()
  const grid = screen.getByRole('table', { name: 'Companies by researched signal' })
  expect(within(grid).getByText('Lufthansa Group')).toBeInTheDocument()
  expect(screen.queryByLabelText('Signals shown')).not.toBeInTheDocument()
  expect(within(grid).getByLabelText(/Signal 1:.*operational-efficiency program/)).toBeInTheDocument()
  const signal = within(grid).getByRole('button', { name: /operational-efficiency program.*Strong, 1 supporting sources/ })
  fireEvent.click(signal)
  expect(within(screen.getByRole('complementary')).getByText('Strong')).toBeInTheDocument()
  expect(screen.getByText('The company announced a two-year operational-efficiency programme.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open full evidence →' }))
  expect(onOpen).toHaveBeenCalledWith(companyFixture)
})

test('omits companies without enough research', () => {
  render(<SignalHeatmap companies={[{ ...companyFixture, sources: [] }]} onOpen={vi.fn()} />)
  expect(screen.getByText('0 compared · 1 omitted')).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Companies by researched signal' })).not.toBeInTheDocument()
})
