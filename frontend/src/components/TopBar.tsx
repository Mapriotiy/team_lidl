import { useEffect, useRef, useState } from 'react'
import { listCompanies, type CompanySummary } from '../api/research'
import { Icon } from './icons'
import type { Appearance } from './useAppearance'

export interface TopBarProps {
  viewLabel: string
  screens: Array<{ id: string; label: string; disabled?: boolean }>
  onNavigate: (id: string) => void
  onOpenCompany: (id: string) => void
  onOpenSources: () => void
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
  workspaceName?: string
  notifications: {
    loading: boolean
    error?: string | null
    failures: Array<{ id: string; sourceName: string; detail: string; at?: string | null }>
    entryCount: number
  }
}

export function TopBar({ viewLabel, screens, onNavigate, onOpenCompany, onOpenSources, appearance, setAppearance, workspaceName = 'LeadRadar', notifications }: TopBarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  const bellButton = useRef<HTMLButtonElement>(null)
  const notificationPanel = useRef<HTMLDivElement>(null)
  const closePalette = () => { setPaletteOpen(false); searchButton.current?.focus() }
  const problems = notifications.failures.slice(0, 8)
  const notificationLabel = notifications.loading ? 'Loading crawl notifications' : notifications.error ? 'Crawl notifications unavailable' : problems.length ? `${problems.length} recorded crawl problems` : 'Crawl notifications'
  const initials = workspaceName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'LR'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        setNotificationsOpen(false)
      }
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        if (notificationPanel.current?.contains(document.activeElement)) bellButton.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!notificationsOpen) return
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationPanel.current?.contains(event.target) && !bellButton.current?.contains(event.target)) setNotificationsOpen(false)
    }
    window.addEventListener('pointerdown', onOutside)
    return () => window.removeEventListener('pointerdown', onOutside)
  }, [notificationsOpen])

  return <>
    <header className="lr-topbar">
      <nav className="lr-breadcrumb" aria-label="Breadcrumb"><span className="lr-workspace-label">Workspace</span><Icon name="chevron" /><span className="lr-view-label" aria-current="page">{viewLabel}</span></nav>
      <div className="lr-topbar-actions">
        <button className="lr-search-trigger" ref={searchButton} type="button" onClick={() => { setPaletteOpen(true); setNotificationsOpen(false) }} aria-label="Search companies and screens"><Icon name="search" /><span>Search companies and screens…</span><kbd>⌘K</kbd></button>
        <button type="button" className="lr-icon-button" aria-label={`Switch to ${appearance === 'dark' ? 'light' : 'dark'} appearance`} title={`Switch to ${appearance === 'dark' ? 'light' : 'dark'}`} onClick={() => setAppearance(appearance === 'dark' ? 'light' : 'dark')}><Icon name={appearance === 'dark' ? 'sun' : 'moon'} /></button>
        <div className="lr-notifications">
          <button ref={bellButton} type="button" className="lr-icon-button" aria-label={notificationLabel} aria-expanded={notificationsOpen} aria-controls="crawl-notifications" onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" />{!notifications.loading && !notifications.error && problems.length > 0 && <span className="lr-notification-dot" />}</button>
          {notificationsOpen && <div ref={notificationPanel} className="lr-notification-panel" id="crawl-notifications" role="region" aria-label="Crawl notifications">
            <strong>Collection activity</strong><p className="lr-subtle">Problems in the latest recorded source attempts.</p>
            {notifications.loading ? <p role="status">Loading recent attempts…</p> : notifications.error ? <p role="alert">Crawl notifications are unavailable. {notifications.error}</p> : problems.length === 0 ? <p>{notifications.entryCount > 0 ? 'No problems in the recent recorded attempts.' : 'No source attempts have been recorded yet.'}</p> : <ul>{problems.map((problem) => <li key={problem.id}><Icon name="alert" /><div><strong>{problem.sourceName}</strong><p>{problem.detail}</p>{problem.at && <time dateTime={problem.at}>{new Date(problem.at).toLocaleString()}</time>}</div></li>)}</ul>}
            <button type="button" className="lr-text-button" onClick={() => { setNotificationsOpen(false); onOpenSources() }}>Open Data sources</button>
          </div>}
        </div>
        <span className="lr-avatar" title={workspaceName} aria-label={`${workspaceName} workspace`}>{workspaceName === 'LeadRadar' ? 'LR' : initials}</span>
      </div>
    </header>
    {paletteOpen && <CommandPalette screens={screens} onClose={closePalette} onNavigate={onNavigate} onOpenCompany={onOpenCompany} />}
  </>
}

