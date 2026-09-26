import { useCallback, useEffect, useState } from 'react'

import { analyzeEuTender, searchEuTenders, type TenderIntelligence, type TenderOpportunity } from '../../api/euTenders'
import { errorMessage } from '../../api/errors'
import { listProfiles, selectDefaultProfile, type Profile } from '../../api/profiles'
import { Icon } from '../../components/icons'

const typeLabel: Record<TenderOpportunity['call']['opportunity_type'], string> = {
  public_procurement: 'Public procurement', funding_call: 'EU funding call', cascade_funding: 'Cascade funding', market_consultation: 'Market consultation', unknown: 'Needs classification',
}
const recommendationLabel: Record<TenderOpportunity['recommendation'], string> = { bid: 'Bid', partner: 'Find a partner', monitor: 'Monitor', reject: 'Reject', needs_review: 'Review first' }
const recommendationStyle: Record<TenderOpportunity['recommendation'], string> = {
  bid: 'bg-[#E2F5E8] text-[#23653C]', partner: 'bg-[#FFF0E5] text-[#A54716]', monitor: 'bg-[#EDF1F5] text-[#4A5663]', reject: 'bg-[#F9E8E4] text-[#943D2F]', needs_review: 'bg-[#FFF6D9] text-[#7A5B12]',
}
const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not specified'
const money = (value: number | null) => value === null ? 'Not specified' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

