import { apiRequest } from './client'
import type { OpportunityRecord, OpportunityStatus } from './opportunities'
export const updateOpportunity = (id: string, patch: { status?: OpportunityStatus; note?: string | null }) => apiRequest<OpportunityRecord>(`/opportunities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
