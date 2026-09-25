import { useEffect, useMemo, useState } from 'react'

import { CompanyWorkspace } from '../companies/CompanyWorkspace'
import { ResearchActivityWorkspace } from '../activity/ResearchActivity'
import { ProfileWorkspace } from '../profiles/ProfileWorkspace'
import { DiscoveryWorkspace, type ConfirmedCompany } from '../discovery/DiscoveryWorkspace'
import { ResearchLauncher } from '../activity/ResearchLauncher'
import { serviceOptions } from './fixtures'
import { listOpportunities } from './repository'
import type {
  Opportunity,
  OpportunityStatus,
  ServiceKey,
} from './types'

const statusOptions: Array<{ label: string; value: OpportunityStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Shortlisted', value: 'shortlisted' },
]

function formatRelativeTime(value: string | null) {
  if (value === null) return 'Not researched'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-300' : score >= 70 ? 'text-cyan-300' : 'text-amber-300'

  return (
    <div className="relative grid size-14 place-items-center rounded-full bg-slate-800">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(currentColor ${score * 3.6}deg, rgb(30 41 59) 0deg)`,
          color: score >= 80 ? '#6ee7b7' : score >= 70 ? '#67e8f9' : '#fcd34d',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0)',
        }}
      />
      <span className={`text-lg font-semibold ${color}`}>{score}</span>
    </div>
  )
}

function OpportunityRow({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const initials = opportunity.companyName
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')

  return (
    <article className="group grid gap-5 border-b border-slate-800/80 px-5 py-5 transition hover:bg-slate-900/70 lg:grid-cols-[minmax(260px,1.2fr)_minmax(240px,1fr)_120px_100px] lg:items-center lg:px-7">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-white">{opportunity.companyName}</h3>
            {opportunity.status === 'shortlisted' && (
              <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
                Shortlisted
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {opportunity.domain} · {opportunity.industry} · {opportunity.geography}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-200">
          {opportunity.strongestSignal ?? 'No supported signal yet'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {opportunity.signalCount} verified signals · {Math.round(opportunity.coverage * 100)}% coverage
        </p>
      </div>

      <div className="flex items-center gap-3 lg:justify-center">
        <ScoreRing score={opportunity.score} />
        <span className="text-xs text-slate-500 lg:hidden">Priority score</span>
      </div>

      <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
        <div>
          <p className="text-xs text-slate-500">Researched</p>
          <p className="mt-1 text-xs text-slate-300">
            {formatRelativeTime(opportunity.lastResearchedAt)}
          </p>
        </div>
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          onClick={onOpen}
          type="button"
        >
          View evidence
        </button>
      </div>
    </article>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
        <span aria-hidden="true" className="text-xl">⌕</span>
      </div>
      <h3 className="mt-4 font-semibold text-white">No matching opportunities</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Try another service, clear the search, or start a research run for new accounts.
      </p>
    </div>
  )
}

export function OpportunityWorkspace() {
  const [view, setView] = useState<'opportunities' | 'company' | 'activity' | 'profiles' | 'discovery'>('opportunities')
  const [confirmedCompanies, setConfirmedCompanies] = useState<ConfirmedCompany[]>([])
  const [service, setService] = useState<ServiceKey>('automation')
  const [status, setStatus] = useState<OpportunityStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)

    setLoadError('')
    void listOpportunities({ service, status, query })
      .then((result) => { if (active) setOpportunities(result) })
      .catch(() => { if (active) setLoadError('Opportunities could not be loaded. Try again.') })
      .finally(() => { if (active) setIsLoading(false) })

    return () => {
      active = false
    }
  }, [service, status, query])

  const eligibleCount = useMemo(
    () => opportunities.filter((item) => item.eligibility === 'eligible').length,
    [opportunities],
  )

  return (
    <div className="min-h-screen bg-[#080d17] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800/80 bg-[#0b111e] lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-slate-800/80 px-6">
          <div className="grid size-9 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">L</div>
          <div>
            <p className="font-semibold tracking-tight text-white">SignalDesk</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Team LIDL</p>
          </div>
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-6">
          {([
            ['opportunities', 'Opportunities'],
            ['company', 'Companies'],
            ['activity', 'Research activity'],
            ['profiles', 'Service profiles'],
            ['discovery', 'Discover companies'],
          ] as const).map(([id, label]) => (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                view === id
                  ? 'bg-cyan-300/10 text-cyan-200'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
              key={id}
              onClick={() => setView(id)}
              type="button"
            >
              <span className={`size-1.5 rounded-full ${view === id ? 'bg-cyan-300' : 'bg-slate-600'}`} />
              {label}
            </button>
          ))}
        </nav>

        <div className="m-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-semibold text-slate-300">Research capacity</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[36%] rounded-full bg-cyan-300" />
          </div>
          <p className="mt-2 text-xs text-slate-500">18 of 50 accounts this batch</p>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="border-b border-slate-800/80 bg-[#080d17]/90 px-5 py-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Sales intelligence</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{view === 'opportunities' ? 'Opportunities' : view === 'company' ? 'Company evidence' : view === 'activity' ? 'Research activity' : view === 'discovery' ? 'Company sourcing' : 'Configuration'}</h1>
            </div>
            <button
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              onClick={() => setView('discovery')}
              type="button"
            >
              Import companies
            </button>
          </div>
        </header>

        {view === 'company' && <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><CompanyWorkspace /></div>}
        {view === 'activity' && <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><ResearchActivityWorkspace /></div>}
        {view === 'profiles' && <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><ProfileWorkspace /></div>}
        {view === 'discovery' && <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><DiscoveryWorkspace onConfirmed={setConfirmedCompanies} /><ResearchLauncher companies={confirmedCompanies} /></div>}
        {view === 'opportunities' && <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100/80">
            Demo fixture data · Example companies are not confirmed sales opportunities.
          </div>

          <section aria-labelledby="service-heading" className="mt-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-sm font-semibold text-slate-300" id="service-heading">Service profile</h2>
                <p className="mt-1 text-sm text-slate-500">Scores are comparable only within the selected profile.</p>
              </div>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-200">{eligibleCount}</span> eligible accounts
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {serviceOptions.map((option) => {
                const selected = option.key === service
                return (
                  <button
                    aria-pressed={selected}
                    className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
                      selected
                        ? 'border-cyan-300/50 bg-cyan-300/10 shadow-lg shadow-cyan-950/20'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                    key={option.key}
                    onClick={() => setService(option.key)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${selected ? 'text-cyan-200' : 'text-slate-300'}`}>
                        {option.name}
                      </span>
                      <span className={`size-2 rounded-full ${selected ? 'bg-cyan-300' : 'bg-slate-700'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#0b111e] shadow-2xl shadow-black/10">
            <div className="flex flex-col gap-4 border-b border-slate-800/80 p-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
              <div className="flex gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label="Opportunity status">
                {statusOptions.map((option) => (
                  <button
                    aria-pressed={status === option.value}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      status === option.value
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-200'
                    }`}
                    key={option.value}
                    onClick={() => setStatus(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="relative block lg:w-72">
                <span className="sr-only">Search companies</span>
                <span aria-hidden="true" className="absolute left-3 top-2.5 text-slate-500">⌕</span>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search company or domain"
                  type="search"
                  value={query}
                />
              </label>
            </div>

            <div className="hidden grid-cols-[minmax(260px,1.2fr)_minmax(240px,1fr)_120px_100px] gap-5 border-b border-slate-800/80 bg-slate-900/40 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid">
              <span>Company</span>
              <span>Strongest evidence</span>
              <span className="text-center">Priority</span>
              <span className="text-right">Activity</span>
            </div>

            {isLoading ? (
              <div className="space-y-1 p-5" aria-label="Loading opportunities">
                {[1, 2, 3].map((item) => (
                  <div className="h-24 animate-pulse rounded-xl bg-slate-900" key={item} />
                ))}
              </div>
            ) : loadError ? (
              <div className="px-6 py-20 text-center"><h3 className="font-semibold text-red-200">Research data unavailable</h3><p className="mt-2 text-sm text-slate-500">{loadError}</p></div>
            ) : opportunities.length > 0 ? (
              <div>
                {opportunities.map((opportunity) => (
                  <OpportunityRow key={opportunity.id} onOpen={() => setView('company')} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </section>
        </div>}
      </main>
    </div>
  )
}
