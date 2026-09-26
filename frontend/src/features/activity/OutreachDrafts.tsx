import { useState } from 'react'

import { errorMessage } from '../../api/errors'
import { discoverOutreachContact, generateOutreachDrafts, type DraftChannel, type OutreachContact, type OutreachDraftBundle } from '../../api/outreach'
import { gmailComposeUrl, isEmailAddress } from './gmail'

const options: Array<{ id: DraftChannel; label: string }> = [
  { id: 'email', label: 'Email' },
  { id: 'linkedin_inmail', label: 'LinkedIn InMail' },
  { id: 'connection_note', label: 'Connection note' },
  { id: 'call_brief', label: 'Call brief' },
]
const labels = Object.fromEntries(options.map((item) => [item.id, item.label])) as Record<DraftChannel, string>

function GmailIcon({ className = 'size-5' }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M3 6.4v11.1c0 .83.67 1.5 1.5 1.5H7V9.62L3 6.4Z"/><path fill="#34A853" d="M17 9.62V19h2.5c.83 0 1.5-.67 1.5-1.5V6.4l-4 3.22Z"/><path fill="#EA4335" d="M19.8 4.3a1.9 1.9 0 0 0-2.05.2L12 9.1 6.25 4.5A1.9 1.9 0 0 0 3 6v.4l9 7.2 9-7.2V6c0-.73-.42-1.38-1.2-1.7Z"/><path fill="#FBBC04" d="M3 6.4V7l4 3.2v-.58L3 6.4Zm18 0L17 9.62v.58L21 7v-.6Z"/></svg>
}

