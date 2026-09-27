import { useCallback, useEffect, useMemo, useState } from 'react'

import { errorMessage } from '../../api/errors'
import { downloadOpportunities } from '../../api/exports'
import { listOpportunityRecords, type OpportunityRecord } from '../../api/opportunities'
import { LeadsFunnel } from './LeadsInsights'

type FilterId = 'all' | 'eligible' | 'needs_research' | 'excluded' | 'shortlisted'
type SortKey = 'company' | 'score' | 'coverage' | 'updated'
type Direction = 'asc' | 'desc'

const PAGE_SIZE = 100
const MAX_PAGES = 10

const filters: Array<{ id: FilterId; label: string; test: (lead: OpportunityRecord) => boolean }> = [
  { id: 'all', label: 'All leads', test: () => true },
  { id: 'eligible', label: 'Ready to contact', test: (lead) => lead.eligibility === 'eligible' && lead.status !== 'dismissed' },
  { id: 'needs_research', label: 'Needs research', test: (lead) => lead.eligibility === 'needs_research' },
  { id: 'excluded', label: 'Excluded', test: (lead) => lead.eligibility === 'excluded' },
  { id: 'shortlisted', label: 'Shortlisted', test: (lead) => lead.status === 'shortlisted' },
]

const eligibility: Record<OpportunityRecord['eligibility'], { label: string; tone: string }> = {
  eligible: { label: 'Ready', tone: 'bg-[#D7F4E1] text-[#116B39]' },
  needs_research: { label: 'Needs research', tone: 'bg-[#FFF4D9] text-[#8A6414]' },
  excluded: { label: 'Excluded', tone: 'bg-[#FBE9E5] text-[#9A3828]' },
}

const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
const humanize = (value: string) => value.replace(/[-_]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase())

async function loadAllOpportunities(signal: AbortSignal) {
  const items: OpportunityRecord[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listOpportunityRecords({ page, page_size: PAGE_SIZE, sort: 'score_desc' }, signal)
    items.push(...result.items)
    if (items.length >= result.meta.total || result.items.length === 0) break
  }
  return items
}

