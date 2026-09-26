import { useEffect, useRef, useState } from 'react'
import { confirmDiscoveryRun, createDiscoveryRun, type DiscoveryCandidate, type DiscoveryRun } from '../../api/discovery'
import { listProfiles, selectDefaultProfile, type Profile } from '../../api/profiles'
import { importCompanies, submitResearch } from '../../api/research'
import { errorMessage } from '../../api/errors'
import { match, profileSearch, words } from './matching'

export interface ConfirmedCompany { id: string; name: string; domain: string }
type Snapshot = { run: DiscoveryRun; selected: string[]; visible: number }
const cache = new Map<string, Snapshot>()
const field = 'rounded-lg border border-[#D8D3CB] bg-white px-3 py-2.5 text-sm text-[#353A40] focus:outline-none focus:ring-2 focus:ring-orange-200'
const button = 'rounded-lg border border-[#D8D3CB] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#F7F6F3] disabled:opacity-50'
const primary = 'rounded-lg bg-[#E86722] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C94F12] disabled:opacity-50'
const cacheKey = (profile: Profile) => `leadradar.discovery.${profile.current_version.id}`
function readCache(key: string): Snapshot | undefined {
  if (cache.has(key)) return cache.get(key)
  try { const raw = sessionStorage.getItem(key); if (raw) { const saved = JSON.parse(raw) as Snapshot; if (saved.run?.candidates && Array.isArray(saved.selected)) return saved } } catch { /* Storage may be disabled. */ }
}
const employeeLabel = (item: DiscoveryCandidate) => item.employee_count === null ? 'Unknown' : `${item.employee_count.toLocaleString()} · ${item.size_verification === 'verified' ? 'Confirmed' : 'Unconfirmed'}`