function CommandPalette({ screens, onClose, onNavigate, onOpenCompany }: Pick<TopBarProps, 'screens' | 'onNavigate' | 'onOpenCompany'> & { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()
  const pages = screens.filter((screen) => !needle || screen.label.toLowerCase().includes(needle))
  const matches = companies.filter((company) => !needle || `${company.display_name} ${company.canonical_domain}`.toLowerCase().includes(needle)).slice(0, needle ? 8 : 6)
  const options = [...pages.filter((screen) => !screen.disabled).map((screen) => ({ key: `screen-${screen.id}`, select: () => onNavigate(screen.id) })), ...matches.map((company) => ({ key: `company-${company.id}`, select: () => onOpenCompany(company.id) }))]
  const active = options[Math.min(selected, Math.max(0, options.length - 1))]

  useEffect(() => {
    const controller = new AbortController()
    input.current?.focus()
    void listCompanies(controller.signal).then((result) => { if (!controller.signal.aborted) setCompanies(result) }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Please try again.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return <div className="lr-palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} className="lr-palette" role="dialog" aria-modal="true" aria-label="Search companies and screens" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((previous) => options.length ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : 0)
        input.current?.focus()
      }
      if (event.key === 'Enter' && event.target === input.current && active) { event.preventDefault(); active.select(); onClose() }
      if (event.key === 'Tab') {
        const focusable = panel.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)')
        if (!focusable?.length) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="lr-palette-input"><Icon name="search" /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }} role="combobox" aria-label="Search companies or screens" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={active?.key} placeholder="Search companies, or jump to a screen…" /><button className="lr-icon-button" type="button" onClick={onClose} aria-label="Close search"><Icon name="close" /></button></div>
      <div className="lr-palette-results" id="workspace-search-results" role="listbox" aria-label="Search results">
        {pages.length > 0 && <div role="group" aria-label="Screens"><p className="lr-palette-heading">Screens</p>{pages.map((screen) => <button id={`screen-${screen.id}`} role="option" aria-selected={active?.key === `screen-${screen.id}`} key={screen.id} type="button" disabled={screen.disabled} onClick={() => { onNavigate(screen.id); onClose() }}><span>{screen.label}</span>{screen.disabled && <small>Complete your profile first</small>}</button>)}</div>}
        <div role="group" aria-label="Companies"><p className="lr-palette-heading">{needle ? 'Matching companies' : 'Companies'}</p>
          {loading ? <p className="lr-search-status" role="status">Loading companies…</p> : error ? <p className="lr-search-status" role="alert">Company search is unavailable. {error}</p> : matches.length === 0 ? <p className="lr-search-status">{needle ? `No company matches “${query}”.` : 'No companies yet. Discover or import companies to get started.'}</p> : matches.map((company) => <button aria-label={`${company.display_name} ${company.canonical_domain}`} id={`company-${company.id}`} role="option" aria-selected={active?.key === `company-${company.id}`} key={company.id} type="button" onClick={() => { onOpenCompany(company.id); onClose() }}><span>{company.display_name}</span><small>{company.canonical_domain}</small></button>)}
        </div>
      </div>
      <div className="lr-palette-footer">↑ ↓ to navigate <span>↵ to open</span><span>Esc to close</span></div>
    </div>
  </div>
}
