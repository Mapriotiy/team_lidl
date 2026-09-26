import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import type { DataSourcesSnapshot } from '../../api/dataSources'
import { DataSources } from './DataSources'

const snapshot: DataSourcesSnapshot = {
  sources: [
    { id: 'gdelt', name: 'GDELT', description: 'Global news discovery.', configured: true, enabled: true, attempts: 1, succeeded: 0, failed: 1, last_attempt_at: '2026-09-26T12:00:00Z' },
    { id: 'newsapi', name: 'NewsAPI', description: 'Supplementary news discovery.', configured: true, enabled: true, attempts: 1, succeeded: 1, failed: 0, last_attempt_at: '2026-09-26T12:00:01Z' },
    { id: 'websites', name: 'Company websites', description: 'First-party pages.', configured: true, enabled: true, attempts: 1, succeeded: 1, failed: 0, last_attempt_at: '2026-09-26T12:00:02Z' },
    { id: 'eu_tenders', name: 'EU Funding & Tenders', description: 'Market demand.', configured: true, enabled: false, attempts: 0, succeeded: 0, failed: 0, last_attempt_at: null },
  ],
  crawl_log: [
    { id: '1', run_id: 'run-12345678', company_id: 'company-1', company_name: 'Example', provider: 'gdelt', target: 'Example', status: 'error', detail: 'Provider request failed', at: '2026-09-26T12:00:00Z', documents: null, provenance: 'crawl_log' },
    { id: '2', run_id: 'run-12345678', company_id: 'company-1', company_name: 'Example', provider: 'newsapi', target: 'Example', status: 'ok', detail: 'Returned 3 article URLs', at: '2026-09-26T12:00:01Z', documents: null, provenance: 'crawl_log' },
  ],
  runtime: { assessment_model: 'model', assessment_configured: true, newsapi_configured: true, eu_tenders_enabled: false, browser_rendering_enabled: false, source_text_retention_days: 30, worker_concurrency: 2 },
}

test('shows fallback-visible provider attempts and filters crawl problems', () => {
  render(<DataSources snapshot={snapshot} loading={false} error="" refresh={vi.fn()} limit={100} setLimit={vi.fn()} />)
  expect(screen.getByText('Provider request failed')).toBeInTheDocument()
  expect(screen.getByText('Returned 3 article URLs')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'NewsAPI source' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('switch', { name: 'EU Funding & Tenders source' })).toHaveAttribute('aria-checked', 'false')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Only problems' }))
  expect(screen.getByText('Provider request failed')).toBeInTheDocument()
  expect(screen.queryByText('Returned 3 article URLs')).not.toBeInTheDocument()
})

test('does not invent crawl history for an empty log', () => {
  render(<DataSources snapshot={{ ...snapshot, sources: snapshot.sources.map((source) => ({ ...source, attempts: 0, succeeded: 0, failed: 0, last_attempt_at: null })), crawl_log: [] }} loading={false} error="" refresh={vi.fn()} limit={100} setLimit={vi.fn()} />)
  expect(screen.getByText('No crawl attempts recorded yet')).toBeInTheDocument()
  expect(screen.getAllByText('No recorded attempts yet')).toHaveLength(4)
  expect(screen.getByText('On demand')).toBeInTheDocument()
})

test('labels historical saved sources separately from instrumented crawl attempts', () => {
  const historical = { id: 'stored-source:3', run_id: 'old-run', company_id: 'company-1', company_name: 'Example', provider: 'websites', target: 'https://example.com/report', status: 'ok' as const, detail: 'Historical stored source; original crawl trace unavailable', at: '2026-09-25T12:00:00Z', documents: 1, provenance: 'stored_source' as const }
  render(<DataSources snapshot={{ ...snapshot, crawl_log: [historical] }} loading={false} error="" refresh={vi.fn()} limit={100} setLimit={vi.fn()} />)
  expect(screen.getByText('Historical record')).toBeInTheDocument()
  expect(screen.getByText(/original crawl trace unavailable/i)).toBeInTheDocument()
})
