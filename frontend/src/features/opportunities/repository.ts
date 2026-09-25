import { opportunityFixtures } from './fixtures'
import type { Opportunity, OpportunityFilters } from './types'

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function listOpportunities(
  filters: OpportunityFilters,
): Promise<Opportunity[]> {
  await delay(120)

  const query = filters.query.trim().toLocaleLowerCase()

  return opportunityFixtures
    .filter((opportunity) => opportunity.service === filters.service)
    .filter((opportunity) => filters.status === 'all' || opportunity.status === filters.status)
    .filter(
      (opportunity) =>
        query.length === 0 ||
        opportunity.companyName.toLocaleLowerCase().includes(query) ||
        opportunity.domain.toLocaleLowerCase().includes(query),
    )
    .sort((left, right) => right.score - left.score)
}

