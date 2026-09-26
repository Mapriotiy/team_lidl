import { describe, expect, it } from 'vitest'

import type { IcpCriterion, Profile } from '../../api/profiles'
import { describeCriteria, match, minimumEmployees, profileSearch } from './matching'

function profile(criteria: IcpCriterion[] = []): Profile {
  return {
    id: 'profile',
    name: 'RPA',
    current_version: {
      id: 'version',
      version: 1,
      configuration: { service_role: 'RPA developers', service_description: 'Automation', icp: {}, signals: [] },
      icp_criteria: criteria,
      created_at: '',
    },
    created_at: '',
    updated_at: '',
  }
}

function criterion(key: IcpCriterion['key'], values: string[], extra: Partial<IcpCriterion> = {}): IcpCriterion {
  return { key, values, countries: [], worldwide: false, employees: null, include_unknown: true, unresolved: [], note: null, ...extra }
}

describe('profileSearch', () => {
  it('uses the demo market when a profile has no geography restriction', () => {
    const result = profileSearch(profile([criterion('industry', ['Logistics'])]))

    expect(result.request.country_codes).toEqual(['PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'MD', 'UA', 'EE', 'LV', 'LT'])
    expect(result.request.industries).toEqual(['Logistics'])
    expect(result.notes).toContain('No geography is set. Searching Central and Eastern Europe by default.')
  })

  it('searches the countries the server resolved from the profile wording', () => {
    const result = profileSearch(profile([criterion('geography', ['Romania', 'Bulgaria'], { countries: ['RO', 'BG'] })]))

    expect(result.request.country_codes).toEqual(['RO', 'BG'])
    expect(result.notes).not.toContain('No geography is set. Searching Central and Eastern Europe by default.')
  })

  it('turns the parsed employee band into the discovery minimum', () => {
    const result = profileSearch(profile([criterion('company_size', ['1,000+ employees'], { employees: { minimum: 1000, maximum: null } })]))

    expect(result.request.minimum_employees).toBe(1000)
    expect(result.request.include_unknown_size).toBe(true)
    expect(result.notes.join(' ')).toContain('1,000+ employees')
  })

  it('does not filter discovery on a size phrase that carries no number', () => {
    const result = profileSearch(profile([criterion('company_size', ['Large organisations'])]))

    expect(result.request.minimum_employees).toBe(1)
    expect(result.notes.join(' ')).toContain('does not filter discovery')
  })

  it('refuses to search when the server could not interpret a geography', () => {
    expect(() => profileSearch(profile([criterion('geography', ['Atlantis'], { unresolved: ['Atlantis'] })])))
      .toThrow(/Atlantis/)
  })
})

describe('match', () => {
  const candidate = { entity_id: 'Q1', name: 'Example SA', domain: 'example.ro', country_code: 'RO', country_name: 'Romania', industry: 'Logistics', employee_count: 2500, size_verification: 'needs_verification' as const, discovery_confidence: 0.55, source_url: 'https://www.wikidata.org/wiki/Q1' }

  it('scores an industry and size match from the resolved criteria', () => {
    const result = match(candidate, profile([
      criterion('geography', ['Romania'], { countries: ['RO'] }),
      criterion('industry', ['Logistics']),
      criterion('company_size', ['1,000+ employees'], { employees: { minimum: 1000, maximum: null } }),
    ]))

    expect(result.score).toBe(6)
    expect(result.reason).toContain('Industry matches Logistics')
  })

  it('describes the saved criteria from the resolved values', () => {
    expect(describeCriteria(profile([
      criterion('geography', ['Romania'], { countries: ['RO'] }),
      criterion('industry', ['Logistics', 'Manufacturing']),
    ]))).toBe('Romania · Logistics, Manufacturing')
  })
})

describe('minimumEmployees', () => {
  it('is one employee when no size criterion was configured', () => {
    expect(minimumEmployees(profile())).toBe(1)
  })
})
