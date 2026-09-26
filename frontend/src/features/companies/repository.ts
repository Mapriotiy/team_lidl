import { companyFixture } from './fixtures'
import type { CompanyDetail } from './types'
import { getCompanyResult } from '../../api/companies'

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function getCompany(companyId: string): Promise<CompanyDetail> {
  if (import.meta.env.MODE === 'test') {
    await delay(140)
    if (companyId !== companyFixture.id) throw new Error('Company not found')
    return structuredClone(companyFixture)
  }
  const result = await getCompanyResult(companyId)
  const score = [...result.scores].sort((left, right) => right.created_at.localeCompare(left.created_at))[0]
  const evidence = result.assessments.flatMap((assessment) => assessment.evidence).filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
  const factEntries = Object.entries(result.facts).map(([label, raw]) => {
    const value = typeof raw === 'object' && raw !== null && 'value' in raw ? (raw as { value?: unknown }).value : raw
    const sourceIds = typeof raw === 'object' && raw !== null && 'source_ids' in raw && Array.isArray((raw as { source_ids?: unknown }).source_ids) ? (raw as { source_ids: string[] }).source_ids : []
    return { label: label.replaceAll('_', ' '), value: value === null || value === undefined ? null : String(value), state: value === null || value === undefined ? 'unknown' as const : 'known' as const, sourceIds }
  })
  return {
    id: result.id, name: result.display_name, domain: result.canonical_domain, aliases: result.aliases,
    profileName: result.assessments[0]?.profile_version_id ?? 'Latest profile version', score: score?.score ?? 0, coverage: score?.coverage ?? 0, eligibility: score?.eligibility ?? 'needs_research', facts: factEntries,
    sources: result.sources.map((item) => ({ id: item.id, title: item.title || item.canonical_url, url: item.canonical_url, type: item.source_type, retrievedAt: item.retrieved_at, publicationDate: item.publication_date })),
    evidence: evidence.map((item) => ({ id: item.id, sourceId: item.source_id, sourceTitle: item.source.title, sourceUrl: item.source.canonical_url, sourceType: item.source.source_type, publicationDate: item.source.publication_date, excerpt: item.excerpt, factualClaim: item.factual_claim, translations: item.translations.map((translation) => ({ targetLanguage: translation.target_language, text: translation.translated_excerpt })) })),
    assessments: result.assessments.map((item) => ({ id: item.id, question: item.signal_id, status: item.status as 'supported' | 'contradicted' | 'insufficient_evidence', strength: item.evidence_strength as 'strong' | 'moderate' | 'weak' | null, interpretation: item.rationale, evidenceIds: item.evidence.map((evidenceItem) => evidenceItem.id) })),
    contributions: (score?.contributions ?? []).map((item) => ({ signal: String(item.signal_id ?? 'Signal'), effect: item.effect === 'penalty' ? 'penalty' as const : 'positive' as const, points: Number(item.weighted_value ?? 0), evidenceIds: Array.isArray(item.evidence_ids) ? item.evidence_ids.map(String) : [] })),
    researchRuns: result.research_history.map((run) => { const collection = run.progress.find((item) => item.stage === 'collection'); const assessment = run.progress.find((item) => item.stage === 'assessment'); return { id: run.id, status: run.status as 'queued' | 'running' | 'completed' | 'partial' | 'failed', startedAt: run.started_at ?? run.queued_at, finishedAt: run.finished_at ?? run.queued_at, collected: Number(collection?.completed ?? 0), collectionTotal: Number(collection?.total ?? 0), assessed: Number(assessment?.completed ?? 0), assessmentTotal: Number(assessment?.total ?? 0), warning: run.partial_errors.map((item) => String(item.message ?? item.code ?? 'Partial failure')).join(' · ') || null, model: typeof run.usage.model === 'string' ? run.usage.model : undefined, totalTokens: Number(run.usage.total_tokens ?? 0), costUsd: typeof run.usage.cost_usd === 'number' ? run.usage.cost_usd : null } }),
    warnings: score?.warnings ?? [], exclusions: score?.exclusion_reasons ?? [], penaltyPoints: score?.penalty_points ?? 0,
  }
}
