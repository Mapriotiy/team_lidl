export type ServiceKey = 'automation' | 'cybersecurity' | 'software-development'

export type OpportunityStatus = 'new' | 'shortlisted' | 'dismissed'

export type Eligibility = 'eligible' | 'needs_research' | 'excluded'

export interface ServiceOption {
  key: ServiceKey
  name: string
  shortName: string
}

export interface Opportunity {
  id: string
  companyId: string
  companyName: string
  domain: string
  industry: string
  geography: string
  service: ServiceKey
  status: OpportunityStatus
  eligibility: Eligibility
  score: number
  coverage: number
  strongestSignal: string | null
  signalCount: number
  lastResearchedAt: string | null
}

export interface OpportunityFilters {
  service: ServiceKey
  status: OpportunityStatus | 'all'
  query: string
}

