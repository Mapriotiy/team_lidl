import { expect, test } from 'vitest'

import { getCompany } from './repository'

test('returns evidence-backed company detail', async () => {
  const company = await getCompany('company-lufthansa')
  expect(company.assessments[0].evidenceIds).toEqual(['evidence-efficiency'])
  expect(company.evidence[0].excerpt).toContain('operational-efficiency programme')
})

test('rejects an unknown company id', async () => {
  await expect(getCompany('missing')).rejects.toThrow('Company not found')
})
