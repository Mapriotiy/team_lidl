import { opportunityFixtures } from './fixtures'
import type { Opportunity, OpportunityFilters } from './types'
import { listOpportunityRecords } from '../../api/opportunities'

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function listOpportunities(
  filters: OpportunityFilters,
): Promise<Opportunity[]> {
  if (import.meta.env.MODE === 'test') {
    await delay(120)
    const query = filters.query.trim().toLocaleLowerCase()
    return opportunityFixtures.filter((item) => item.service === filters.service).filter((item) => filters.status === 'all' || item.status === filters.status).filter((item) => !query || item.companyName.toLocaleLowerCase().includes(query) || item.domain.toLocaleLowerCase().includes(query)).sort((left, right) => right.score - left.score)
  }
  const result = await listOpportunityRecords({ profile_id: filters.service, status: filters.status === 'all' ? undefined : filters.status, search: filters.query, sort: 'score_desc' })
  return result.items.map((item) => ({ id: item.id, companyId: item.company_id, companyName: item.company_name, domain: item.canonical_domain, industry: 'Persisted research', geography: 'See company facts', service: item.profile_id, status: item.status, eligibility: item.eligibility, score: item.score, coverage: item.coverage, collectionCompletion: item.collection_completion, strongestSignal: item.strongest_signal, signalCount: item.strongest_signal ? 1 : 0, lastResearchedAt: item.last_researched_at }))
}

