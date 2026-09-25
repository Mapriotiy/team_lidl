import { companyFixture } from './fixtures'
import type { CompanyDetail } from './types'

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function getCompany(companyId: string): Promise<CompanyDetail> {
  await delay(140)
  if (companyId !== companyFixture.id) throw new Error('Company not found')
  return structuredClone(companyFixture)
}
