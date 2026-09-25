import { apiRequest, queryString } from './client'

export type OpportunityStatus = 'new' | 'shortlisted' | 'dismissed'
export interface OpportunityRecord { id: string; company_id: string; company_name: string; canonical_domain: string; profile_id: string; profile_name: string; profile_version_id: string; status: OpportunityStatus; note: string | null; score: number; eligibility: 'eligible' | 'needs_research' | 'excluded'; coverage: number; collection_completion: number; strongest_signal: string | null; last_researched_at: string }
export interface OpportunityPage { items: OpportunityRecord[]; meta: { page: number; page_size: number; total: number } }
export interface OpportunityQuery { profile_id?: string; status?: OpportunityStatus; eligibility?: string; search?: string; min_score?: number; sort?: 'score_desc' | 'score_asc' | 'updated_desc'; page?: number; page_size?: number }
export const listOpportunityRecords = (query: OpportunityQuery, signal?: AbortSignal) => apiRequest<OpportunityPage>(`/opportunities${queryString({ ...query })}`, { signal })
