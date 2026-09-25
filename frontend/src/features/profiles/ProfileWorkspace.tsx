import { useEffect, useState } from 'react'

import { getProfile, saveProfile } from './repository'
import type { ProfileDraft, SignalDraft, SignalEffect } from './types'

function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  const classes = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300'
  return (
    <label className="block text-xs font-semibold text-slate-400">
      {label}
      {multiline ? <textarea className={`${classes} min-h-20 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} /> : <input className={classes} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  )
}

function SignalEditor({ signal, index, onChange }: { signal: SignalDraft; index: number; onChange: (signal: SignalDraft) => void }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Signal {index + 1}</p>
        <select aria-label={`Effect for signal ${index + 1}`} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200" value={signal.effect} onChange={(event) => onChange({ ...signal, effect: event.target.value as SignalEffect })}>
          <option value="positive">Positive</option><option value="penalty">Penalty</option><option value="disqualifier">Disqualifier</option>
        </select>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextField label="Question" multiline value={signal.question} onChange={(question) => onChange({ ...signal, question })} />
        <TextField label="Positive criteria" multiline value={signal.positiveCriteria} onChange={(positiveCriteria) => onChange({ ...signal, positiveCriteria })} />
        <TextField label="Exclusions" value={signal.exclusions} onChange={(exclusions) => onChange({ ...signal, exclusions })} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-400">Weight<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" min="0" type="number" value={signal.weight} onChange={(event) => onChange({ ...signal, weight: Number(event.target.value) })} /></label>
          <label className="text-xs font-semibold text-slate-400">Freshness days<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" min="1" type="number" value={signal.freshnessWindowDays} onChange={(event) => onChange({ ...signal, freshnessWindowDays: Number(event.target.value) })} /></label>
        </div>
      </div>
    </article>
  )
}

export function ProfileWorkspace() {
  const [profile, setProfile] = useState<ProfileDraft | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')

  useEffect(() => { void getProfile().then((result) => { setProfile(result); setState('ready') }).catch(() => setState('error')) }, [])
  if (state === 'loading') return <div className="rounded-2xl border border-slate-800 bg-[#0b111e] p-10 text-slate-400">Loading profile configuration…</div>
  if (state === 'error' || profile === null) return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-10 text-red-200">Profile configuration could not be loaded.</div>

  const replaceSignal = (next: SignalDraft) => setProfile({ ...profile, signals: profile.signals.map((signal) => signal.id === next.id ? next : signal) })
  const persist = async () => { setState('saving'); try { setProfile(await saveProfile(profile)); setState('saved') } catch { setState('error') } }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Configuration · Version 1</p><h1 className="mt-1 text-2xl font-semibold text-white">Service profiles</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Define ICP fit and the evidence questions used by research. Saving creates a new immutable version when the API is connected.</p></div>
        <button className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60" disabled={state === 'saving'} onClick={() => void persist()}>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save new version'}</button>
      </div>
      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100/80">Demo fixture data · Changes remain in this browser session until the profile API is connected.</div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5"><h2 className="font-semibold text-white">Profile basics</h2><div className="mt-5 space-y-4"><TextField label="Profile name" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} /><TextField label="Service description" multiline value={profile.description} onChange={(description) => setProfile({ ...profile, description })} /></div></section>
          <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5"><h2 className="font-semibold text-white">Ideal customer profile</h2><p className="mt-1 text-xs text-slate-500">Unknown facts remain visible and do not count as matches.</p><div className="mt-5 space-y-4"><TextField label="Industries" value={profile.industries} onChange={(industries) => setProfile({ ...profile, industries })} /><TextField label="Geographies" value={profile.geographies} onChange={(geographies) => setProfile({ ...profile, geographies })} /><TextField label="Company size" value={profile.companySize} onChange={(companySize) => setProfile({ ...profile, companySize })} /><TextField label="Operational complexity" value={profile.operationalComplexity} onChange={(operationalComplexity) => setProfile({ ...profile, operationalComplexity })} /></div></section>
        </div>
        <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-white">Signal questions</h2><p className="mt-1 text-sm text-slate-500">Direction, weight, freshness, criteria and exclusions remain explicit.</p></div><button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300" onClick={() => setProfile({ ...profile, signals: [...profile.signals, { id: crypto.randomUUID(), question: 'New research question', positiveCriteria: '', exclusions: '', effect: 'positive', weight: 10, freshnessWindowDays: 365 }] })}>+ Add signal</button></div>
          <div className="mt-5 space-y-4">{profile.signals.map((signal, index) => <SignalEditor index={index} key={signal.id} onChange={replaceSignal} signal={signal} />)}</div>
        </section>
      </div>
    </div>
  )
}
