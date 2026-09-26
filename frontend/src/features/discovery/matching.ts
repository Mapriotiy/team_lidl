import type { IcpCriterion, IcpCriterionKey, IcpEmployeeRange, Profile } from '../../api/profiles'
import type { DiscoveryCandidate, DiscoveryRequest } from '../../api/discovery'

// Central and Eastern Europe: the market the demo searches when a profile restricts nothing.
const defaultMarket = ['PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'MD', 'UA', 'EE', 'LV', 'LT']

/** The criteria the server resolved for the active profile version. */
export const criteria = (profile: Profile): IcpCriterion[] => profile.current_version.icp_criteria ?? []

export const criterion = (profile: Profile, key: IcpCriterionKey): IcpCriterion | undefined =>
  criteria(profile).find((item) => item.key === key)

export const industries = (profile: Profile): string[] => criterion(profile, 'industry')?.values ?? []

export function employeeRangeLabel(range: IcpEmployeeRange): string {
  const grouped = (value: number) => value.toLocaleString('en-US')
  if (range.minimum !== null && range.maximum !== null) return `${grouped(range.minimum)}–${grouped(range.maximum)} employees`
  if (range.minimum !== null) return `${grouped(range.minimum)}+ employees`
  if (range.maximum !== null) return `up to ${grouped(range.maximum)} employees`
  return 'any company size'
}

export function minimumEmployees(profile: Profile): number {
  return criterion(profile, 'company_size')?.employees?.minimum ?? 1
}

/** One line for the discovery screen describing the criteria research will use. */
export function describeCriteria(profile: Profile): string {
  const geography = criterion(profile, 'geography')
  const markets = geography?.worldwide ? 'All geographies' : (geography?.values.join(', ') || 'All geographies')
  const sectors = industries(profile).join(', ') || 'All industries'
  return `${markets} · ${sectors}`
}

export function profileSearch(profile: Profile): { request: DiscoveryRequest; notes: string[]; industries: string[] } {
  const notes: string[] = []
  const geography = criterion(profile, 'geography')
  if (geography?.unresolved.length) {
    throw new Error(`“${geography.unresolved.join('”, “')}” could not be interpreted as a country or supported region. Update the Service Profile to make this restriction searchable.`)
  }
  const countries = geography?.worldwide ? [] : [...new Set(geography?.countries ?? [])]
  if (!countries.length) {
    notes.push(geography?.worldwide
      ? 'The profile accepts every country. Searching Central and Eastern Europe to keep this run bounded.'
      : 'No geography is set. Searching Central and Eastern Europe by default.')
  }
  const size = criterion(profile, 'company_size')
  if (size?.values.length) {
    const stated = size.values.join(', ')
    notes.push(size.employees
      ? `Company size preference: ${stated} (${employeeRangeLabel(size.employees)}). Check the linked source before qualifying a company.`
      : `Company size preference: ${stated}. No employee range could be read from it, so it does not filter discovery.`)
  }
  if (criterion(profile, 'operational_complexity')?.values.length) notes.push('Operational characteristics and buying signals are checked during research.')
  const targets = industries(profile)
  return {
    request: {
      country_codes: countries.length ? countries : defaultMarket,
      minimum_employees: minimumEmployees(profile),
      include_unknown_size: size?.include_unknown ?? true,
      industry: null,
      industries: targets,
      limit: 100,
    },
    industries: targets,
    notes,
  }
}

export function match(candidate: DiscoveryCandidate, profile: Profile) {
  const targets = industries(profile)
  const industryMatches = targets.some((item) => candidate.industry?.toLowerCase().includes(item.toLowerCase()))
  const reasons: string[] = []
  if (criterion(profile, 'geography')?.countries.length) reasons.push('Within your target geography')
  if (industryMatches) reasons.push(`Industry matches ${candidate.industry}`)
  const minimum = minimumEmployees(profile)
  const sizeMatches = minimum > 1 && candidate.employee_count !== null && candidate.employee_count >= minimum
  if (sizeMatches) reasons.push('Reported size meets minimum')
  if (!reasons.length) reasons.push(targets.length ? 'Industry fit needs review' : 'Found within your search scope')
  if (targets.length && !industryMatches) reasons.push('Industry fit needs review')
  return { score: (industryMatches ? 4 : 0) + (sizeMatches ? 2 : 0), reason: [...new Set(reasons)].join(' · ') }
}
