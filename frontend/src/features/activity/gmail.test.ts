import { describe, expect, it } from 'vitest'

import type { OutreachDraft } from '../../api/outreach'
import { gmailComposeUrl, isEmailAddress } from './gmail'

const draft: OutreachDraft = {
  channel: 'email',
  subject: 'Automation priorities',
  body: 'Hello,\n\nA relevant fact.\n\nBest regards,',
  evidence_ids: ['evidence-1'],
}

describe('Gmail compose integration', () => {
  it('builds an addressed and signed Gmail draft', () => {
    const url = new URL(gmailComposeUrl(draft, {
      recipientEmail: 'alex@example.com', recipientName: 'Alex',
      senderName: 'Mara Ionescu', senderTitle: 'Automation Consultant',
    }))

    expect(url.hostname).toBe('mail.google.com')
    expect(url.searchParams.get('to')).toBe('alex@example.com')
    expect(url.searchParams.get('su')).toBe('Automation priorities')
    expect(url.searchParams.get('body')).toContain('Hello Alex,')
    expect(url.searchParams.get('body')).toContain('Mara Ionescu\nAutomation Consultant')
  })

  it('validates recipient addresses', () => {
    expect(isEmailAddress('alex@example.com')).toBe(true)
    expect(isEmailAddress('not-an-email')).toBe(false)
  })
})
