export type SignalEffect = 'positive' | 'penalty' | 'disqualifier'

export interface SignalDraft {
  id: string
  question: string
  positiveCriteria: string
  exclusions: string
  effect: SignalEffect
  weight: number
  freshnessWindowDays: number
}

export interface ProfileDraft {
  id: string
  name: string
  serviceRole: string
  description: string
  industries: string
  geographies: string
  companySize: string
  operationalComplexity: string
  signals: SignalDraft[]
  version?: number
}
