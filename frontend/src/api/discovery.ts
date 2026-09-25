import { apiRequest } from './client'

export interface DiscoveryRequest { country_codes: string[]; minimum_employees: number; include_unknown_size: boolean; industry: string | null; limit: number }
export interface DiscoveryCandidate { entity_id: string; name: string; domain: string; country_code: string; country_name: string; industry: string | null; employee_count: number | null; size_verification: 'verified' | 'needs_verification'; discovery_confidence: number; source_url: string }
export interface DiscoveryRun { id: string; status: string; request: DiscoveryRequest; candidates: DiscoveryCandidate[]; confirmed_domains: string[]; created_at: string }
export interface DiscoveryConfirmation { run: DiscoveryRun; company_ids: string[] }

export const createDiscoveryRun = (request: DiscoveryRequest, signal?: AbortSignal) => apiRequest<DiscoveryRun>('/discovery-runs', { method: 'POST', body: JSON.stringify(request), signal })
export const confirmDiscoveryRun = (runId: string, domains: string[], signal?: AbortSignal) => apiRequest<DiscoveryConfirmation>(`/discovery-runs/${encodeURIComponent(runId)}/confirm`, { method: 'POST', body: JSON.stringify({ domains }), signal })
