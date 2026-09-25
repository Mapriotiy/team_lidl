import { apiRequest } from './client'
import type { Translation } from './companies'
export const translateEvidence = (id: string, targetLanguage: 'en' | 'ro', signal?: AbortSignal) => apiRequest<Translation>(`/evidence/${encodeURIComponent(id)}/translations`, { method: 'POST', body: JSON.stringify({ target_language: targetLanguage }), signal })
