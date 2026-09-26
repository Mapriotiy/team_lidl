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
}

export interface EuTendersSearch {
  profile_id: string
  profile_name: string
  query: string
  total: number
  calls: TenderCall[]
  retrieved_at: string
  warnings: string[]
}

export const searchEuTenders = (profileId: string, limit = 10) =>
  apiRequest<EuTendersSearch>(`/eu-tenders/search${queryString({ profile_id: profileId, limit })}`)
