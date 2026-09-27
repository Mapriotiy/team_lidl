import { useEffect, useMemo, useState } from 'react'

import { errorMessage } from '../../api/errors'
import { listCompanies } from '../../api/research'
import { getCompany } from '../companies/repository'
import type { Assessment, CompanyDetail, Evidence } from '../companies/types'

type ActivityItem = { assessment: Assessment; company: CompanyDetail; evidence?: Evidence; at: string }

const latestRunDate = (company: CompanyDetail) => [...company.researchRuns]
  .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))[0]?.finishedAt ?? ''

const signalDate = (company: CompanyDetail, evidence?: Evidence) => evidence?.publicationDate ?? latestRunDate(company)

const readableDate = (value: string) => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
}

export function SignalsWorkspace({ onBack, onOpenCompany }: { onBack: () => void; onOpenCompany: (id: string) => void }) {
  const [companies, setCompanies] = useState<CompanyDetail[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setCompanies(null); setError('')
    void listCompanies(controller.signal).then(async (rows) => {
      const details: CompanyDetail[] = []
      for (let offset = 0; offset < rows.length; offset += 4) {
        if (controller.signal.aborted) return
        details.push(...await Promise.all(rows.slice(offset, offset + 4).map((company) => getCompany(company.id, controller.signal))))
      }
      if (!controller.signal.aborted) setCompanies(details.filter((company) => company.researchRuns.length > 0))
    }).catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [revision])

  const activity = useMemo(() => (companies ?? []).flatMap((company) => company.assessments.flatMap((assessment): ActivityItem[] => {
    if (assessment.status === 'insufficient_evidence' || assessment.evidenceIds.length === 0) return []
    const evidence = assessment.evidenceIds.map((id) => company.evidence.find((item) => item.id === id)).find(Boolean)
    return [{ assessment, company, evidence, at: signalDate(company, evidence) }]
  })).sort((left, right) => right.at.localeCompare(left.at)), [companies])

  const frequency = useMemo(() => {
    const questions = new Map<string, { confirmed: number; evaluated: number }>()
    for (const company of companies ?? []) for (const assessment of company.assessments) {
      const current = questions.get(assessment.question) ?? { confirmed: 0, evaluated: 0 }
      current.evaluated += 1
      if (assessment.status === 'supported') current.confirmed += 1
      questions.set(assessment.question, current)
    }
    return [...questions.entries()].map(([question, counts]) => ({ question, ...counts })).sort((left, right) => right.confirmed - left.confirmed || left.question.localeCompare(right.question))
  }, [companies])
  const maxConfirmed = Math.max(1, ...frequency.map((item) => item.confirmed))

  return <div className="text-[var(--foreground)]">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary)]">Opportunity intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Signals</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Live buying signals from researched companies and the questions that produce them. Every activity item stays connected to its evidence.</p></div><button className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--muted)]" onClick={onBack} type="button">← Back to research</button></header>
    {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}<button className="ml-3 font-semibold underline" onClick={() => setRevision((value) => value + 1)} type="button">Retry</button></div>}
    {!companies && !error && <p className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]" role="status">Loading signals…</p>}
    {companies && <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm" aria-labelledby="recent-signals-heading"><h2 className="text-lg font-semibold" id="recent-signals-heading">Recent activity</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Verified signals from researched companies, newest evidence first.</p>{activity.length ? <div className="mt-5 divide-y divide-[var(--border)]">{activity.slice(0, 40).map(({ assessment, company, evidence, at }) => <article className="flex flex-wrap items-start justify-between gap-4 py-5 first:pt-0 last:pb-0" key={`${company.id}-${assessment.id}`}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button className="font-semibold hover:underline" onClick={() => onOpenCompany(company.id)} type="button">{company.name}</button><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${assessment.status === 'supported' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{assessment.status === 'supported' ? 'Confirmed' : 'Counter-signal'}</span><span className="text-xs capitalize text-[var(--muted-foreground)]">{assessment.strength ?? 'unknown'} evidence</span></div><p className="mt-2 text-sm font-medium leading-6">{assessment.question}</p>{evidence && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">“{evidence.excerpt}”</p>}<p className="mt-2 text-xs text-[var(--muted-foreground)]">{readableDate(at)}{evidence ? ` · ${evidence.sourceTitle}` : ''}</p></div>{evidence && <a className="shrink-0 text-xs font-semibold text-[var(--primary)] underline underline-offset-4" href={evidence.sourceUrl} rel="noreferrer" target="_blank">View evidence ↗</a>}</article>)}</div> : <p className="mt-5 rounded-xl bg-[var(--muted)] p-8 text-center text-sm text-[var(--muted-foreground)]">No verified signal activity yet.</p>}</section>
      <section className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm" aria-labelledby="signal-frequency-heading"><h2 className="text-lg font-semibold" id="signal-frequency-heading">How often each question fires</h2><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">Confirmed answers per question across every researched company.</p>{frequency.length ? <div className="mt-6 space-y-5">{frequency.map((item) => <div key={item.question}><div className="flex items-start justify-between gap-4"><span className="text-sm leading-5" title={item.question}>{item.question}</span><span className="shrink-0 text-sm font-semibold tabular-nums">{item.confirmed}<span className="text-[var(--muted-foreground)]"> / {item.evaluated}</span></span></div><div aria-label={`${item.confirmed} of ${item.evaluated} confirmed`} className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--muted)]" role="img"><span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${item.confirmed / maxConfirmed * 100}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm text-[var(--muted-foreground)]">No signal question has been evaluated yet.</p>}</section>
    </div>}
  </div>
}