export function DiscoveryWorkspace({ onActivity, onProfile }: { onActivity?: () => void; onProfile?: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [detail, setDetail] = useState<DiscoveryCandidate | null>(null)
  const [adding, setAdding] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const request = useRef<AbortController | null>(null)
  const closePanel = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const search = async (current: Profile, signal: AbortSignal) => {
    setLoading(true); setError(''); setNotice('')
    try {
      const settings = profileSearch(current)
      setNotes(settings.notes)
      const run = await createDiscoveryRun(settings.request, signal)
      if (!signal.aborted) setSnapshot({ run, selected: [], visible: 25 })
    } catch (failure) { if (!signal.aborted) setError(errorMessage(failure)) }
    finally { if (!signal.aborted) setLoading(false) }
  }
  useEffect(() => {
    const controller = new AbortController(); request.current = controller
    void listProfiles(controller.signal).then(async (profiles) => {
      if (controller.signal.aborted) return
      const current = selectDefaultProfile(profiles)
      if (!current) { setError('Save a Service Profile before discovering companies.'); setLoading(false); return }
      setProfile(current)
      const settings = profileSearch(current); setNotes(settings.notes)
      const saved = readCache(cacheKey(current))
      if (saved) { setSnapshot(saved); setLoading(false) }
      else await search(current, controller.signal)
    }).catch((failure) => { if (!controller.signal.aborted) { setError(errorMessage(failure)); setLoading(false) } })
    return () => { controller.abort(); request.current?.abort() }
  }, [])
  useEffect(() => {
    if (!profile || !snapshot) return
    const key = cacheKey(profile); cache.set(key, snapshot)
    try { sessionStorage.setItem(key, JSON.stringify(snapshot)) } catch { /* In-memory results still persist during navigation. */ }
  }, [profile, snapshot])
  useEffect(() => {
    if (!detail) return
    previousFocus.current = document.activeElement as HTMLElement
    closePanel.current?.focus()
    return () => previousFocus.current?.focus()
  }, [detail])

  const refresh = () => {
    if (!profile) return
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    void search(profile, controller.signal)
  }
  const toggle = (domain: string) => setSnapshot((current) => current ? { ...current, selected: current.selected.includes(domain) ? current.selected.filter((item) => item !== domain) : current.selected.length < 10 ? [...current.selected, domain] : current.selected } : current)
  const research = async () => {
    if (!profile || !snapshot?.selected.length) return
    setBusy(true); setError(''); setNotice('')
    try {
      const confirmed = await confirmDiscoveryRun(snapshot.run.id, snapshot.selected)
      const outcomes = await Promise.allSettled(confirmed.company_ids.map((id) => submitResearch(id, profile.current_version.id, `discovery-${snapshot.run.id}-${profile.current_version.id}-${id}`)))
      const succeeded = snapshot.selected.filter((_, index) => outcomes[index]?.status === 'fulfilled')
      setSnapshot((current) => current ? { ...current, selected: current.selected.filter((domain) => !succeeded.includes(domain)) } : current)
      setNotice(`${succeeded.length} ${succeeded.length === 1 ? 'company' : 'companies'} queued for research. Follow progress in Research activity.`)
      if (succeeded.length < outcomes.length) setError('Some companies could not be queued. They remain selected so you can retry.')
    } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  const addCompany = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await importCompanies([website.trim()])
      if (result.rejected.length) setError(result.rejected.map((item) => item.message).join(' '))
      if (result.accepted.length) { setNotice('Company added. You can find it on the Companies page.'); setWebsite(''); setAdding(false) }
    } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(false) }
  }
  const candidates = snapshot?.run.candidates ?? []
  const filtered = candidates.filter((item) => `${item.name} ${item.domain}`.toLowerCase().includes(query.toLowerCase()) && (!country || item.country_code === country) && (!industry || (industry === 'unknown' ? !item.industry : item.industry === industry)) && (!size || (size === 'unknown' ? item.employee_count === null : size === 'small' ? item.employee_count !== null && item.employee_count < 250 : size === 'medium' ? item.employee_count !== null && item.employee_count >= 250 && item.employee_count < 1000 : item.employee_count !== null && item.employee_count >= 1000)))
    .sort((a, b) => (profile ? match(b, profile).score - match(a, profile).score : 0) || a.name.localeCompare(b.name))
  const shown = filtered.slice(0, snapshot?.visible ?? 25)
  const selected = snapshot?.selected ?? []
  const hiddenSelected = selected.filter((domain) => !shown.some((item) => item.domain === domain)).length

  return <section className="pb-28 text-[#20242A]" aria-label="Discover companies">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">Discover companies</h2><p className="mt-2 text-sm text-[#68645F]">Companies for {profile ? <strong>{profile.name}</strong> : 'your Service Profile'}. Review their details, then select who to research.</p></div><div className="flex flex-wrap gap-2"><button className={button} onClick={() => setAdding(!adding)}>Add company by website</button><button className={button} disabled={loading || busy || !profile} onClick={refresh}>Refresh results</button></div></div>
    {profile && <div className="mt-5 rounded-xl border border-[#DED9D1] bg-white p-4 text-sm"><p><span className="font-semibold">Saved criteria: </span>{words(profile.current_version.configuration.icp.geographies).join(', ') || 'All geographies'} · {words(profile.current_version.configuration.icp.industries).join(', ') || 'All industries'}</p><p className="mt-1 text-xs text-[#73706A]">Ordered by available company facts. Buying signals and disqualifiers are assessed during research.</p>{notes.map((note) => <p className="mt-1 text-xs text-[#73706A]" key={note}>{note}</p>)}{onProfile && <button className="mt-2 text-sm font-semibold text-[#B64B16]" onClick={onProfile}>Edit Service Profile</button>}</div>}
    {adding && <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#DED9D1] bg-white p-4" onSubmit={(event) => { event.preventDefault(); void addCompany() }}><label className="flex-1 text-sm font-semibold">Company website<input className={`${field} mt-2 block w-full`} placeholder="example.com" value={website} required onChange={(event) => setWebsite(event.target.value)} /></label><button className={primary} disabled={busy || !website.trim()}>Add company</button><button type="button" className={button} onClick={() => setAdding(false)}>Cancel</button></form>}
    {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{!loading && <button className="ml-3 underline" onClick={profile ? refresh : onProfile}>{profile ? 'Retry search' : 'Open Service Profile'}</button>}</div>}
    {notice && <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}{onActivity && notice.includes('research') && <button onClick={onActivity} className="ml-3 font-semibold underline">View research activity</button>}</div>}
    <div className="mt-6 flex flex-wrap gap-3"><input aria-label="Search companies" className={`${field} min-w-52 flex-1`} placeholder="Search company or website" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter by country" className={field} value={country} onChange={(event) => setCountry(event.target.value)}><option value="">All countries</option>{[...new Map(candidates.map((item) => [item.country_code, item.country_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select><select aria-label="Filter by industry" className={field} value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">All industries</option>{[...new Set(candidates.flatMap((item) => item.industry ? [item.industry] : []))].sort().map((value) => <option key={value}>{value}</option>)}<option value="unknown">Unknown industry</option></select><select aria-label="Filter by company size" className={field} value={size} onChange={(event) => setSize(event.target.value)}><option value="">All company sizes</option><option value="small">Under 250 employees</option><option value="medium">250–999 employees</option><option value="large">1,000+ employees</option><option value="unknown">Unknown size</option></select>{(query || country || industry || size) && <button className={button} onClick={() => { setQuery(''); setCountry(''); setIndustry(''); setSize('') }}>Clear filters</button>}</div>
    {loading && <div role="status" className="mt-5 rounded-xl border border-[#DED9D1] bg-white p-5"><p className="text-sm text-[#68645F]">Finding companies matching your Service Profile…</p><div aria-hidden="true" className="mt-5 space-y-4 motion-safe:animate-pulse">{[1, 2, 3, 4].map((item) => <div key={item} className="h-10 rounded bg-[#F0EDE8]" />)}</div></div>}
    {!loading && snapshot && <><p className="mt-5 text-xs text-[#73706A]">Showing {shown.length} of {filtered.length} companies · Best available match first · Updated {new Date(snapshot.run.created_at).toLocaleString()}</p><div className="mt-3 overflow-x-auto rounded-xl border border-[#DED9D1] bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-[#DED9D1] bg-[#F0EDE8] text-xs text-[#68645F]"><tr><th className="p-4"><span className="sr-only">Select</span></th>{['Company', 'Country', 'Industry', 'Employee count', 'Why it matches'].map((label) => <th className="px-4 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody>{shown.map((item) => <tr className="cursor-pointer border-b border-[#EEEAE4] last:border-0 hover:bg-[#FFFAF6]" key={item.domain} onClick={() => setDetail(item)}><td className="p-4" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.domain)} disabled={busy || (!selected.includes(item.domain) && selected.length >= 10)} onChange={() => toggle(item.domain)} className="size-4 accent-[#E86722]" /></td><td className="min-w-48 px-4 py-4"><button className="text-left font-semibold hover:underline" onClick={(event) => { event.stopPropagation(); setDetail(item) }}>{item.name}</button><p className="mt-1 text-xs text-[#73706A]">{item.domain}</p></td><td className="px-4 py-4">{item.country_name}</td><td className="px-4 py-4">{item.industry || 'Unknown'}</td><td className="min-w-40 px-4 py-4 text-[#73706A]">{employeeLabel(item)}</td><td className="min-w-52 px-4 py-4 text-xs leading-5 text-[#68645F]">{profile && match(item, profile).reason}</td></tr>)}</tbody></table>{!shown.length && <div className="p-12 text-center"><h3 className="font-semibold">{candidates.length ? 'No companies match these filters' : 'No companies found'}</h3><p className="mt-2 text-sm text-[#73706A]">{candidates.length ? 'Clear or adjust the filters to see more results.' : 'Try refreshing, review your Service Profile, or add a company by website.'}</p></div>}</div>{shown.length < filtered.length ? <button className={`${button} mt-4`} onClick={() => setSnapshot((current) => current ? { ...current, visible: current.visible + 25 } : current)}>Load more</button> : candidates.length > 0 && <p className="mt-4 text-xs text-[#73706A]">All available results shown{candidates.length >= 50 ? ' (up to 50 per search)' : ''}.</p>}</>}
    {snapshot && <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-[#DED9D1] bg-white px-6 py-4 shadow-lg lg:left-64"><div><p className="text-sm font-semibold">{selected.length} companies selected</p><p className="text-xs text-[#73706A]">Select up to 10 for research.{hiddenSelected > 0 && ` ${hiddenSelected} selected outside the visible results.`}</p></div><div className="flex gap-3">{selected.length > 0 && <button disabled={busy} className={button} onClick={() => setSnapshot({ ...snapshot, selected: [] })}>Clear selection</button>}<button className={primary} disabled={!selected.length || busy || loading} onClick={() => void research()}>{busy ? 'Working…' : 'Research selected'}</button></div></div>}
    {detail && <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDetail(null)}><aside role="dialog" aria-modal="true" aria-labelledby="company-panel-title" className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto border-l border-[#DED9D1] bg-white p-7 shadow-xl" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') setDetail(null); if (event.key === 'Tab') { const nodes = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'); const first = nodes[0]; const last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } } }}><button ref={closePanel} className={button} onClick={() => setDetail(null)}>Close details</button><h2 id="company-panel-title" className="mt-7 text-2xl font-semibold">{detail.name}</h2><a className="mt-2 block text-sm text-[#B64B16] underline" href={`https://${detail.domain}`} target="_blank" rel="noreferrer">{detail.domain}</a><dl className="mt-7 space-y-5">{[['Country', detail.country_name], ['Industry', detail.industry || 'Unknown'], ['Employee count', employeeLabel(detail)], ['Why it matches', profile ? match(detail, profile).reason : '']].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-[#73706A]">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl><div className="mt-7 rounded-lg bg-[#F7F6F3] p-4"><h3 className="text-sm font-semibold">Source</h3><a className="mt-2 block text-sm text-[#B64B16] underline" href={detail.source_url.replace(/^http:/, 'https:')} target="_blank" rel="noreferrer">View company information on Wikidata</a><p className="mt-2 text-xs leading-5 text-[#73706A]">Discovery information may be incomplete or outdated. Unconfirmed employee counts have not been checked against a primary source.</p></div></aside></div>}
  </section>
}
