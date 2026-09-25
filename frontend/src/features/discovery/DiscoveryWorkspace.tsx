import { useState } from 'react'

import { confirmDiscoveryRun, createDiscoveryRun, type DiscoveryCandidate } from '../../api/discovery'
import { errorMessage } from '../../api/errors'
import { importCompanies } from '../../api/research'

const defaultCountries = 'PL, CZ, SK, HU, RO, BG, MD, UA, EE, LV, LT'

export interface ConfirmedCompany { id: string; name: string; domain: string }

export function DiscoveryWorkspace({ onConfirmed }: { onConfirmed: (companies: ConfirmedCompany[]) => void }) {
  const [countries, setCountries] = useState(defaultCountries)
  const [industry, setIndustry] = useState('')
  const [minimumEmployees, setMinimumEmployees] = useState(1000)
  const [limit, setLimit] = useState(25)
  const [directDomains, setDirectDomains] = useState('')
  const [runId, setRunId] = useState('')
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [state, setState] = useState<'ready' | 'loading' | 'confirming'>('ready')
  const [message, setMessage] = useState('')

  const discover = async () => {
    setState('loading'); setMessage('')
    try {
      const run = await createDiscoveryRun({ country_codes: countries.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean), minimum_employees: minimumEmployees, include_unknown_size: true, industry: industry.trim() || null, limit })
      setRunId(run.id); setCandidates(run.candidates); setSelected([])
      if (!run.candidates.length) setMessage('No candidates matched these discovery settings.')
    } catch (error) { setMessage(errorMessage(error)) } finally { setState('ready') }
  }

  const importDirectly = async () => {
    const domains = directDomains.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 10)
    if (!domains.length) return setMessage('Enter at least one company domain.')
    setState('loading'); setMessage('')
    try {
      const result = await importCompanies(domains)
      const companies = result.accepted.map(({ company }) => ({ id: company.id, name: company.display_name, domain: company.canonical_domain }))
      if (companies.length) onConfirmed(companies)
      setMessage(`${companies.length} company${companies.length === 1 ? '' : 'ies'} imported.${result.rejected.length ? ` ${result.rejected.length} rejected.` : ''}`)
    } catch (error) { setMessage(errorMessage(error)) } finally { setState('ready') }
  }

  const confirm = async () => {
    setState('confirming'); setMessage('')
    try {
      const result = await confirmDiscoveryRun(runId, selected)
      const byDomain = new Map(candidates.map((item) => [item.domain, item]))
      onConfirmed(result.company_ids.map((id, index) => ({ id, name: byDomain.get(selected[index])?.name ?? selected[index], domain: selected[index] })))
      setMessage(`${result.company_ids.length} selected companies confirmed for research.`)
    } catch (error) { setMessage(errorMessage(error)) } finally { setState('ready') }
  }

  const toggle = (domain: string) => setSelected((current) => current.includes(domain) ? current.filter((item) => item !== domain) : current.length < 10 ? [...current, domain] : current)

  return <div>
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Company sourcing</p>
    <h1 className="mt-1 text-2xl font-semibold text-white">Discover or import companies</h1>
    <p className="mt-2 text-sm text-slate-500">Eastern Europe is the default, but any ISO country codes can be used. Companies with unknown size remain visible with lower confidence.</p>
    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
        <h2 className="font-semibold text-white">Discovery settings</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-400 sm:col-span-2">Country codes<input aria-label="Country codes" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white" value={countries} onChange={(event) => setCountries(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-400">Industry<input aria-label="Industry" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white" placeholder="Optional" value={industry} onChange={(event) => setIndustry(event.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-400">Minimum employees<input aria-label="Minimum employees" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white" min="1" type="number" value={minimumEmployees} onChange={(event) => setMinimumEmployees(Number(event.target.value))} /></label>
          <label className="text-xs font-semibold text-slate-400">Result limit<input aria-label="Result limit" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white" max="50" min="1" type="number" value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label>
        </div>
        <button className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50" disabled={state !== 'ready'} onClick={() => void discover()}>{state === 'loading' ? 'Searching…' : 'Find companies'}</button>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
        <h2 className="font-semibold text-white">Direct domain import</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">One domain per line, up to 10. Import validates the domain; research validates the company evidence.</p>
        <textarea aria-label="Company domains" className="mt-4 min-h-32 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white" placeholder={'example.com\ncompany.ro'} value={directDomains} onChange={(event) => setDirectDomains(event.target.value)} />
        <button className="mt-3 rounded-xl border border-cyan-300/50 px-4 py-2.5 text-sm font-semibold text-cyan-200 disabled:opacity-50" disabled={state !== 'ready'} onClick={() => void importDirectly()}>Import domains</button>
      </section>
    </div>
    {message && <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300" role="status">{message}</p>}
    {candidates.length > 0 && <section className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-[#0b111e]">
      <div className="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 className="font-semibold text-white">Review candidates</h2><p className="mt-1 text-xs text-slate-500">{selected.length}/10 selected · confirmation is required before research</p></div><button className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40" disabled={!selected.length || state !== 'ready'} onClick={() => void confirm()}>{state === 'confirming' ? 'Confirming…' : 'Confirm selection'}</button></div>
      <div className="divide-y divide-slate-800">{candidates.map((candidate) => <label className="grid cursor-pointer gap-3 p-5 hover:bg-slate-900/60 sm:grid-cols-[24px_minmax(180px,1fr)_1fr_1fr]" key={candidate.domain}><input aria-label={`Select ${candidate.name}`} checked={selected.includes(candidate.domain)} disabled={!selected.includes(candidate.domain) && selected.length >= 10} type="checkbox" onChange={() => toggle(candidate.domain)} /><div><p className="font-semibold text-white">{candidate.name}</p><p className="text-xs text-slate-500">{candidate.domain}</p></div><div className="text-sm text-slate-300">{candidate.country_name}<p className="text-xs text-slate-500">{candidate.industry ?? 'Industry unknown'}</p></div><div><p className={candidate.size_verification === 'verified' ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>{candidate.employee_count?.toLocaleString() ?? 'Unknown'} employees · {candidate.size_verification.replace('_', ' ')}</p><a className="text-xs text-cyan-300" href={candidate.source_url} rel="noreferrer" target="_blank">Source ↗</a><p className="text-xs text-slate-500">{Math.round(candidate.discovery_confidence * 100)}% discovery confidence</p></div></label>)}</div>
    </section>}
  </div>
}
