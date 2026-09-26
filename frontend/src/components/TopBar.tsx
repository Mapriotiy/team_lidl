import { useEffect, useRef, useState } from 'react'
import { listCompanies, type CompanySummary } from '../api/research'
import { listProfiles, type Profile } from '../api/profiles'
import type { SettingsSection } from '../features/settings/SettingsWorkspace'
import { matchesSearch, screenKeywords, settingsDestinations, sourceDestinations } from './searchDestinations'
import { Icon } from './icons'
import type { Appearance } from './useAppearance'

export interface TopBarProps {
  viewLabel: string
  screens: Array<{ id: string; label: string; disabled?: boolean }>
  onNavigate: (id: string) => void
  onOpenCompany: (id: string) => void
  onOpenSources: () => void
  onOpenSetting: (section: SettingsSection) => void
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

export function TopBar({ viewLabel, screens, onNavigate, onOpenCompany, onOpenSources, onOpenSetting, appearance, setAppearance, workspaceName = 'LeadRadar', notifications }: TopBarProps) {
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
    {paletteOpen && <CommandPalette screens={screens} onClose={closePalette} onNavigate={onNavigate} onOpenCompany={onOpenCompany} onOpenSetting={onOpenSetting} />}
  </>
}

function CommandPalette({ screens, onClose, onNavigate, onOpenCompany, onOpenSetting }: Pick<TopBarProps, 'screens' | 'onNavigate' | 'onOpenCompany' | 'onOpenSetting'> & { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const needle = query.trim()
  const pages = screens.filter((screen) => matchesSearch(needle, `${screen.label} ${screenKeywords[screen.id] ?? ''}`))
  const settings = settingsDestinations.filter((item) => matchesSearch(needle, `${item.label} ${item.keywords}`))
  const sources = sourceDestinations.filter((item) => matchesSearch(needle, `${item.label} ${item.keywords}`))
  const matchingCompanies = companies.filter((company) => matchesSearch(needle, `${company.display_name} ${company.canonical_domain} ${company.aliases.join(' ')}`)).slice(0, needle ? 8 : 6)
  const matchingProfiles = profiles.filter((profile) => matchesSearch(needle, `${profile.name} ${profile.current_version.configuration.service_role ?? ''} ${profile.current_version.configuration.service_description}`)).slice(0, 6)
  const canOpenProfiles = screens.some((screen) => screen.id === 'profiles' && !screen.disabled)
  const options = [
    ...pages.filter((screen) => !screen.disabled).map((screen) => ({ key: `screen-${screen.id}`, select: () => onNavigate(screen.id) })),
    ...settings.map((item) => ({ key: `setting-${item.id}`, select: () => onOpenSetting(item.id) })),
    ...sources.map((item) => ({ key: `source-${item.id}`, select: () => onOpenSetting('sources') })),
    ...(canOpenProfiles ? matchingProfiles.map((profile) => ({ key: `profile-${profile.id}`, select: () => onNavigate('profiles') })) : []),
    ...matchingCompanies.map((company) => ({ key: `company-${company.id}`, select: () => onOpenCompany(company.id) })),
  ]
  const active = options.find((option) => option.key === selectedKey) ?? options[0]
  const activeKey = active?.key

  useEffect(() => {
    const controller = new AbortController()
    input.current?.focus()
    void listCompanies(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setCompanies(result) })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Please try again.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    void listProfiles(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setProfiles(result) })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setProfilesError(reason instanceof Error ? reason.message : 'Please try again.') })
      .finally(() => { if (!controller.signal.aborted) setProfilesLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (activeKey) document.getElementById(activeKey)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeKey])

  const open = (action: () => void) => { action(); onClose() }

