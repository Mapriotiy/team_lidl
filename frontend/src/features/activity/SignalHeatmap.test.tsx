import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { companyFixture } from '../companies/fixtures'
import { SignalHeatmap } from './SignalHeatmap'

test('compares signals and opens the selected company evidence', () => {
  const onOpen = vi.fn()
  render(<SignalHeatmap companies={[companyFixture]} onOpen={onOpen} />)
  const grid = screen.getByRole('table', { name: 'Companies by researched signal' })
  expect(within(grid).getByText('Lufthansa Group')).toBeInTheDocument()
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
