import type { Profile } from '../../api/profiles'
import type { DiscoveryCandidate, DiscoveryRequest } from '../../api/discovery'

const europe = 'AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH TR UA GB VA'.split(' ')
const eastern = 'PL CZ SK HU RO BG MD UA EE LV LT'.split(' ')
const regions: Record<string, string[]> = { europe, 'eastern europe': eastern, 'central and eastern europe': eastern, 'western europe': 'AT BE FR DE LI LU MC NL CH'.split(' '), 'north america': ['US', 'CA', 'MX'], 'united kingdom': ['GB'], uk: ['GB'], usa: ['US'] }
const names = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = Array.from({ length: 676 }, (_, index) => String.fromCharCode(65 + Math.floor(index / 26), 65 + index % 26)).filter((code) => names.of(code) !== code)
export const words = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' ? value.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean) : []

function minimumSize(profile: Profile): number {
  const icp = profile.current_version.configuration.icp
  const raw = icp.company_size ?? icp.company_sizes
  const description = String(raw ?? '').toLowerCase().replace(/(\d),(?=\d{3})/g, '$1').replace(/one thousand/g, '1000').replace(/five hundred/g, '500').replace(/one hundred/g, '100')
  const number = description.match(/\d+/)
  return number && /\+|more than|over|at least|above|\d\s*[-–]\s*\d/.test(description) ? Math.min(Number(number[0]), 10000000) : 1
}

export function profileSearch(profile: Profile): { request: DiscoveryRequest; notes: string[]; industries: string[] } {
  const icp = profile.current_version.configuration.icp
  const notes: string[] = []
  const errors: string[] = []
  const geography = words(icp.geographies)
  const codes = geography.length ? geography.flatMap((place) => {
    const lower = place.toLowerCase()
    if (regions[lower]) return regions[lower]
    const code = countries.find((item) => item === place.toUpperCase() || names.of(item)?.toLowerCase() === lower)
    if (code) return [code]
    errors.push(`“${place}” could not be interpreted as a country or supported region. Update the Service Profile to make this restriction searchable.`)
    return []
  }) : eastern
  if (!geography.length) notes.push('No geography is set. Searching Central and Eastern Europe by default.')
  if (errors.length) throw new Error(errors.join(' '))
  const size = String(icp.company_size ?? icp.company_sizes ?? '')
  if (size) notes.push(`Company size preference: ${size}. Check the linked source before qualifying a company.`)
  if (icp.operational_complexity && icp.operational_complexity !== 'unknown') notes.push('Operational characteristics and buying signals are checked during research.')
  return { request: { country_codes: [...new Set(codes)], minimum_employees: minimumSize(profile), include_unknown_size: true, industry: null, industries: words(icp.industries), limit: 50 }, industries: words(icp.industries), notes }
}

export function match(candidate: DiscoveryCandidate, profile: Profile) {
  const icp = profile.current_version.configuration.icp
  const industries = words(icp.industries)
  const industryMatches = industries.some((item) => candidate.industry?.toLowerCase().includes(item.toLowerCase()))
  const reasons: string[] = []
  if (words(icp.geographies).length) reasons.push('Within your target geography')
  if (industryMatches) reasons.push(`Industry matches ${candidate.industry}`)
  const sizeMatches = minimumSize(profile) > 1 && candidate.employee_count !== null && candidate.employee_count >= minimumSize(profile)
  if (sizeMatches) reasons.push('Reported size meets minimum')
  if (!reasons.length) reasons.push(industries.length ? 'Industry fit needs review' : 'Found within your search scope')
  if (industries.length && !industryMatches) reasons.push('Industry fit needs review')
  return { score: (industryMatches ? 4 : 0) + (sizeMatches ? 2 : 0), reason: [...new Set(reasons)].join(' · ') }
}
