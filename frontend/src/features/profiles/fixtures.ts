import type { ProfileDraft } from './types'

export const profileFixture: ProfileDraft = {
  id: 'profile-automation',
  name: 'Process automation',
  description: 'Intelligent automation and process improvement services.',
  industries: 'Aviation, logistics, manufacturing',
  geographies: 'Europe',
  companySize: '1,000+ employees',
  operationalComplexity: 'High',
  signals: [
    {
      id: 'efficiency-program',
      question: 'Is there a current operational-efficiency program?',
      positiveCriteria: 'Named and dated program with measurable scope',
      exclusions: 'Generic marketing language',
      effect: 'positive',
      weight: 20,
      freshnessWindowDays: 730,
    },
    {
      id: 'internal-capability',
      question: 'Does the company have strong internal automation delivery capability?',
      positiveCriteria: 'Dedicated center of excellence or scaled internal team',
      exclusions: 'A single vacancy without team context',
      effect: 'penalty',
      weight: 8,
      freshnessWindowDays: 365,
    },
  ],
}
