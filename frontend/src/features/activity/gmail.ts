import type { OutreachDraft } from '../../api/outreach'

export interface GmailDraftDetails {
  recipientEmail: string
  recipientName: string
  senderName: string
  senderTitle: string
}

export const isEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export function gmailComposeUrl(draft: OutreachDraft, details: GmailDraftDetails) {
  const greeting = details.recipientName.trim() ? `Hello ${details.recipientName.trim()},` : 'Hello,'
  let body = draft.body.trim().replace(/^Hello,?/i, greeting)
  const signature = [details.senderName.trim(), details.senderTitle.trim()].filter(Boolean).join('\n')
  if (signature) {
    body = body.replace(/Best regards,?\s*$/i, 'Best regards,')
    body = `${body}\n${signature}`
  }
  const query = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: details.recipientEmail.trim(),
    su: draft.subject ?? '',
    body,
  })
  return `https://mail.google.com/mail/?${query.toString()}`
}
