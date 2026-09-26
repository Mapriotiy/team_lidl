import { apiRequest } from './client'

export type DraftChannel = 'email' | 'linkedin_inmail' | 'connection_note' | 'call_brief'
export interface OutreachEvidence { id: string; signal_id: string; factual_claim: string; excerpt: string; source_title: string; source_url: string }
export interface OutreachDraft { channel: DraftChannel; subject: string | null; body: string; evidence_ids: string[] }
export interface OutreachDraftBundle { company_id: string; company_name: string; recipient_role: string; drafts: OutreachDraft[]; evidence: OutreachEvidence[]; disclaimer: string }
export interface OutreachContact { email: string; name: string | null; role: string | null; source_url: string; source_title: string; confidence: number }

export const generateOutreachDrafts = (companyId: string, recipientRole: string, channels: DraftChannel[], signal?: AbortSignal) => apiRequest<OutreachDraftBundle>(`/companies/${encodeURIComponent(companyId)}/outreach-drafts`, { method: 'POST', body: JSON.stringify({ recipient_role: recipientRole, tone: 'consultative', channels }), signal })
export const discoverOutreachContact = (companyId: string, signal?: AbortSignal) => apiRequest<OutreachContact | null>(`/companies/${encodeURIComponent(companyId)}/outreach-contact`, { signal })
