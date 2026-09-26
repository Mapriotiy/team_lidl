import type { OutreachDraft } from '../../api/outreach'

export interface GmailDraftDetails {
  recipientEmail: string
  recipientName: string
  senderName: string
  senderTitle: string
}

export const isEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export function normalizeLetterSpacing(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function gmailComposeUrl(draft: OutreachDraft, details: GmailDraftDetails) {
  const greeting = details.recipientName.trim() ? `Hello ${details.recipientName.trim()},` : 'Hello,'
  let body = normalizeLetterSpacing(draft.body).replace(/^Hello,?/i, greeting)
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
