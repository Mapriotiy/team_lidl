import { apiDownload, queryString } from './client'
import type { OpportunityQuery } from './opportunities'
export async function downloadOpportunities(query: OpportunityQuery, signal?: AbortSignal) {
  const blob = await apiDownload(`/exports/opportunities.csv${queryString({ ...query })}`, signal)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'opportunities.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}
