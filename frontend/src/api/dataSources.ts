import { apiRequest } from './client'

export interface CrawlEntry {
  id: string
  run_id: string
  company_id: string
  company_name: string
  provider: string
  target: string
  status: 'ok' | 'error' | 'skipped'
  detail: string
  at: string
  documents: number | null
  provenance: 'crawl_log' | 'stored_source'
}
export interface SourceHealth {
  id: string
  name: string
  description: string
  configured: boolean
  enabled: boolean
  attempts: number
  succeeded: number
  failed: number
  last_attempt_at: string | null
}
export interface DataSourcesSnapshot {
  sources: SourceHealth[]
  crawl_log: CrawlEntry[]
  runtime: {
    assessment_model: string | null
    assessment_configured: boolean
    newsapi_configured: boolean
    eu_tenders_enabled: boolean
    browser_rendering_enabled: boolean
    source_text_retention_days: number
    worker_concurrency: number
  }
}
export const getDataSources = (limit = 100, signal?: AbortSignal) => apiRequest<DataSourcesSnapshot>(`/data-sources?limit=${limit}`, { signal })
