import { useCallback, useEffect, useState } from 'react'

import { ResearchActivityWorkspace } from '../activity/ResearchActivity'
import { DiscoveryWorkspace } from '../discovery/DiscoveryWorkspace'
import { LeadsWorkspace } from '../leads/LeadsWorkspace'
import { ProfileWorkspace } from '../profiles/ProfileWorkspace'
import { getProfile } from '../profiles/repository'
import { TopBar } from '../../components/TopBar'
import { useAppearance } from '../../components/useAppearance'
import { SettingsWorkspace, type SettingsSection } from '../settings/SettingsWorkspace'
import { useDataSources } from '../settings/useDataSources'
import sidebarResearcher from '../../assets/sidebar-researcher.png'

type WorkflowView = 'profiles' | 'discovery' | 'activity'
type View = WorkflowView | 'leads' | 'settings'

const navigation: Array<{ id: WorkflowView; label: string }> = [
  { id: 'profiles', label: 'Service Profile' },
  { id: 'discovery', label: 'Discover companies' },
  { id: 'activity', label: 'Research' },
]

export function OpportunityWorkspace() {
  const { appearance, setAppearance } = useAppearance()
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
  const [logLimit, setLogLimit] = useState(100)
  const sources = useDataSources(logLimit)
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null)
  const [view, setView] = useState<View>('profiles')
  const [completed, setCompleted] = useState<Record<WorkflowView, boolean>>({ profiles: false, discovery: false, activity: false })
  const complete = useCallback((step: WorkflowView) => {
    setCompleted((current) => current[step] ? current : { ...current, [step]: true })
  }, [])
  const completeProfile = useCallback(() => complete('profiles'), [complete])
  const completeDiscovery = useCallback(() => complete('discovery'), [complete])
  const finishProfile = useCallback(() => { completeProfile(); setView('discovery') }, [completeProfile])
  const finishDiscovery = useCallback(() => { completeDiscovery(); setView('activity') }, [completeDiscovery])
  useEffect(() => {
    let active = true
    void getProfile().then((profile) => {
      if (active && profile.serviceRole) completeProfile()
    }).catch(() => { /* The profile editor exposes loading errors and retry. */ })
    return () => { active = false }
  }, [completeProfile])
  const canOpen = (target: View) => target !== 'discovery' || completed.profiles

  const openSources = () => { setSettingsSection('sources'); setView('settings') }
  const openCompany = (id: string) => { setOpenCompanyId(id); setView('activity') }
  const screens = [...navigation, { id: 'leads', label: 'Leads' }, { id: 'settings', label: 'Settings' }].map((item) => ({ ...item, disabled: !canOpen(item.id as View) }))

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#20242A]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#34312E] bg-[#191817] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-[#34312E] px-6">
          <div aria-hidden="true" className="size-9 rounded-lg bg-[#E86722] shadow-[inset_0_-7px_14px_rgba(129,42,7,0.18)]" />
          <div>
            <p className="text-xl font-semibold tracking-tight text-white">LeadRadar</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C8C2BA]">Sales intelligence</p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex-1 px-3 py-6">
          <ol>{navigation.map(({ id, label }, index) => (
            <li className="relative pb-7 last:pb-0" key={id}>
              {index < navigation.length - 1 && <span aria-hidden="true" className="absolute left-[1.15rem] top-11 text-lg font-bold text-[#77716A]">↓</span>}
              <button aria-current={view === id ? 'step' : undefined} aria-label={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${view === id ? 'bg-[#3B2419] text-[#FFB58F]' : 'text-[#D5D0C9] hover:bg-[#292725] hover:text-white'}`} disabled={!canOpen(id)} onClick={() => setView(id)} type="button">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${completed[id] ? 'bg-[#4F8564] text-white' : view === id ? 'bg-[#E86722] text-white' : 'border border-[#77716A] bg-[#242220] text-[#D5D0C9]'}`}>{completed[id] ? '✓' : index + 1}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}</ol>
        </nav>

        <button aria-label="Leads" aria-current={view === 'leads' ? 'page' : undefined} onClick={() => setView('leads')} className={`mx-3 mb-2 flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${view === 'leads' ? 'bg-[#3B2419] text-[#FFB58F]' : 'text-[#D5D0C9] hover:bg-[#292725] hover:text-white'}`}><svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>Leads</button>
        <button aria-label="Settings" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')} className={`mx-3 mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${view === 'settings' ? 'bg-[#3B2419] text-[#FFB58F]' : 'text-[#D5D0C9] hover:bg-[#292725] hover:text-white'}`}><svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m9 3-1 3-3 1-2 4 2 2 1 4 3 1 2 3 4-1 1-3 3-1 2-4-2-2-1-4-3-1-2-3Z"/><circle cx="12" cy="12" r="3"/></svg>Settings</button>
        <div className="pointer-events-none px-5" aria-hidden="true">
          <img className="mx-auto max-h-64 w-full object-contain object-bottom" src={sidebarResearcher} alt="" />
        </div>
        <p className="mx-5 mb-5 mt-2 text-xs leading-5 text-[#B7B0A8]">Research uses saved profile criteria and public evidence.</p>
      </aside>

      <main className="lr-theme-surface lg:pl-64">
        <TopBar viewLabel={view === 'settings' ? `Settings / ${settingsSection === 'sources' ? 'Data sources' : settingsSection === 'scoring' ? 'Prospect scoring' : settingsSection.charAt(0).toUpperCase() + settingsSection.slice(1)}` : view === 'leads' ? 'Leads' : navigation.find((item) => item.id === view)?.label ?? ''} screens={screens} onNavigate={(id) => { if (screens.some((item) => item.id === id && !item.disabled)) setView(id as View) }} onOpenCompany={openCompany} onOpenSources={openSources} onOpenSetting={(section) => { setSettingsSection(section); setView('settings') }} appearance={appearance} setAppearance={setAppearance} notifications={{ loading: sources.loading && !sources.snapshot, error: sources.error, entryCount: sources.snapshot?.crawl_log.length ?? 0, failures: (sources.snapshot?.crawl_log ?? []).filter((entry) => entry.status === 'error').slice(0, 8).map((entry) => ({ id: entry.id, sourceName: entry.provider, detail: entry.detail, at: entry.at })) }} />
        <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto border-b border-[#DED9D1] bg-white p-3 lg:hidden">
          <select aria-label="Navigate to page" className="w-full rounded-lg border border-[#DED9D1] bg-white p-2 text-sm" value={view} onChange={(event) => setView(event.target.value as View)}>
            {screens.map(({ id, label }) => <option disabled={!canOpen(id as View)} key={id} value={id}>{label}</option>)}
          </select>
        </nav>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
          {view === 'profiles' && <ProfileWorkspace onReady={finishProfile} />}
          {view === 'discovery' && <DiscoveryWorkspace onActivity={() => setView('activity')} onProfile={() => setView('profiles')} onResearchQueued={finishDiscovery} />}
          {view === 'leads' && <LeadsWorkspace onOpenCompany={openCompany} />}
          {view === 'activity' && <ResearchActivityWorkspace initialCompanyId={openCompanyId} onInitialCompanyOpened={() => setOpenCompanyId(null)} />}
          <div hidden={view !== 'settings'}><SettingsWorkspace section={settingsSection} onSection={setSettingsSection} appearance={appearance} setAppearance={setAppearance} {...sources} limit={logLimit} setLimit={setLogLimit} /></div>
        </div>
      </main>
    </div>
  )
}
