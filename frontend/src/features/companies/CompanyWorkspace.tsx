import { useEffect, useMemo, useState } from 'react'

import { OpportunityActions } from '../actions/OpportunityActions'
import { ResearchActivity } from '../activity/ResearchActivity'
import { getCompany } from './repository'
import type { Assessment, CompanyDetail, Evidence } from './types'

const statusStyle = { supported: 'bg-emerald-300/10 text-emerald-300', contradicted: 'bg-red-300/10 text-red-300', insufficient_evidence: 'bg-slate-700 text-slate-300' }

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">Observed fact · {evidence.sourceType}</span><span className="text-xs text-slate-500">{evidence.publicationDate ?? 'Date unknown'}</span></div>
      <blockquote className="mt-4 border-l-2 border-cyan-300 pl-4 text-sm leading-6 text-slate-200">“{evidence.excerpt}”</blockquote>
      <p className="mt-3 text-xs leading-5 text-slate-500"><strong className="text-slate-400">Factual claim:</strong> {evidence.factualClaim}</p>
      <a className="mt-3 inline-flex text-xs font-semibold text-cyan-300 hover:text-cyan-200" href={evidence.sourceUrl} rel="noreferrer" target="_blank">Open source: {evidence.sourceTitle} ↗</a>
    </article>
  )
}

function AssessmentCard({ assessment, evidenceById }: { assessment: Assessment; evidenceById: Map<string, Evidence> }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="max-w-2xl font-semibold text-white">{assessment.question}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyle[assessment.status]}`}>{assessment.status.replace('_', ' ')}</span></div>
      <div className="mt-4 rounded-xl bg-violet-300/5 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-300">Sales interpretation</p><p className="mt-1 text-sm leading-6 text-slate-300">{assessment.interpretation}</p></div>
      {assessment.strength && <p className="mt-3 text-xs text-slate-500">Evidence strength: <span className="font-semibold capitalize text-slate-300">{assessment.strength}</span></p>}
      {assessment.evidenceIds.length > 0 && <div className="mt-4 space-y-3">{assessment.evidenceIds.map((id) => { const evidence = evidenceById.get(id); return evidence ? <EvidenceCard evidence={evidence} key={id} /> : null })}</div>}
      {assessment.evidenceIds.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">Unknown: no verified source supports or contradicts this question.</p>}
    </article>
  )
}

export function CompanyWorkspace({ companyId = 'company-lufthansa' }: { companyId?: string }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void getCompany(companyId).then(setCompany).catch(() => setError('Company workspace could not be loaded.')) }, [companyId])
  const evidenceById = useMemo(() => new Map(company?.evidence.map((item) => [item.id, item]) ?? []), [company])
  if (error) return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-10 text-red-200">{error}</div>
  if (!company) return <div className="rounded-2xl border border-slate-800 bg-[#0b111e] p-10 text-slate-400">Loading company evidence…</div>

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Company workspace · {company.profileName}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">{company.name}</h1><p className="mt-2 text-sm text-slate-500">{company.domain} · Also known as {company.aliases.join(', ')}</p></div>
        <div className="flex items-center gap-5 rounded-2xl border border-slate-800 bg-[#0b111e] px-5 py-4"><div><p className="text-xs text-slate-500">Priority score</p><p className="text-3xl font-semibold text-emerald-300">{company.score}</p></div><div className="h-10 w-px bg-slate-800" /><div><p className="text-xs text-slate-500">Coverage</p><p className="mt-1 font-semibold text-white">{Math.round(company.coverage * 100)}%</p></div><div><p className="text-xs text-slate-500">Eligibility</p><p className="mt-1 font-semibold text-white">{company.eligibility}</p></div></div>
      </div>
      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100/80">Demo fixture data · Illustrative findings are not a confirmed sales opportunity.</div>
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{company.facts.map((fact) => <article className="rounded-xl border border-slate-800 bg-[#0b111e] p-4" key={fact.label}><p className="text-xs text-slate-500">{fact.label}</p><p className={`mt-2 text-sm font-semibold ${fact.state === 'unknown' ? 'text-amber-300' : 'text-white'}`}>{fact.value ?? 'Unknown'}</p><p className="mt-1 text-[11px] text-slate-600">{fact.sourceIds.length ? `${fact.sourceIds.length} source reference` : 'No verified source'}</p></article>)}</section>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div><div className="mb-4"><h2 className="text-lg font-semibold text-white">Signal assessments</h2><p className="mt-1 text-sm text-slate-500">Observed facts, interpretations and unknowns are deliberately separated.</p></div><div className="space-y-4">{company.assessments.map((assessment) => <AssessmentCard assessment={assessment} evidenceById={evidenceById} key={assessment.id} />)}</div></div>
        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5"><h2 className="font-semibold text-white">Score breakdown</h2><div className="mt-4 space-y-4">{company.contributions.map((item) => <div key={item.signal}><div className="flex justify-between gap-3 text-sm"><span className="text-slate-300">{item.signal}</span><span className={`font-semibold ${item.points > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{item.points > 0 ? '+' : ''}{item.points}</span></div><p className="mt-1 text-[11px] text-slate-600">{item.effect} · {item.evidenceIds.length} evidence item</p></div>)}</div><p className="mt-5 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">Scores prioritize accounts within this profile version. They are not purchase probabilities.</p></section>
          <OpportunityActions />
          <ResearchActivity runs={company.researchRuns} />
        </aside>
      </div>
    </div>
  )
}
