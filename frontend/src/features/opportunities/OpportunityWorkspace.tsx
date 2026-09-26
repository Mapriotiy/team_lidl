import { useState } from 'react'

import { ResearchActivityWorkspace } from '../activity/ResearchActivity'
import { DiscoveryWorkspace } from '../discovery/DiscoveryWorkspace'
import { ProfileWorkspace } from '../profiles/ProfileWorkspace'

type View = 'profiles' | 'discovery' | 'activity'

const navigation: Array<{ id: View; label: string }> = [
  { id: 'profiles', label: 'Service Profile' },
  { id: 'discovery', label: 'Discover companies' },
  { id: 'activity', label: 'Research' },
]

export function OpportunityWorkspace() {
  const [view, setView] = useState<View>('profiles')

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#20242A]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#DED9D1] bg-[#FBFAF7] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-[#E4E0D9] px-6">
          <div className="grid size-9 place-items-center rounded-lg bg-[#E86722] font-black text-white">L</div>
          <div>
            <p className="font-semibold tracking-tight text-[#20242A]">LeadRadar</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B665E]">Sales intelligence</p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-6">
          {navigation.map(({ id, label }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${view === id ? 'bg-[#FFF1E8] text-[#A64212]' : 'text-[#68645F] hover:bg-[#F0EDE8] hover:text-[#20242A]'}`}
              key={id}
              onClick={() => setView(id)}
              type="button"
            >
              <span className={`size-1.5 rounded-full ${view === id ? 'bg-[#C94F12]' : 'bg-[#8F877D]'}`} />
              {label}
            </button>
          ))}
        </nav>

        <p className="m-5 text-xs leading-5 text-[#6B665E]">Research uses saved profile criteria and public evidence.</p>
      </aside>

      <main className="lg:pl-64">
        <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto border-b border-[#DED9D1] bg-white p-3 lg:hidden">
          <select aria-label="Navigate to page" className="w-full rounded-lg border border-[#DED9D1] bg-white p-2 text-sm" value={view} onChange={(event) => setView(event.target.value as View)}>
            {navigation.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </nav>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
          {view === 'profiles' && <ProfileWorkspace />}
          {view === 'discovery' && <DiscoveryWorkspace onActivity={() => setView('activity')} onProfile={() => setView('profiles')} />}
          {view === 'activity' && <ResearchActivityWorkspace />}
        </div>
      </main>
    </div>
  )
}
