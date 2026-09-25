import { apiRequest } from './client'

export interface CompanySummary { id: string; canonical_domain: string; display_name: string; aliases: string[]; facts: Record<string, unknown>; created_at: string; updated_at: string }
export interface CompanyImportResult { accepted: Array<{ input: string; company: CompanySummary; created: boolean }>; rejected: Array<{ input: string; code: string; message: string }> }
export interface ResearchProgress { stage: string; completed: number; total: number }
export interface ResearchRun { id: string; company_id: string; profile_version_id: string; status: 'queued' | 'running' | 'completed' | 'partial' | 'failed'; progress: ResearchProgress[]; partial_errors: Array<{ stage: string; code: string; message: string }>; result_links: Record<string, string>; queued_at: string; started_at: string | null; finished_at: string | null }

export const importCompanies = (domains: string[], signal?: AbortSignal) => apiRequest<CompanyImportResult>('/companies/import', { method: 'POST', body: JSON.stringify({ domains }), signal })
export const submitResearch = (companyId: string, profileVersionId: string, idempotencyKey: string) => apiRequest<ResearchRun>('/research-runs', { method: 'POST', body: JSON.stringify({ company_id: companyId, profile_version_id: profileVersionId, idempotency_key: idempotencyKey }) })
export const getResearchRun = (runId: string, signal?: AbortSignal) => apiRequest<ResearchRun>(`/research-runs/${encodeURIComponent(runId)}`, { signal })
