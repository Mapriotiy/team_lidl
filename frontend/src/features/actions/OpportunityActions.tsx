import { useState } from 'react'

import type { OpportunityStatus } from '../opportunities/types'

export function OpportunityActions() {
  const [status, setStatus] = useState<OpportunityStatus>('new')
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
      <h2 className="font-semibold text-white">Sales actions</h2>
      <p className="mt-1 text-xs text-slate-500">Local demo state until the opportunity update endpoint is connected.</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button aria-pressed={status === 'shortlisted'} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${status === 'shortlisted' ? 'bg-violet-300 text-slate-950' : 'border border-slate-700 text-slate-300'}`} onClick={() => setStatus('shortlisted')}>Shortlist</button>
        <button aria-pressed={status === 'dismissed'} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${status === 'dismissed' ? 'bg-slate-300 text-slate-950' : 'border border-slate-700 text-slate-300'}`} onClick={() => setStatus('dismissed')}>Dismiss</button>
      </div>
      <label className="mt-5 block text-xs font-semibold text-slate-400">Account note<textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-cyan-300" onChange={(event) => setNote(event.target.value)} placeholder="Add context for the next conversation…" value={note} /></label>
      <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2.5 text-sm font-bold text-slate-950" onClick={() => setSavedNote(note)}>Save note</button>
      {savedNote && <p className="mt-3 text-xs text-emerald-300">Note saved in this session.</p>}
    </section>
  )
}