export function OutreachDrafts({ companyId }: { companyId: string }) {
  const [recipientRole, setRecipientRole] = useState('Operations leader')
  const [channels, setChannels] = useState<DraftChannel[]>(['email'])
  const [bundle, setBundle] = useState<OutreachDraftBundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [contact, setContact] = useState<OutreachContact | null>(null)
  const emailDraft = bundle?.drafts.find((draft) => draft.channel === 'email')
  const generate = async () => {
    setBusy(true); setError('')
    try {
      const drafts = await generateOutreachDrafts(companyId, recipientRole, channels)
      const foundContact = await discoverOutreachContact(companyId).catch(() => null)
      setBundle(drafts); setContact(foundContact)
      if (foundContact) {
        setRecipientEmail(foundContact.email)
        setRecipientName(foundContact.name ?? '')
        if (foundContact.role) setRecipientRole(foundContact.role)
      }
    }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  const toggle = (channel: DraftChannel) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel])
  return <section className="mt-6">
    <div className="rounded-2xl border border-[#CFC7BC] bg-[#FCFBF8] p-5 shadow-[0_10px_35px_rgba(60,45,30,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#A44818]">Next action</p><h2 className="mt-1 text-lg font-semibold">Contact this company</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#68645F]">Turn verified research into a personalized, editable letter.</p></div><button className="inline-flex items-center gap-2 rounded-xl border border-[#D6D0C8] bg-white px-4 py-3 text-sm font-semibold text-[#34373C] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-45" disabled={busy || (bundle ? !emailDraft || !isEmailAddress(recipientEmail) : !channels.length || !recipientRole.trim())} onClick={() => emailDraft ? window.open(gmailComposeUrl(emailDraft, { recipientEmail, recipientName, senderName, senderTitle }), '_blank', 'noopener,noreferrer') : void generate()}><GmailIcon />{busy ? 'Writing email…' : bundle ? 'Open draft in Gmail' : 'Generate Gmail draft'}</button></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_2fr]"><label className="text-sm font-semibold">Recipient role<input className="mt-2 w-full rounded-lg border border-[#A79F95] bg-white px-3 py-2.5 font-normal" value={recipientRole} onChange={(event) => setRecipientRole(event.target.value)} /></label><fieldset><legend className="text-sm font-semibold">Channels</legend><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${channels.includes(option.id) ? 'border-[#C94F12] bg-[#FFF0E5] text-[#923A10]' : 'border-[#CFC7BC] bg-white text-[#625D57]'}`} key={option.id}><input className="sr-only" type="checkbox" checked={channels.includes(option.id)} onChange={() => toggle(option.id)} />{option.label}</label>)}</div></fieldset></div>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {bundle && <div className="mt-6 space-y-5"><p className="rounded-lg bg-[#FFF4D9] p-3 text-xs leading-5 text-[#70520F]">{bundle.disclaimer}</p>{bundle.drafts.some((draft) => draft.channel === 'email') && <div className="rounded-xl border border-[#D8D0C6] bg-[#F3F0EB] p-4"><h3 className="font-semibold">Gmail recipient and signature</h3><p className="mt-1 text-xs text-[#68645F]">{contact ? <>Public contact found with {Math.round(contact.confidence * 100)}% confidence · <a className="text-[#A64212] underline" href={contact.source_url} target="_blank" rel="noreferrer">verify source ↗</a></> : 'No verified public email was found. Enter one manually; addresses are never guessed.'}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Recipient email<input type="email" placeholder="name@company.com" className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} /></label><label className="text-xs font-semibold">Recipient name <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></label><label className="text-xs font-semibold">Your name <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={senderName} onChange={(event) => setSenderName(event.target.value)} /></label><label className="text-xs font-semibold">Your title <span className="font-normal text-[#77716A]">(optional)</span><input className="mt-1 w-full rounded-lg border border-[#BDB5AA] bg-white px-3 py-2 text-sm font-normal" value={senderTitle} onChange={(event) => setSenderTitle(event.target.value)} /></label></div>{recipientEmail && !isEmailAddress(recipientEmail) && <p className="mt-2 text-xs font-semibold text-red-700">Enter a valid recipient email.</p>}</div>}{bundle.drafts.map((draft, index) => <article className="rounded-xl border border-[#D8D0C6] bg-white p-4" key={draft.channel}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{labels[draft.channel]}</h3><div className="flex items-center gap-3">{draft.channel === 'email' && <button className="rounded-lg bg-[#C94F12] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={!isEmailAddress(recipientEmail)} title={isEmailAddress(recipientEmail) ? 'Open this addressed draft in Gmail' : 'Enter a valid recipient email first'} onClick={() => window.open(gmailComposeUrl(draft, { recipientEmail, recipientName, senderName, senderTitle }), '_blank', 'noopener,noreferrer')}>Open in Gmail</button>}<button className="text-xs font-semibold text-[#A64212] underline" onClick={() => void navigator.clipboard.writeText([draft.subject, draft.body].filter(Boolean).join('\n\n'))}>Copy</button></div></div>{draft.subject !== null && <input aria-label={`${labels[draft.channel]} subject`} className="mt-3 w-full rounded-lg border border-[#CFC7BC] px-3 py-2 text-sm font-semibold" value={draft.subject} onChange={(event) => setBundle({ ...bundle, drafts: bundle.drafts.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item) })} />}<textarea aria-label={`${labels[draft.channel]} body`} className="mt-3 min-h-36 w-full resize-y rounded-lg border border-[#CFC7BC] px-3 py-3 text-sm leading-6" value={draft.body} onChange={(event) => setBundle({ ...bundle, drafts: bundle.drafts.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /><details className="mt-3 text-xs text-[#68645F]"><summary className="cursor-pointer font-semibold">Evidence used ({draft.evidence_ids.length})</summary><ul className="mt-2 space-y-2">{bundle.evidence.filter((item) => draft.evidence_ids.includes(item.id)).map((item) => <li key={item.id}><a className="text-[#A64212] underline" href={item.source_url} target="_blank" rel="noreferrer">{item.factual_claim} ↗</a></li>)}</ul></details></article>)}</div>}
    </div>
  </section>
}
