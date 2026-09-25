import { useEffect, useState } from 'react'

import { errorMessage } from '../../api/errors'
import { listProfiles, type Profile } from '../../api/profiles'
import { getResearchRun, submitResearch, type ResearchRun } from '../../api/research'
import type { ConfirmedCompany } from '../discovery/DiscoveryWorkspace'

const terminal = new Set(['completed', 'partial', 'failed'])

function Stage({ run, name }: { run: ResearchRun; name: string }) {
  const progress = run.progress.find((item) => item.stage === name)
  return <div className="rounded-xl bg-slate-900 p-3"><p className="text-xs font-semibold capitalize text-slate-300">{name}</p><p className="mt-1 text-sm text-white">{progress ? `${progress.completed}${progress.total > 0 ? ` / ${progress.total}` : ''}` : 'Waiting'}</p></div>
}

export function ResearchLauncher({ companies }: { companies: ConfirmedCompany[] }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileVersionId, setProfileVersionId] = useState('')
  const [runs, setRuns] = useState<ResearchRun[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { const controller = new AbortController(); void listProfiles(controller.signal).then((items) => { setProfiles(items); setProfileVersionId((current) => current || items[0]?.current_version.id || '') }).catch((error) => setMessage(errorMessage(error))); return () => controller.abort() }, [])
  useEffect(() => {
    const active = runs.filter((run) => !terminal.has(run.status))
    if (!active.length) return
    const timer = window.setInterval(() => { void Promise.all(active.map((run) => getResearchRun(run.id))).then((updates) => setRuns((current) => current.map((run) => updates.find((update) => update.id === run.id) ?? run))).catch((error) => setMessage(errorMessage(error))) }, 2000)
    return () => window.clearInterval(timer)
  }, [runs])

  const start = async () => {
    if (!companies.length || !profileVersionId) return
    setSubmitting(true); setMessage('')
    try {
      const batchKey = crypto.randomUUID()
      const created = await Promise.all(companies.map((company) => submitResearch(company.id, profileVersionId, `${batchKey}-${company.id}`)))
      setRuns(created)
    } catch (error) { setMessage(errorMessage(error)) } finally { setSubmitting(false) }
  }

  if (!companies.length) return null
  return <section className="mt-7 rounded-2xl border border-violet-300/20 bg-violet-300/5 p-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h2 className="font-semibold text-white">Start confirmed research</h2><p className="mt-1 text-xs text-slate-400">{companies.length} confirmed compan{companies.length === 1 ? 'y' : 'ies'} · worker progress is shown exactly as reported</p></div><div className="flex flex-wrap gap-3"><label className="text-xs font-semibold text-slate-400">Service profile<select aria-label="Research service profile" className="mt-2 block rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" value={profileVersionId} onChange={(event) => setProfileVersionId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.current_version.id}>{profile.name} · v{profile.current_version.version}</option>)}</select></label><button className="self-end rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40" disabled={!profileVersionId || submitting} onClick={() => void start()}>{submitting ? 'Submitting…' : 'Start research'}</button></div></div>
    {message && <p className="mt-4 text-sm text-amber-200" role="status">{message}</p>}
    {runs.length > 0 && <div className="mt-5 space-y-3">{runs.map((run) => { const company = companies.find((item) => item.id === run.company_id); return <article className="rounded-xl border border-slate-800 bg-[#0b111e] p-4" key={run.id}><div className="flex items-center justify-between"><div><p className="font-semibold text-white">{company?.name ?? run.company_id}</p><p className="text-xs text-slate-500">{run.id}</p></div><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold uppercase text-cyan-200">{run.status}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><Stage name="collection" run={run} /><Stage name="assessment" run={run} /></div>{run.partial_errors.length > 0 && <div className="mt-3 rounded-lg bg-amber-300/5 p-3 text-xs text-amber-100">{run.partial_errors.map((error) => <p key={`${error.stage}-${error.code}`}>{error.stage}: {error.message}</p>)}</div>}</article> })}</div>}
  </section>
}
