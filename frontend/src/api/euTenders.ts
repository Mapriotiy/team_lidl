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
export interface TenderOpportunity { call: TenderCall; fit_score: number; recommendation: 'bid' | 'partner' | 'monitor' | 'reject' | 'needs_review'; dimensions: TenderFitDimension[]; matched_terms: string[]; risks: string[] }

export interface EuTendersSearch {
  profile_id: string
  profile_name: string
  query: string
  total: number
  calls: TenderCall[]
  opportunities: TenderOpportunity[]
  retrieved_at: string
  warnings: string[]
}

export const searchEuTenders = (profileId: string, limit = 10) =>
  apiRequest<EuTendersSearch>(`/eu-tenders/search${queryString({ profile_id: profileId, limit })}`)
