import { useEffect, useState } from 'react'

import { getCompanyResult } from '../../api/companies'
import { errorMessage } from '../../api/errors'
import { listCompanies } from '../../api/research'
import type { ResearchRun } from '../companies/types'

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
  const [runs, setRuns] = useState<ResearchRun[] | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setRuns(null); setError('')
    void listCompanies(controller.signal).then(async (companies) => {
      const details = await Promise.all(companies.map((company) => getCompanyResult(company.id, controller.signal)))
      const history = details.flatMap((company) => company.research_history.map((run) => {
        const collection = run.progress.find((item) => item.stage === 'collection')
        const assessment = run.progress.find((item) => item.stage === 'assessment')
        return { id: run.id, status: run.status as ResearchRun['status'], startedAt: run.started_at ?? run.queued_at, finishedAt: run.finished_at ?? run.queued_at, collected: Number(collection?.completed ?? 0), collectionTotal: Number(collection?.total ?? 0), assessed: Number(assessment?.completed ?? 0), assessmentTotal: Number(assessment?.total ?? 0), warning: run.partial_errors.map((item) => String(item.message ?? item.code ?? 'Partial failure')).join(' · ') || null, model: typeof run.usage.model === 'string' ? run.usage.model : undefined, totalTokens: Number(run.usage.total_tokens ?? 0), costUsd: typeof run.usage.cost_usd === 'number' ? run.usage.cost_usd : null, companyName: company.display_name }
      })).sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      setRuns(history)
    }).catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [reload])
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Background research</p>
      <h1 className="mt-1 text-2xl font-semibold text-white">Research activity</h1>
      <p className="mt-2 text-sm text-slate-500">Collection and assessment progress are reported separately; partial results remain available.</p>
      <div className="mt-7 max-w-2xl">{error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8 text-red-200"><p>{error}</p><button className="mt-4 rounded-xl border border-red-300/40 px-4 py-2 text-sm font-semibold" onClick={() => setReload((value) => value + 1)}>Retry</button></div> : runs ? runs.length ? <ResearchActivity runs={runs} /> : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-slate-400">No research runs yet. Confirm a company and start research first.</div> : <div className="rounded-2xl border border-slate-800 bg-[#0b111e] p-8 text-slate-400">Loading research history…</div>}</div>
    </div>
  )
}
