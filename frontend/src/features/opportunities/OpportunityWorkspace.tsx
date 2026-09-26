import { useCallback, useEffect, useState } from 'react'

import { ResearchActivityWorkspace } from '../activity/ResearchActivity'
import { DiscoveryWorkspace } from '../discovery/DiscoveryWorkspace'
import { ProfileWorkspace } from '../profiles/ProfileWorkspace'
import { getProfile } from '../profiles/repository'
import sidebarResearcher from '../../assets/sidebar-researcher.png'

type View = 'profiles' | 'discovery' | 'activity'

const navigation: Array<{ id: View; label: string }> = [
  { id: 'profiles', label: 'Service Profile' },
  { id: 'discovery', label: 'Discover companies' },
  { id: 'activity', label: 'Research' },
]

export function OpportunityWorkspace() {
  const [view, setView] = useState<View>('profiles')
  const [completed, setCompleted] = useState<Record<View, boolean>>({ profiles: false, discovery: false, activity: false })
  const complete = useCallback((step: View) => {
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

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#20242A]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#34312E] bg-[#191817] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-[#34312E] px-6">
          <div className="grid size-9 place-items-center rounded-lg bg-[#E86722] font-black text-white">L</div>
          <div>
            <p className="font-semibold tracking-tight text-white">LeadRadar</p>
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

        <div className="pointer-events-none px-5" aria-hidden="true">
          <img className="mx-auto max-h-64 w-full object-contain object-bottom" src={sidebarResearcher} alt="" />
        </div>
        <p className="mx-5 mb-5 mt-2 text-xs leading-5 text-[#B7B0A8]">Research uses saved profile criteria and public evidence.</p>
      </aside>

      <main className="lg:pl-64">
        <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto border-b border-[#DED9D1] bg-white p-3 lg:hidden">
          <select aria-label="Navigate to page" className="w-full rounded-lg border border-[#DED9D1] bg-white p-2 text-sm" value={view} onChange={(event) => setView(event.target.value as View)}>
            {navigation.map(({ id, label }) => <option disabled={!canOpen(id)} key={id} value={id}>{label}</option>)}
          </select>
        </nav>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
          {view === 'profiles' && <ProfileWorkspace onReady={finishProfile} />}
          {view === 'discovery' && <DiscoveryWorkspace onActivity={() => setView('activity')} onProfile={() => setView('profiles')} onResearchQueued={finishDiscovery} />}
          {view === 'activity' && <ResearchActivityWorkspace />}
        </div>
      </main>
    </div>
  )
}
