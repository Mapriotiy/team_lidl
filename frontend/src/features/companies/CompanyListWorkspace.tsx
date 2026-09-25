import { useEffect, useState } from 'react'

import { errorMessage } from '../../api/errors'
import { listCompanies, type CompanySummary } from '../../api/research'

function factValue(fact: CompanySummary['industry']) {
  if (!fact || fact.is_unknown || fact.value === null) return 'Needs verification'
  if (typeof fact.value === 'number') return fact.value.toLocaleString()
  return String(fact.value)
}

export function CompanyListWorkspace({ onOpen }: { onOpen: (companyId: string) => void }) {
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState('loading'); setMessage('')
    void listCompanies(controller.signal).then((items) => { setCompanies(items); setState('ready') }).catch((error) => { if (!controller.signal.aborted) { setMessage(errorMessage(error)); setState('error') } })
    return () => controller.abort()
  }, [reload])

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Imported records</p><h1 className="mt-1 text-2xl font-semibold text-white">Companies</h1><p className="mt-2 text-sm text-slate-500">Companies appear here immediately after discovery confirmation or domain import. AI assessment is not required.</p></div><p className="text-sm text-slate-400">{companies.length} compan{companies.length === 1 ? 'y' : 'ies'}</p></div>
    {state === 'loading' && <div className="mt-7 rounded-2xl border border-slate-800 bg-[#0b111e] p-10 text-slate-400">Loading imported companies…</div>}
    {state === 'error' && <div className="mt-7 rounded-2xl border border-red-400/20 bg-red-400/5 p-8 text-red-200"><p>{message}</p><button className="mt-4 rounded-xl border border-red-300/40 px-4 py-2 text-sm font-semibold" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
    {state === 'ready' && companies.length === 0 && <div className="mt-7 rounded-2xl border border-dashed border-slate-700 p-12 text-center"><h2 className="font-semibold text-white">No companies imported yet</h2><p className="mt-2 text-sm text-slate-500">Use Discover companies or Import companies. Confirmed records will appear here even if research later fails.</p></div>}
    {state === 'ready' && companies.length > 0 && <div className="mt-7 grid gap-4 lg:grid-cols-2">{companies.map((company) => <article className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5" key={company.id}><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-white">{company.display_name}</h2><p className="mt-1 text-sm text-cyan-300">{company.canonical_domain}</p></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300" onClick={() => onOpen(company.id)}>View record</button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Geography</dt><dd className="mt-1 text-slate-300">{factValue(company.geography)}</dd></div><div><dt className="text-xs text-slate-500">Industry</dt><dd className="mt-1 text-slate-300">{factValue(company.industry)}</dd></div><div><dt className="text-xs text-slate-500">Company size</dt><dd className="mt-1 text-slate-300">{factValue(company.company_size)}</dd></div><div><dt className="text-xs text-slate-500">Aliases</dt><dd className="mt-1 text-slate-300">{company.aliases.join(', ') || 'None recorded'}</dd></div></dl></article>)}</div>}
  </div>
}