export function TenderWorkspace() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [opportunities, setOpportunities] = useState<TenderOpportunity[]>([])
  const [selected, setSelected] = useState<TenderOpportunity | null>(null)
  const [query, setQuery] = useState('')
  const [queries, setQueries] = useState<string[]>([])
  const [portalTotal, setPortalTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const programmeCount = new Set(opportunities.map((item) => item.call.programme).filter(Boolean)).size
  const actionableCount = opportunities.filter((item) => item.recommendation === 'bid' || item.recommendation === 'partner').length
  const upcomingCount = opportunities.filter((item) => item.call.status === 'forthcoming').length

  const run = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const result = await searchEuTenders(id, 20)
      setOpportunities(result.opportunities); setSelected(result.opportunities[0] ?? null); setQuery(result.query); setQueries(result.queries); setPortalTotal(result.total)
    } catch (reason) { setError(errorMessage(reason)); setOpportunities([]); setSelected(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void listProfiles(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      const initial = selectDefaultProfile(items)?.id ?? ''
      setProfiles(items); setProfileId(initial)
      if (!initial) setLoading(false)
      else void run(initial)
    }).catch((reason) => { if (!controller.signal.aborted) { setError(errorMessage(reason)); setLoading(false) } })
    return () => controller.abort()
  }, [run])

  return <div className="text-[#20242A]">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#A44818]">Published demand</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Tender opportunities</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68645F]">Turn EU procurement and funding calls into explainable bid, partner, monitor, or reject decisions.</p></div>
      <div className="flex min-w-[290px] items-end gap-3"><label className="flex-1 text-xs font-semibold text-[#59554F]">Service profile<select className="mt-2 w-full rounded-xl border border-[#D6D0C7] bg-white px-3 py-2.5 text-sm" value={profileId} onChange={(event) => { setProfileId(event.target.value); void run(event.target.value) }}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><button className="rounded-xl bg-[#C94F12] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!profileId || loading} onClick={() => void run(profileId)}>{loading ? 'Searching…' : 'Refresh'}</button></div>
    </header>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[#E6B8AE] bg-[#FFF4F1] p-4 text-sm text-[#8A2F20]">Could not load EU opportunities. {error}</p>}
    <div className="mt-7 flex flex-wrap items-center gap-3 text-xs text-[#68645F]"><span className="rounded-full bg-[#1D1B19] px-3 py-1.5 font-semibold text-white">{opportunities.length} qualified results</span><span>{portalTotal} candidates reviewed across {queries.length || 1} searches</span>{query && <span>Primary query: <strong className="text-[#35312D]">{query}</strong></span>}</div>
    {queries.length > 1 && <div aria-label="Search portfolio" className="mt-3 flex flex-wrap gap-2">{queries.map((item) => <span className="rounded-full border border-[#DDD5CB] bg-white px-3 py-1.5 text-xs text-[#665F58]" key={item}>{item}</span>)}</div>}
    {opportunities.length > 0 && <dl className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#DDD7CF] bg-white p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-[#80786F]">Programmes represented</dt><dd className="mt-1 text-2xl font-semibold text-[#C94F12]">{programmeCount}</dd></div><div className="rounded-xl border border-[#DDD7CF] bg-white p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-[#80786F]">Actionable now</dt><dd className="mt-1 text-2xl font-semibold text-[#C94F12]">{actionableCount}</dd></div><div className="rounded-xl border border-[#DDD7CF] bg-white p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-[#80786F]">Forthcoming</dt><dd className="mt-1 text-2xl font-semibold text-[#C94F12]">{upcomingCount}</dd></div></dl>}
    {!loading && !error && opportunities.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-[#CEC7BE] bg-white p-12 text-center"><h2 className="font-semibold">No sufficiently relevant open calls</h2><p className="mt-2 text-sm text-[#68645F]">The portal may have candidates, but none passed the service-specific relevance and deadline checks.</p></div>}
    {opportunities.length > 0 && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(330px,.8fr)_minmax(0,1.45fr)]">
      <section aria-label="Tender results" className="space-y-3">{opportunities.map((item) => <button type="button" onClick={() => setSelected(item)} key={`${item.call.identifier}-${item.call.url}`} className={`w-full rounded-2xl border p-5 text-left transition ${selected?.call.url === item.call.url ? 'border-[#E86722] bg-[#FFF7F1] shadow-[0_8px_26px_rgba(120,55,16,.08)]' : 'border-[#DDD7CF] bg-white hover:border-[#E0A47E]'}`}>
        <span className="flex items-start justify-between gap-4"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8A5A3F]">{typeLabel[item.call.opportunity_type]}</span><span className={`rounded-md px-2 py-1 text-[11px] font-bold ${recommendationStyle[item.recommendation]}`}>{recommendationLabel[item.recommendation]}</span></span>
        <strong className="mt-3 block text-sm leading-6">{item.call.title}</strong><span className="mt-4 flex items-end justify-between"><span className="text-xs text-[#716B64]">Deadline {date(item.call.deadline)}</span><span><b className="text-2xl text-[#C94F12]">{item.fit_score}</b><small className="text-[#837D76]">/100</small></span></span>
      </button>)}</section>
      {selected && <TenderBrief opportunity={selected} />}
    </div>}
  </div>
}

function TenderBrief({ opportunity }: { opportunity: TenderOpportunity }) {
  const { call } = opportunity
  const [intelligence, setIntelligence] = useState<TenderIntelligence | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    setIntelligence(null)
    setAnalysisError('')
  }, [call.url])

  async function analyze() {
    setAnalyzing(true); setAnalysisError('')
    try { setIntelligence(await analyzeEuTender(call)) }
    catch (reason) { setAnalysisError(errorMessage(reason)) }
    finally { setAnalyzing(false) }
  }

  return <article className="rounded-2xl border border-[#D9D3CA] bg-white p-6 shadow-[0_12px_34px_rgba(58,45,31,.07)] sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[.14em] text-[#A44818]">Tender fit brief</span><h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight">{call.title}</h2><p className="mt-2 text-xs text-[#77716A]">{call.identifier} · {typeLabel[call.opportunity_type]}</p></div><div className="text-right"><span className={`rounded-lg px-3 py-2 text-xs font-bold ${recommendationStyle[opportunity.recommendation]}`}>{recommendationLabel[opportunity.recommendation]}</span><p className="mt-3 text-3xl font-semibold text-[#C94F12]">{opportunity.fit_score}<small className="text-sm text-[#77716A]">/100</small></p></div></div>
    <div className="mt-6 rounded-xl border-l-4 border-[#E86722] bg-[#FFF5ED] px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-[#9C4216]">Screening decision</p><p className="mt-2 text-sm font-semibold leading-6 text-[#3F332C]">{opportunity.decision_summary}</p></div>
    <section className="mt-5 rounded-2xl bg-[#201E1C] p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#FF9B65]">Tender intelligence copilot</p><h3 className="mt-1 text-lg font-semibold">Verify the call before spending bid effort</h3><p className="mt-1 max-w-xl text-xs leading-5 text-[#CBC5BE]">Collect the official page and turn exact excerpts into eligibility, consortium, funding and deadline checks.</p></div><button className="rounded-xl bg-[#E86722] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={analyzing} onClick={() => void analyze()} type="button">{analyzing ? 'Analyzing source…' : intelligence ? 'Refresh analysis' : 'Analyze official source'}</button></div>{analysisError && <p role="alert" className="mt-4 text-sm text-[#FFB7A6]">Analysis failed: {analysisError}</p>}{intelligence && <IntelligenceResult value={intelligence} />}</section>
    <p className="mt-6 text-sm leading-7 text-[#56514C]">{call.summary || 'No public summary was supplied by the portal.'}</p>
    <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Deadline', date(call.deadline)], ['Budget', money(call.budget)], ['Programme', call.programme ?? 'Not specified'], ['Status', call.status]].map(([label, value]) => <div className="rounded-xl bg-[#F6F3EE] p-4" key={label}><dt className="text-[11px] font-bold uppercase tracking-wider text-[#817A72]">{label}</dt><dd className="mt-2 text-sm font-semibold capitalize">{value}</dd></div>)}</dl>
    <section className="mt-8"><h3 className="font-semibold">Decision dimensions</h3><div className="mt-4 space-y-4">{opportunity.dimensions.map((dimension) => <div key={dimension.id}><div className="flex justify-between gap-3 text-sm"><span>{dimension.label}</span><strong>{dimension.score === null ? 'Unknown' : `${dimension.score}/100`}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEEAE4]"><span className="block h-full rounded-full bg-[#E86722]" style={{ width: `${dimension.score ?? 0}%` }} /></div><p className="mt-1.5 text-xs leading-5 text-[#77716A]">{dimension.explanation}</p></div>)}</div></section>
    <section className="mt-8 grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold">Matched profile terms</h3><div className="mt-3 flex flex-wrap gap-2">{opportunity.matched_terms.map((term) => <span className="rounded-full bg-[#EAF4ED] px-3 py-1.5 text-xs font-semibold text-[#2E6843]" key={term}>{term}</span>)}</div><h3 className="mt-6 font-semibold">Risks before action</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-[#6A554A]">{opportunity.risks.map((risk) => <li className="flex gap-2" key={risk}><span aria-hidden="true">•</span>{risk}</li>)}</ul></div><div className="rounded-xl bg-[#F5F2ED] p-5"><h3 className="font-semibold">Recommended next steps</h3><ol className="mt-4 space-y-3 text-sm leading-5 text-[#554F49]">{opportunity.next_actions.map((action, index) => <li className="flex gap-3" key={action}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#1D1B19] text-[11px] font-bold text-white">{index + 1}</span><span>{action}</span></li>)}</ol></div></section>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E0D8] pt-6"><p className="text-xs text-[#77716A]">Fit is an explainable screening score, not a guarantee of eligibility or award.</p><a className="inline-flex items-center gap-2 rounded-xl bg-[#1D1B19] px-4 py-2.5 text-sm font-semibold text-white" href={call.url} target="_blank" rel="noreferrer">Open official call <Icon name="chevron" width="15" height="15" /></a></div>
  </article>
}

const intelligenceLabel: Record<TenderIntelligence['decision'], string> = { go_to_bid_review: 'Go to bid review', partner_search: 'Partner search', needs_review: 'Needs review', insufficient_evidence: 'Insufficient evidence' }

function IntelligenceResult({ value }: { value: TenderIntelligence }) {
  return <div className="mt-5 border-t border-white/15 pt-5"><div className="flex flex-wrap gap-3"><span className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#26221F]">{intelligenceLabel[value.decision]}</span><span className="rounded-lg border border-white/20 px-3 py-2 text-sm">Confidence {value.confidence}%</span><span className="rounded-lg border border-white/20 px-3 py-2 text-sm">Evidence coverage {value.evidence_coverage}%</span></div>{value.warnings.map((warning) => <p className="mt-3 text-xs text-[#FFC6A8]" key={warning}>{warning}</p>)}<div className="mt-5 grid gap-3 md:grid-cols-2">{value.facts.map((fact) => <div className={`rounded-xl border p-4 ${fact.status === 'supported' ? 'border-[#3E7854] bg-[#263D2E]' : 'border-[#6A554A] bg-[#302925]'}`} key={fact.category}><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{fact.label}</h4><span className={`text-[10px] font-bold uppercase tracking-wider ${fact.status === 'supported' ? 'text-[#7FE09F]' : 'text-[#E9A27E]'}`}>{fact.status === 'supported' ? 'Evidence found' : 'Not found'}</span></div><p className="mt-2 text-xs leading-5 text-[#D4CEC8]">{fact.finding}</p>{fact.excerpt && <blockquote className="mt-3 border-l-2 border-[#E86722] pl-3 text-xs italic leading-5 text-[#F2ECE6]">“{fact.excerpt}”</blockquote>}<a className="mt-3 inline-block text-xs font-semibold text-[#FF9B65] hover:underline" href={fact.source_url} target="_blank" rel="noreferrer">Open evidence source</a></div>)}</div>{value.blockers.length > 0 && <div className="mt-5"><h4 className="text-sm font-semibold">Decision blockers</h4><ul className="mt-2 space-y-1 text-xs text-[#E5C0AE]">{value.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div>}</div>
}
