import { useState } from 'react'

import { errorMessage } from '../../api/errors'
import { generateOutreachDrafts, type DraftChannel, type OutreachDraftBundle } from '../../api/outreach'
import { gmailComposeUrl, isEmailAddress } from './gmail'

const options: Array<{ id: DraftChannel; label: string }> = [
  { id: 'email', label: 'Email' },
  { id: 'linkedin_inmail', label: 'LinkedIn InMail' },
  { id: 'connection_note', label: 'Connection note' },
  { id: 'call_brief', label: 'Call brief' },
]
const labels = Object.fromEntries(options.map((item) => [item.id, item.label])) as Record<DraftChannel, string>

export function OutreachDrafts({ companyId }: { companyId: string }) {
  const [recipientRole, setRecipientRole] = useState('Operations leader')
  const [channels, setChannels] = useState<DraftChannel[]>(['email', 'linkedin_inmail'])
  const [bundle, setBundle] = useState<OutreachDraftBundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const generate = async () => {
    setBusy(true); setError('')
    try { setBundle(await generateOutreachDrafts(companyId, recipientRole, channels)) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  const toggle = (channel: DraftChannel) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel])
  return <section className="mt-8 border-t border-[#DDD8D0] pt-8">
    <div className="rounded-2xl border border-[#CFC7BC] bg-[#FCFBF8] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Personalized outreach drafts</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#68645F]">Create editable channel drafts using only the verified signals and sources in this research.</p></div><button className="rounded-lg bg-[#C94F12] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45" disabled={busy || !channels.length || !recipientRole.trim()} onClick={() => void generate()}>{busy ? 'Generating…' : bundle ? 'Regenerate drafts' : 'Generate drafts'}</button></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_2fr]"><label className="text-sm font-semibold">Recipient role<input className="mt-2 w-full rounded-lg border border-[#A79F95] bg-white px-3 py-2.5 font-normal" value={recipientRole} onChange={(event) => setRecipientRole(event.target.value)} /></label><fieldset><legend className="text-sm font-semibold">Channels</legend><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${channels.includes(option.id) ? 'border-[#C94F12] bg-[#FFF0E5] text-[#923A10]' : 'border-[#CFC7BC] bg-white text-[#625D57]'}`} key={option.id}><input className="sr-only" type="checkbox" checked={channels.includes(option.id)} onChange={() => toggle(option.id)} />{option.label}</label>)}</div></fieldset></div>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {bundle && <div className="mt-6 space-y-5"><p className="rounded-lg bg-[#FFF4D9] p-3 text-xs leading-5 text-[#70520F]">{bundle.disclaimer}</p>{bundle.drafts.some((draft) => draft.channel === 'email') && <div className="rounded-xl border border-[#D8D0C6] bg-[#F3F0EB] p-4"><h3 className="font-semibold">Gmail recipient and signature</h3><p className="mt-1 text-xs text-[#68645F]">These details stay in your browser and are added when Gmail opens.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Recipient email<input type="email" placeholder="name@company.com" className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} /></label><label className="text-xs font-semibold">Recipient name <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></label><label className="text-xs font-semibold">Your name <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={senderName} onChange={(event) => setSenderName(event.target.value)} /></label><label className="text-xs font-semibold">Your title <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={senderTitle} onChange={(event) => setSenderTitle(event.target.value)} /></label></div>{recipientEmail && !isEmailAddress(recipientEmail) && <p className="mt-2 text-xs font-semibold text-red-700">Enter a valid recipient email.</p>}</div>}{bundle.drafts.map((draft, index) => <article className="rounded-xl border border-[#D8D0C6] bg-white p-4" key={draft.channel}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{labels[draft.channel]}</h3><div className="flex items-center gap-3">{draft.channel === 'email' && <button className="rounded-lg bg-[#C94F12] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!isEmailAddress(recipientEmail)} title={isEmailAddress(recipientEmail) ? 'Open this addressed draft in Gmail' : 'Enter a valid recipient email first'} onClick={() => window.open(gmailComposeUrl(draft, { recipientEmail, recipientName, senderName, senderTitle }), '_blank', 'noopener,noreferrer')}>Open in Gmail</button>}<button className="text-xs font-semibold text-[#A64212] underline" onClick={() => void navigator.clipboard.writeText([draft.subject, draft.body].filter(Boolean).join('\n\n'))}>Copy</button></div></div>{draft.subject !== null && <input aria-label={`${labels[draft.channel]} subject`} className="mt-3 w-full rounded-lg border border-[#CFC7BC] px-3 py-2 text-sm font-semibold" value={draft.subject} onChange={(event) => setBundle({ ...bundle, drafts: bundle.drafts.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item) })} />}<textarea aria-label={`${labels[draft.channel]} body`} className="mt-3 min-h-36 w-full resize-y rounded-lg border border-[#CFC7BC] px-3 py-3 text-sm leading-6" value={draft.body} onChange={(event) => setBundle({ ...bundle, drafts: bundle.drafts.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /><details className="mt-3 text-xs text-[#68645F]"><summary className="cursor-pointer font-semibold">Evidence used ({draft.evidence_ids.length})</summary><ul className="mt-2 space-y-2">{bundle.evidence.filter((item) => draft.evidence_ids.includes(item.id)).map((item) => <li key={item.id}><a className="text-[#A64212] underline" href={item.source_url} target="_blank" rel="noreferrer">{item.factual_claim} ↗</a></li>)}</ul></details></article>)}</div>}
    </div>
  </section>
}
