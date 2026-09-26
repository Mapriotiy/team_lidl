import { useCallback, useEffect, useState } from 'react'

export type Appearance = 'light' | 'dark'
export const APPEARANCE_STORAGE_KEY = 'leadradar.appearance'

function readAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Private browsing may disable storage; the toggle still works. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useAppearance() {
  const [appearance, updateAppearance] = useState<Appearance>(readAppearance)
  const setAppearance = useCallback((next: Appearance) => {
    updateAppearance(next)
    try { localStorage.setItem(APPEARANCE_STORAGE_KEY, next) } catch { /* Session-only appearance remains available. */ }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance
    document.documentElement.style.colorScheme = appearance
  }, [appearance])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY || event.key === null) updateAppearance(readAppearance())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { appearance, setAppearance }
}
