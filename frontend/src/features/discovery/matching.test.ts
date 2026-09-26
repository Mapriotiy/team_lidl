import { describe, expect, it } from 'vitest'

import type { Profile } from '../../api/profiles'
import { profileSearch } from './matching'

function profile(geographies: string[] = [], industries: string[] = []): Profile {
  return {
    id: 'profile',
    name: 'RPA',
    current_version: {
      id: 'version',
      version: 1,
      configuration: {
        service_role: 'RPA developers',
        service_description: 'Automation',
        icp: { geographies, industries, company_size: '' },
        signals: [],
      },
      created_at: '',
    },
    created_at: '',
    updated_at: '',
  }
}

describe('profileSearch', () => {
  it('uses the demo market when a profile has no geography restriction', () => {
    const result = profileSearch(profile([], ['Logistics']))

    expect(result.request.country_codes).toEqual(['PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'MD', 'UA', 'EE', 'LV', 'LT'])
    expect(result.request.industries).toEqual(['Logistics'])
    expect(result.notes).toContain('No geography is set. Searching Central and Eastern Europe by default.')
  })
})
