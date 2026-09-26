import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPEARANCE_STORAGE_KEY, useAppearance } from './useAppearance'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.appearance
  document.documentElement.style.colorScheme = ''
  vi.restoreAllMocks()
})

describe('appearance', () => {
  it('applies a saved preference and persists changes across remounts', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark')
    const first = renderHook(useAppearance)
    expect(document.documentElement).toHaveAttribute('data-appearance', 'dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    act(() => first.result.current.setAppearance('light'))
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light')
    first.unmount()
    const second = renderHook(useAppearance)
    expect(second.result.current.appearance).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-appearance', 'light')
  })
  it('can change the current appearance when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    const { result } = renderHook(useAppearance)
    act(() => result.current.setAppearance('dark'))
    expect(document.documentElement).toHaveAttribute('data-appearance', 'dark')
  })
  it('synchronizes a saved preference changed in another tab', async () => {
    renderHook(useAppearance)
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_STORAGE_KEY, newValue: 'dark' })))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-appearance', 'dark'))
  })
})
