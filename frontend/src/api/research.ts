import { apiRequest } from './client'

export interface ProvenancedFact { value: string | number | boolean | null; source_ids: string[]; is_unknown: boolean }
export interface CompanySummary { id: string; canonical_domain: string; display_name: string; aliases: string[]; industry: ProvenancedFact | null; geography: ProvenancedFact | null; company_size: ProvenancedFact | null; operational_complexity: ProvenancedFact | null }
export interface CompanyImportResult { accepted: Array<{ input: string; company: CompanySummary; created: boolean }>; rejected: Array<{ input: string; code: string; message: string }> }
export interface ResearchProgress { stage: string; completed: number; total: number }
export interface ResearchRun { id: string; company_id: string; profile_version_id: string; status: 'queued' | 'running' | 'completed' | 'partial' | 'failed'; progress: ResearchProgress[]; partial_errors: Array<{ stage: string; code: string; message: string }>; result_links: Record<string, string>; usage: { provider?: string; model?: string; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost_usd?: number | null }; queued_at: string; started_at: string | null; finished_at: string | null }

export const importCompanies = (domains: string[], signal?: AbortSignal) => apiRequest<CompanyImportResult>('/companies/import', { method: 'POST', body: JSON.stringify({ domains }), signal })
export const listCompanies = (signal?: AbortSignal) => apiRequest<CompanySummary[]>('/companies', { signal })
export const submitResearch = (companyId: string, profileVersionId: string, idempotencyKey: string) => apiRequest<ResearchRun>('/research-runs', { method: 'POST', body: JSON.stringify({ company_id: companyId, profile_version_id: profileVersionId, idempotency_key: idempotencyKey }) })
export const getResearchRun = (runId: string, signal?: AbortSignal) => apiRequest<ResearchRun>(`/research-runs/${encodeURIComponent(runId)}`, { signal })
export const deleteCompanyResearch = (companyId: string) => apiRequest<{ deleted_runs: number }>(`/companies/${encodeURIComponent(companyId)}/research`, { method: 'DELETE' })
