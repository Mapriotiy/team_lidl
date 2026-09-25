import { useState } from 'react'

import type { OpportunityStatus } from '../opportunities/types'
import { updateOpportunity } from '../../api/actions'
import { errorMessage } from '../../api/errors'

export function OpportunityActions({ opportunityId, initialStatus = 'new', initialNote = '' }: { opportunityId?: string; initialStatus?: OpportunityStatus; initialNote?: string }) {
  const [status, setStatus] = useState<OpportunityStatus>(initialStatus)
  const [note, setNote] = useState(initialNote)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const persist = async (patch: { status?: OpportunityStatus; note?: string | null }) => {
    if (!opportunityId) return setMessage('Open this company from an opportunity to update sales status.')
    setSaving(true); setMessage('')
    try { const updated = await updateOpportunity(opportunityId, patch); setStatus(updated.status); setNote(updated.note ?? ''); setMessage('Saved and persisted.') } catch (error) { setMessage(errorMessage(error)) } finally { setSaving(false) }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b111e] p-5">
      <h2 className="font-semibold text-white">Sales actions</h2>
      <p className="mt-1 text-xs text-slate-500">Status and notes are saved to the opportunity record.</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button aria-pressed={status === 'shortlisted'} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${status === 'shortlisted' ? 'bg-violet-300 text-slate-950' : 'border border-slate-700 text-slate-300'}`} disabled={saving} onClick={() => void persist({ status: status === 'shortlisted' ? 'new' : 'shortlisted' })}>{status === 'shortlisted' ? 'Restore' : 'Shortlist'}</button>
        <button aria-pressed={status === 'dismissed'} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${status === 'dismissed' ? 'bg-slate-300 text-slate-950' : 'border border-slate-700 text-slate-300'}`} disabled={saving} onClick={() => void persist({ status: status === 'dismissed' ? 'new' : 'dismissed' })}>{status === 'dismissed' ? 'Restore' : 'Dismiss'}</button>
      </div>
      <label className="mt-5 block text-xs font-semibold text-slate-400">Account note<textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-cyan-300" onChange={(event) => setNote(event.target.value)} placeholder="Add context for the next conversation…" value={note} /></label>
      <button className="mt-3 w-full rounded-xl bg-cyan-300 px-3 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50" disabled={saving} onClick={() => void persist({ note })}>{saving ? 'Saving…' : 'Save note'}</button>
      {message && <p className="mt-3 text-xs text-emerald-300" role="status">{message}</p>}
    </section>
  )
}
