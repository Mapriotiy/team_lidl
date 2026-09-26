import { useEffect, useMemo, useState } from 'react'

import { errorMessage } from '../../api/errors'
import { deleteCompanyResearch, listCompanies } from '../../api/research'
import { getCompany } from '../companies/repository'
import type { CompanyDetail, Evidence, ResearchRun } from '../companies/types'

const formatTime = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function ResearchActivity({ runs }: { runs: ResearchRun[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
      <h2 className="font-semibold text-white">Research history</h2>
      <div className="mt-5 space-y-5">
        {runs.map((run) => (
          <article className="relative border-l border-slate-700 pl-5" key={run.id}>
            <span className={`absolute -left-1.5 top-1 size-3 rounded-full ${run.status === 'completed' ? 'bg-emerald-300' : run.status === 'partial' ? 'bg-amber-300' : 'bg-red-300'}`} />
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold capitalize text-slate-200">{run.companyName ? `${run.companyName} · ` : ''}{run.status} run</p><time className="text-xs text-slate-500">{formatTime(run.finishedAt)}</time></div>
            <p className="mt-1 text-xs text-slate-500">{run.collected}/{run.collectionTotal || run.collected} pages collected · {run.assessed}/{run.assessmentTotal || run.assessed} signals assessed</p>
            {run.model && <p className="mt-1 text-xs text-slate-600">{run.model} · {(run.totalTokens ?? 0).toLocaleString()} tokens · {run.costUsd == null ? 'cost unavailable' : `$${run.costUsd.toFixed(4)}`}</p>}
            {run.warning && <p className="mt-2 rounded-lg bg-amber-300/5 px-3 py-2 text-xs leading-5 text-amber-100/70">{run.warning}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

export function ResearchActivityWorkspace() {
  const [companies, setCompanies] = useState<CompanyDetail[] | null>(null)
  const [selected, setSelected] = useState<CompanyDetail | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CompanyDetail | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setCompanies(null); setError('')
    const refresh = async () => {
      let delay = 15000
      try {
        const companies = await listCompanies(controller.signal)
        const details: CompanyDetail[] = []
        // Bound detail requests instead of flooding the API for every stored company.
        for (let offset = 0; offset < companies.length; offset += 4) {
          if (controller.signal.aborted) return
          details.push(...await Promise.all(companies.slice(offset, offset + 4).map((company) => getCompany(company.id, controller.signal))))
        }
        if (controller.signal.aborted) return
        const researched = details.filter((company) => company.researchRuns.length > 0)
        setCompanies(researched)
        setSelected((current) => current ? researched.find((company) => company.id === current.id) ?? null : null)
        setError('')
        if (researched.some((company) => company.researchRuns.some((run) => run.status === 'queued' || run.status === 'running'))) delay = 2500
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason))
        delay = 5000
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), delay)
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [reload])

  if (selected) return <CompanyResearch company={selected} onBack={() => setSelected(null)} />

  const removeResearch = async (company: CompanyDetail) => {
    setPendingDelete(null)
    setDeleting(company.id); setError('')
    try {
      await deleteCompanyResearch(company.id)
      setCompanies((current) => current?.filter((item) => item.id !== company.id) ?? current)
    } catch (reason) { setError(errorMessage(reason)) }
    finally { setDeleting(null) }
  }

  return (
    <div className="text-[#20242A]">
      <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-wider text-[#A44818]">Company research</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Research coverage</h1><p className="mt-3 text-sm leading-6 text-[#68645F]">Track each company’s public-source research and open the evidence behind every extracted fact.</p></div>
      <div className="mt-8">{error && <div className="mb-4 rounded-xl border border-[#E6B8AE] bg-[#FFF4F1] p-4 text-[#8A2F20]"><p>{error}</p><button className="mt-2 text-sm font-semibold underline" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}{companies ? companies.length ? <ResearchCompanyList companies={companies} deleting={deleting} onDelete={setPendingDelete} onOpen={setSelected} /> : <div className="rounded-2xl border border-dashed border-[#CEC7BD] bg-white p-10 text-center text-[#68645F]">No saved research yet. Select companies in Discover companies to begin research.</div> : !error && <div className="rounded-2xl border border-[#DED9D1] bg-white p-10 text-[#73706A]">Loading company research…</div>}</div>
      {pendingDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-[#201A16]/45 p-5 backdrop-blur-sm" onClick={() => setPendingDelete(null)}><section aria-describedby="delete-research-description" aria-labelledby="delete-research-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#E2D8D0] bg-white p-6 shadow-[0_24px_70px_rgba(45,28,18,0.28)]" onClick={(event) => event.stopPropagation()} role="alertdialog"><div className="grid size-11 place-items-center rounded-full bg-[#FBE9E5] text-xl text-[#9A3828]" aria-hidden="true">×</div><h2 className="mt-4 text-xl font-semibold text-[#292521]" id="delete-research-title">Delete research for {pendingDelete.name}?</h2><p className="mt-2 text-sm leading-6 text-[#68615B]" id="delete-research-description">This permanently removes its saved research runs, sources, evidence, assessments, and scores. The company remains available so you can research it again later.</p><div className="mt-6 flex justify-end gap-3"><button autoFocus className="rounded-lg border border-[#B8B0A8] bg-white px-4 py-2.5 text-sm font-semibold text-[#4F4943] transition hover:bg-[#F5F2EE]" onClick={() => setPendingDelete(null)}>Keep research</button><button className="rounded-lg bg-[#A33B2C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#862F23] focus:outline-none focus:ring-2 focus:ring-[#A33B2C]/30" onClick={() => void removeResearch(pendingDelete)}>Delete permanently</button></div></section></div>}

    </div>
  )
}

type DisplayStatus = 'Waiting' | 'Researching' | 'Promising' | 'Researched' | 'Sources found' | 'Not enough data' | 'Needs attention' | 'Failed'

const statusClasses: Record<DisplayStatus, string> = { Waiting: 'bg-[#EEEAE4] text-[#6F6961]', Researching: 'bg-[#FFF0E5] text-[#A94616]', Promising: 'bg-[#E4F5E9] text-[#24623F]', Researched: 'bg-[#E8F3EC] text-[#326B4B]', 'Sources found': 'bg-[#E9F1FA] text-[#315F8B]', 'Not enough data': 'bg-[#EEEAE4] text-[#6F6961]', 'Needs attention': 'bg-[#FFF4D9] text-[#8A6414]', Failed: 'bg-[#FBE9E5] text-[#9A3828]' }

const minimumSources = 2
const sourceCount = (company: CompanyDetail) => new Set(company.sources?.map((source) => source.id) ?? company.evidence.map((item) => item.sourceId)).size

function displayStatus(company: CompanyDetail): DisplayStatus {
  const run = [...company.researchRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
  if (!run || run.status === 'queued') return 'Waiting'
  if (run.status === 'running') return 'Researching'
  if (run.status === 'failed') return 'Failed'
  if (sourceCount(company) < minimumSources) return 'Not enough data'
  if (company.assessments.some((assessment) => assessment.status === 'supported')) return 'Promising'
  if (run.status === 'completed' || (run.assessmentTotal > 0 && run.assessed >= run.assessmentTotal)) return 'Researched'
  if ((company.sources?.length ?? 0) > 0) return 'Sources found'
  if (run.status === 'partial') return 'Needs attention'
  return 'Failed'
}

function researchConfidence(company: CompanyDetail) {
  if (displayStatus(company) === 'Not enough data') return { score: 0, label: 'Insufficient sources' }
  const run = [...company.researchRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
  const sourceScore = Math.min((company.sources?.length ?? 0) / 5, 1) * 35
  const assessmentScore = run?.assessmentTotal ? Math.min(run.assessed / run.assessmentTotal, 1) * 25 : 0
  const supported = company.assessments.filter((assessment) => assessment.status === 'supported')
  const strength = { strong: 1, moderate: 0.6, weak: 0.3 }
  const evidenceScore = supported.length ? supported.reduce((sum, item) => sum + strength[item.strength ?? 'weak'], 0) / supported.length * 25 : 0
  const score = Math.round(Math.min(100, sourceScore + assessmentScore + evidenceScore + company.coverage * 15))
  return { score, label: score >= 75 ? 'High' : score >= 45 ? 'Developing' : 'Early' }
}

type ResearchSortKey = 'company' | 'status' | 'confidence' | 'updated'
type SortDirection = 'asc' | 'desc'

function ResearchCompanyList({ companies, deleting, onDelete, onOpen }: { companies: CompanyDetail[]; deleting: string | null; onDelete: (company: CompanyDetail) => void; onOpen: (company: CompanyDetail) => void }) {
  const [sort, setSort] = useState<{ key: ResearchSortKey; direction: SortDirection }>({ key: 'updated', direction: 'desc' })
  const toggleSort = (key: ResearchSortKey) => setSort((current) => ({
    key,
    direction: current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : key === 'company' || key === 'status' ? 'asc' : 'desc',
  }))
  const ordered = useMemo(() => [...companies].sort((a, b) => {
    const aRun = [...a.researchRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
    const bRun = [...b.researchRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
    const comparison = sort.key === 'company' ? a.name.localeCompare(b.name)
      : sort.key === 'status' ? displayStatus(a).localeCompare(displayStatus(b))
      : sort.key === 'confidence' ? researchConfidence(a).score - researchConfidence(b).score
      : (aRun?.finishedAt ?? aRun?.startedAt ?? '').localeCompare(bRun?.finishedAt ?? bRun?.startedAt ?? '')
    return comparison * (sort.direction === 'asc' ? 1 : -1) || a.name.localeCompare(b.name)
  }), [companies, sort])
  const header = (key: ResearchSortKey, label: string) => <button type="button" aria-label={`Sort by ${label}${sort.key === key ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`} className="flex items-center gap-1 text-left font-bold uppercase tracking-wider hover:text-[#A64212]" onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{sort.key === key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>
  return <section className="overflow-hidden rounded-2xl border border-[#DCD7CF] bg-white shadow-[0_8px_28px_rgba(58,45,31,0.06)]">

    <div className="grid grid-cols-[minmax(0,1fr)_140px_130px_170px_120px] gap-5 border-b border-[#E5E0D8] bg-[#FCFBF8] px-6 py-3 text-[11px] text-[#68645F]">{header('company', 'Company')}{header('status', 'Status')}{header('confidence', 'Confidence')}{header('updated', 'Last updated')}<span className="text-right font-bold uppercase tracking-wider">Research</span></div>
    <div className="divide-y divide-[#E9E5DE]">{ordered.map((company) => { const latest = [...company.researchRuns].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]; const status = displayStatus(company); const confidence = researchConfidence(company); return <article className="grid grid-cols-[minmax(0,1fr)_140px_130px_170px_120px] items-center gap-5 px-6 py-5 transition hover:bg-[#FFF9F4]" key={company.id}><div className="min-w-0"><h2 className="truncate font-semibold text-[#25292E]">{company.name}</h2><p className="mt-1 truncate text-sm text-[#68645F]">{company.domain}</p></div><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}>{status}</span></div><div><p className="text-sm font-semibold text-[#34383D]">{status === 'Not enough data' ? '—' : `${confidence.score}%`}</p><p className="text-xs text-[#68645F]">{confidence.label}</p></div><time className="text-sm text-[#6F6A64]">{latest ? formatTime(latest.finishedAt) : 'Not started'}</time><div className="flex flex-col items-end gap-2"><button className="rounded-lg border border-[#D65A1B] bg-white px-3.5 py-2 text-xs font-semibold text-[#A64212] transition hover:bg-[#FFF1E8] focus:outline-none focus:ring-2 focus:ring-[#E86722]/30" onClick={() => onOpen(company)}>Open research</button>{company.researchRuns.length > 0 && <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5B9B0] bg-[#FFF7F5] px-3 py-1.5 text-xs font-semibold text-[#913426] transition hover:border-[#C97865] hover:bg-[#FBE9E5] disabled:opacity-50" disabled={deleting === company.id} onClick={() => onDelete(company)}><span aria-hidden="true">⌫</span>{deleting === company.id ? 'Deleting…' : 'Delete'}</button>}</div></article> })}</div>
  </section>
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const [hovered, setHovered] = useState(false)
  return <article className={`rounded-xl border p-5 transition ${hovered ? 'border-[#E86722] bg-[#FFF5ED] shadow-[0_8px_22px_rgba(190,84,28,0.10)]' : 'border-[#DED9D1] bg-white'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#B64B16]">Verified public evidence</p><p className="mt-2 text-sm font-semibold text-[#30343A]">{evidence.factualClaim}</p></div><span className="rounded-full bg-[#F1EDE7] px-2.5 py-1 text-[11px] font-semibold text-[#6F6961]">{evidence.sourceType}</span></div>
    <blockquote className={`mt-4 border-l-2 pl-4 text-sm leading-6 transition ${hovered ? 'border-[#E86722] bg-[#FFE9D8] py-2 pr-3 text-[#5B321D]' : 'border-[#D9D3CB] text-[#65615C]'}`}>“{evidence.excerpt}”</blockquote>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-[#6F6A64]">{evidence.publicationDate ?? 'Date unavailable'}</span><a className="text-xs font-semibold text-[#B44712] underline decoration-[#E6A47F] underline-offset-4 hover:text-[#7E2F0C]" href={evidence.sourceUrl} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} rel="noreferrer" target="_blank">Open original: {evidence.sourceTitle} ↗</a></div>
  </article>
}

function CompanyResearch({ company, onBack }: { company: CompanyDetail; onBack: () => void }) {
  const status = displayStatus(company)
  const confidence = researchConfidence(company)
  return <div className="text-[#20242A]"><button className="text-sm font-semibold text-[#A64212] hover:text-[#742D0D]" onClick={onBack}>← Back to company research</button>
    {status === 'Not enough data' && <div className="mt-6 rounded-xl border border-[#D9D4CC] bg-[#FAF8F5] p-5 text-sm text-[#625D57]">Research finished with {sourceCount(company)} collected source{sourceCount(company) === 1 ? '' : 's'}. At least {minimumSources} distinct sources are required to assess this company. Available findings are retained; collect more sources and rerun research to continue.</div>}
    {company.researchRuns[0]?.warning && <details className="mt-4 text-sm text-[#716C65]"><summary className="cursor-pointer">Collection and assessment notes</summary><p className="mt-2">{company.researchRuns[0].warning}</p></details>}
    <div className="mt-6 flex flex-col justify-between gap-5 border-b border-[#DDD8D0] pb-7 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-wider text-[#A44818]">Research evidence</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{company.name}</h1><p className="mt-2 text-sm text-[#716C65]">{company.domain} · {company.evidence.length} evidence item{company.evidence.length === 1 ? '' : 's'}</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="text-lg font-semibold text-[#2F5F43]">{status === 'Not enough data' ? 'Confidence unavailable' : `${confidence.score}% confidence`}</p><p className="text-xs text-[#68645F]">{confidence.label} research confidence</p></div><span className={`h-fit rounded-full px-3 py-1.5 text-sm font-semibold ${statusClasses[status]}`}>{status}</span></div></div>
    <section className="mt-7"><h2 className="text-lg font-semibold">Collected sources</h2><p className="mt-1 text-sm text-[#716C65]">Public documents remain inspectable even when signal assessment is incomplete.</p>{company.sources?.length ? <div className="mt-4 overflow-hidden rounded-xl border border-[#DED9D1] bg-white">{company.sources.map((source) => <a className="flex items-center justify-between gap-4 border-b border-[#E9E5DE] px-5 py-4 text-sm last:border-0 hover:bg-[#FFF9F4]" href={source.url} key={source.id} rel="noreferrer" target="_blank"><span className="min-w-0"><span className="block truncate font-semibold text-[#30343A]">{source.title}</span><span className="mt-1 block truncate text-xs text-[#68645F]">{source.type} · retrieved {formatTime(source.retrievedAt)}</span></span><span className="shrink-0 font-semibold text-[#B44712]">Open ↗</span></a>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#CEC7BD] bg-white p-6 text-sm text-[#68645F]">No source documents were collected. Review the run errors and retry after correcting source access.</div>}</section>
    <section className="mt-8"><h2 className="text-lg font-semibold">Extracted facts and original text</h2><p className="mt-1 text-sm text-[#716C65]">Hover a source link to highlight the exact stored excerpt. Open it to inspect the original public page.</p>{company.evidence.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{company.evidence.map((evidence) => <EvidenceItem evidence={evidence} key={evidence.id} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[#CEC7BD] bg-white p-10 text-center text-[#68645F]">No verified evidence has been extracted for this company yet.</div>}</section>
    <section className="mt-8"><h2 className="text-lg font-semibold">Signal outlook</h2><p className="mt-1 text-sm text-[#716C65]">Early and moderate signals are useful leads for validation; they do not claim confirmed buying intent.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{company.assessments.map((assessment) => { const outlook = assessment.status === 'supported' ? assessment.strength === 'strong' ? 'Strong opportunity signal' : assessment.strength === 'moderate' ? 'Promising signal' : 'Early signal' : assessment.status === 'contradicted' ? 'Counter-signal' : 'Open question'; const tone = assessment.status === 'supported' ? 'border-[#B9DDC5] bg-[#F1FAF4] text-[#285D3D]' : assessment.status === 'contradicted' ? 'border-[#E6B8AE] bg-[#FFF4F1] text-[#8A2F20]' : 'border-[#D9D4CC] bg-[#FAF8F5] text-[#625D57]'; return <article className={`rounded-xl border p-4 ${tone}`} key={assessment.id}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{assessment.question.replaceAll('-', ' ')}</h3><span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-bold">{outlook}</span></div><p className="mt-2 text-sm leading-6 opacity-80">{assessment.interpretation}</p></article> })}</div></section>
  </div>
}
