import { expect, test } from 'vitest'

import { listOpportunities } from './repository'

test('returns ranked opportunities for the selected service', async () => {
  const opportunities = await listOpportunities({
    service: 'automation',
    status: 'all',
    query: '',
  })

  expect(opportunities.map((opportunity) => opportunity.score)).toEqual([86, 81, 64])
})

test('filters opportunities by status and search query', async () => {
  const opportunities = await listOpportunities({
    service: 'automation',
    status: 'shortlisted',
    query: 'dhl',
  })

  expect(opportunities).toHaveLength(1)
  expect(opportunities[0].companyName).toBe('DHL Group')
})

