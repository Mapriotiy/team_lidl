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

export function ensureLetterParagraphs(value: string) {
  const normalized = normalizeLetterSpacing(value)
  if (normalized.includes('\n\n')) return normalized
  const greeting = normalized.match(/^(Hello[^,]*,|Hi[^,]*,|Dear[^,]*,)\s*/i)?.[1]
  const withoutGreeting = greeting ? normalized.slice(greeting.length).trim() : normalized
  const signoffMatch = withoutGreeting.match(
    /\s*((?:Best|Kind|Warm) regards,?|Sincerely,?)\s*$/i,
  )
  const signoff = signoffMatch?.[1]
  const message = signoff
    ? withoutGreeting.slice(0, signoffMatch.index).trim()
    : withoutGreeting
  const paragraphs = message
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ž])/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return [greeting, ...paragraphs, signoff].filter(Boolean).join('\n\n')
}

export function gmailComposeUrl(draft: OutreachDraft, details: GmailDraftDetails) {
  const greeting = details.recipientName.trim() ? `Hello ${details.recipientName.trim()},` : 'Hello,'
  let body = ensureLetterParagraphs(
    normalizeLetterSpacing(draft.body).replace(/^Hello,?/i, greeting),
  )
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