  return <div className="lr-palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} className="lr-palette" role="dialog" aria-modal="true" aria-label="Search companies and screens" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = options.findIndex((option) => option.key === activeKey)
        const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        setSelectedKey(options[nextIndex]?.key ?? null)
        input.current?.focus()
      }
      if (event.key === 'Enter' && event.target === input.current && active) { event.preventDefault(); open(active.select) }
      if (event.key === 'Tab') {
        const focusable = panel.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)')
        if (!focusable?.length) return
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="lr-palette-input">
        <Icon name="search" /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedKey(null) }} role="combobox" aria-label="Search companies or screens" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={activeKey} placeholder="Search companies, profiles, settings, sources…" />
        <button className="lr-icon-button" type="button" onClick={onClose} aria-label="Close search"><Icon name="close" /></button>
      </div>
      <div className="lr-palette-results" id="workspace-search-results" role="listbox" aria-label="Search results">
        {pages.length > 0 && <div role="group" aria-label="Screens"><p className="lr-palette-heading">Screens</p>{pages.map((screen) => <button id={`screen-${screen.id}`} role="option" aria-selected={activeKey === `screen-${screen.id}`} key={screen.id} type="button" disabled={screen.disabled} onClick={() => open(() => onNavigate(screen.id))}><span>{screen.label}</span>{screen.disabled && <small>Complete your profile first</small>}</button>)}</div>}
        {settings.length > 0 && <div role="group" aria-label="Settings"><p className="lr-palette-heading">Settings</p>{settings.map((item) => <button id={`setting-${item.id}`} role="option" aria-label={item.label} aria-selected={activeKey === `setting-${item.id}`} key={item.id} type="button" onClick={() => open(() => onOpenSetting(item.id))}><span>{item.label}</span><small>Settings</small></button>)}</div>}
        {sources.length > 0 && <div role="group" aria-label="Source integrations"><p className="lr-palette-heading">Source integrations</p>{sources.map((item) => <button id={`source-${item.id}`} role="option" aria-label={item.label} aria-selected={activeKey === `source-${item.id}`} key={item.id} type="button" onClick={() => open(() => onOpenSetting('sources'))}><span>{item.label}</span><small>Open Data sources</small></button>)}</div>}
        <div role="group" aria-label="Saved profiles"><p className="lr-palette-heading">Saved profiles</p>
          {profilesLoading ? <p className="lr-search-status" role="status">Loading profiles…</p> : profilesError ? <p className="lr-search-status" role="alert">Profile search is unavailable. {profilesError}</p> : matchingProfiles.length === 0 ? <p className="lr-search-status">{needle ? 'No matching saved profiles.' : 'No saved profiles yet.'}</p> : matchingProfiles.map((profile) => <button id={`profile-${profile.id}`} role="option" aria-label={`Profile: ${profile.name}`} aria-selected={activeKey === `profile-${profile.id}`} disabled={!canOpenProfiles} key={profile.id} type="button" onClick={() => open(() => onNavigate('profiles'))}><span>{profile.name}</span><small>Open service profile workspace</small></button>)}
        </div>
        <div role="group" aria-label="Companies"><p className="lr-palette-heading">{needle ? 'Matching companies' : 'Companies'}</p>
          {loading ? <p className="lr-search-status" role="status">Loading companies…</p> : error ? <p className="lr-search-status" role="alert">Company search is unavailable. {error}</p> : matchingCompanies.length === 0 ? <p className="lr-search-status">{needle ? `No company matches “${query}”.` : 'No companies yet. Discover or import companies to get started.'}</p> : matchingCompanies.map((company) => <button aria-label={`${company.display_name} ${company.canonical_domain}`} id={`company-${company.id}`} role="option" aria-selected={activeKey === `company-${company.id}`} key={company.id} type="button" onClick={() => open(() => onOpenCompany(company.id))}><span>{company.display_name}</span><small>{company.canonical_domain}</small></button>)}
        </div>
      </div>
      <div className="lr-palette-footer">↑ ↓ to navigate <span>↵ to open</span><span>Esc to close</span></div>
    </div>
  </div>
}