export function LeadsWorkspace({ onOpenCompany }: { onOpenCompany: (companyId: string) => void }) {
  const [leads, setLeads] = useState<OpportunityRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [profile, setProfile] = useState('all')
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({ key: 'score', direction: 'desc' })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    loadAllOpportunities(controller.signal)
      .then((items) => setLeads(items))
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  const rows = useMemo(() => leads ?? [], [leads])
  const profiles = useMemo(() => [...new Map(rows.map((lead) => [lead.profile_id, lead.profile_name])).entries()], [rows])
  const inProfile = useMemo(() => rows.filter((lead) => profile === 'all' || lead.profile_id === profile), [rows, profile])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const test = filters.find((item) => item.id === filter)?.test ?? (() => true)
    const value = (lead: OpportunityRecord) => sort.key === 'company' ? lead.company_name.toLowerCase()
      : sort.key === 'coverage' ? lead.coverage
      : sort.key === 'updated' ? lead.last_researched_at
      : lead.score
    return inProfile
      .filter((lead) => test(lead) && (!needle || lead.company_name.toLowerCase().includes(needle) || lead.canonical_domain.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const left = value(a)
        const right = value(b)
        if (left === right) return a.company_name.localeCompare(b.company_name)
        return (left > right ? 1 : -1) * (sort.direction === 'asc' ? 1 : -1)
      })
  }, [inProfile, query, filter, sort])

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : key === 'company' && current.key !== key ? 'asc' : 'desc' }))
  const clearFilters = () => { setQuery(''); setFilter('all'); setProfile('all') }

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      await downloadOpportunities(profile === 'all' ? {} : { profile_id: profile })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setExporting(false)
    }
  }, [profile])

  const header = (key: SortKey, label: string, align = '') => (
    <button type="button" aria-label={`Sort by ${label}${sort.key === key ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`} className={`flex items-center gap-1 font-bold uppercase tracking-wider hover:text-[#A64212] ${align}`} onClick={() => toggleSort(key)}>
      {label}<span aria-hidden="true">{sort.key === key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
    </button>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#20242A]">Leads</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625D57]">
            {leads ? `${rows.length} researched ${rows.length === 1 ? 'company' : 'companies'}, ranked by score. Scores rest on quoted public evidence; evidence coverage shows the share of profile signals with verified evidence. It is not a fit or buying-intent score.` : 'Researched companies, ranked by score.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-[#CFC7BC] bg-white px-3.5 py-2 text-sm font-semibold text-[#34383D] transition hover:bg-[#F0EDE8] disabled:cursor-wait disabled:opacity-50" disabled={loading} onClick={() => setReloadKey((key) => key + 1)}>Refresh</button>
          <button type="button" className="rounded-lg border border-[#D65A1B] bg-white px-3.5 py-2 text-sm font-semibold text-[#A64212] transition hover:bg-[#FFF1E8] disabled:cursor-wait disabled:opacity-50" disabled={exporting || rows.length === 0} onClick={() => void exportCsv()}>{exporting ? 'Exporting…' : 'Export CSV'}</button>
        </div>
      </header>

      {rows.length > 0 && !error && (
        <LeadsFunnel leads={inProfile} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search leads" className="h-10 w-72 rounded-xl border border-[#DED9D1] bg-white px-3 text-sm text-[#20242A] placeholder:text-[#8A847D]" placeholder="Search by company or domain" value={query} onChange={(event) => setQuery(event.target.value)} />
        {profiles.length > 1 && (
          <select aria-label="Filter by service profile" className="h-10 rounded-xl border border-[#DED9D1] bg-white px-3 text-sm text-[#20242A]" value={profile} onChange={(event) => setProfile(event.target.value)}>
            <option value="all">All profiles</option>
            {profiles.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lead filters">
          {filters.map((item) => {
            const count = inProfile.filter(item.test).length
            const active = filter === item.id
            return (
              <button key={item.id} type="button" aria-pressed={active} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${active ? 'bg-[#E86722] text-white' : 'bg-[#EEEAE4] text-[#4F4943] hover:bg-[#E3DDD4]'}`} onClick={() => setFilter(item.id)}>
                {item.label}<span className="tabular-nums opacity-75">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-[#E6B8AE] bg-[#FFF7F5] p-5 text-sm text-[#8A2F20]">
          <span>Could not load leads: {error}</span>
          <button type="button" className="rounded-lg border border-[#E6B8AE] bg-white px-3 py-1.5 font-semibold" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      ) : loading && !leads ? (
        <p className="rounded-2xl border border-[#CFC7BC] bg-white p-8 text-center text-sm text-[#625D57]">Loading leads…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#CFC7BC] bg-white p-10 text-center">
          <h2 className="font-semibold text-[#25292E]">No researched companies yet</h2>
          <p className="mt-2 text-sm text-[#625D57]">Discover companies and run research; scored companies appear here.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-[#CFC7BC] bg-white p-10 text-center">
          <h2 className="font-semibold text-[#25292E]">Nothing matches those filters</h2>
          <button type="button" className="mt-4 rounded-lg border border-[#CFC7BC] bg-white px-3.5 py-2 text-sm font-semibold text-[#34383D] hover:bg-[#F0EDE8]" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#CFC7BC] bg-white shadow-[0_8px_28px_rgba(58,45,31,0.09)]">
          <div className="grid grid-cols-[minmax(200px,1.5fr)_72px_130px_minmax(140px,1fr)_120px_110px_72px] gap-5 border-b-2 border-[#C8BFB3] bg-[#E8E2DA] px-6 py-3 text-[11px] text-[#4F4943]">
            {header('company', 'Company')}
            {header('score', 'Score')}
            <span className="font-bold uppercase tracking-wider">Status</span>
            <span className="font-bold uppercase tracking-wider">Strongest signal</span>
            {header('coverage', 'Evidence coverage')}
            {header('updated', 'Researched')}
            <span className="text-right font-bold uppercase tracking-wider">Evidence</span>
          </div>
          <ul className="divide-y divide-[#D8D0C6]">
            {visible.map((lead) => {
              const state = eligibility[lead.eligibility]
              const coverage = Math.round(lead.coverage * 100)
              return (
                <li key={lead.id} className="grid cursor-pointer grid-cols-[minmax(200px,1.5fr)_72px_130px_minmax(140px,1fr)_120px_110px_72px] items-center gap-5 px-6 py-4 transition even:bg-[#FBF9F6] hover:bg-[#FFF0E5]" onClick={() => onOpenCompany(lead.company_id)}>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[#25292E]">{lead.company_name}</h2>
                    <p className="mt-1 truncate text-sm text-[#625D57]">{lead.canonical_domain}{profiles.length > 1 ? ` · ${lead.profile_name}` : ''}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-lg px-2.5 py-1 text-base font-bold tabular-nums ${lead.eligibility === 'excluded' ? 'bg-[#EEEAE4] text-[#8A847D] line-through' : lead.score >= 70 ? 'bg-[#E86722] text-white' : 'bg-[#EEEAE4] text-[#34383D]'}`}>{Math.round(lead.score)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}>{state.label}</span>
                    {lead.status !== 'new' && <span className="inline-flex rounded-full bg-[#E9F1FA] px-2.5 py-1 text-xs font-semibold capitalize text-[#315F8B]">{lead.status}</span>}
                  </div>
                  <p className="truncate text-sm text-[#34383D]" title={lead.strongest_signal ?? undefined}>{lead.strongest_signal ? humanize(lead.strongest_signal) : <span className="text-[#8A847D]">None confirmed</span>}</p>
                  <div title={`${coverage}% of configured profile signals have verified evidence`}>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEEAE4]" role="meter" aria-label={`Evidence coverage for ${lead.company_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage}>
                      <div className="h-full rounded-full bg-[#4F8564]" style={{ width: `${coverage}%` }} />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-[#625D57]">{coverage}% signals supported</p>
                  </div>
                  <time className="text-sm text-[#625D57]" dateTime={lead.last_researched_at}>{formatDate(lead.last_researched_at)}</time>
                  <div className="flex justify-end">
                    <button type="button" className="rounded-lg border border-[#D65A1B] bg-white px-3.5 py-2 text-xs font-semibold text-[#A64212] transition hover:bg-[#FFF1E8]" onClick={(event) => { event.stopPropagation(); onOpenCompany(lead.company_id) }} aria-label={`Open research for ${lead.company_name}`}>Open</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
