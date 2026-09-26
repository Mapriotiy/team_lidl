import { apiRequest, queryString } from './client'

export interface TenderCall {
  identifier: string
  title: string
  url: string
  status: 'open' | 'forthcoming'
  start_date: string | null
  deadline: string | null
  programme: string | null
  summary: string
  opportunity_type: 'public_procurement' | 'funding_call' | 'cascade_funding' | 'market_consultation' | 'unknown'
  budget: number | null
}

export interface TenderFitDimension { id: string; label: string; score: number | null; explanation: string }
export interface TenderOpportunity { call: TenderCall; fit_score: number; recommendation: 'bid' | 'partner' | 'monitor' | 'reject' | 'needs_review'; dimensions: TenderFitDimension[]; matched_terms: string[]; risks: string[]; decision_summary: string; next_actions: string[] }
export interface TenderFact { category: 'scope' | 'eligibility' | 'consortium' | 'funding' | 'deadline'; label: string; status: 'supported' | 'not_found'; finding: string; excerpt: string | null; source_url: string }
export interface TenderIntelligence { decision: 'go_to_bid_review' | 'partner_search' | 'needs_review' | 'insufficient_evidence'; confidence: number; evidence_coverage: number; facts: TenderFact[]; blockers: string[]; next_actions: string[]; source_url: string; retrieved_at: string; warnings: string[] }

export interface EuTendersSearch {
  profile_id: string
  profile_name: string
  query: string
  queries: string[]
  total: number
  calls: TenderCall[]
  opportunities: TenderOpportunity[]
  retrieved_at: string
  warnings: string[]
}

export const searchEuTenders = (profileId: string, limit = 10) =>
  apiRequest<EuTendersSearch>(`/eu-tenders/search${queryString({ profile_id: profileId, limit })}`)

export const analyzeEuTender = (call: TenderCall) =>
  apiRequest<TenderIntelligence>('/eu-tenders/analyze', { method: 'POST', body: JSON.stringify({ call }) })
