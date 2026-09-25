import { useEffect, useState } from 'react'

import { getCompany } from '../companies/repository'
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
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold capitalize text-slate-200">{run.status} run</p><time className="text-xs text-slate-500">{formatTime(run.finishedAt)}</time></div>
            <p className="mt-1 text-xs text-slate-500">{run.collected} sources collected · {run.assessed} questions assessed</p>
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
  useEffect(() => { void getCompany('company-lufthansa').then((company) => setRuns(company.researchRuns)).catch(() => setError('Research activity could not be loaded.')) }, [])
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Background research</p>
      <h1 className="mt-1 text-2xl font-semibold text-white">Research activity</h1>
      <p className="mt-2 text-sm text-slate-500">Collection and assessment progress are reported separately; partial results remain available.</p>
      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100/80">Demo fixture data · Statuses are illustrative and never simulated as live progress.</div>
      <div className="mt-7 max-w-2xl">{error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8 text-red-200">{error}</div> : runs ? <ResearchActivity runs={runs} /> : <div className="rounded-2xl border border-slate-800 bg-[#0b111e] p-8 text-slate-400">Loading research history…</div>}</div>
    </div>
  )
}
