import { profileFixture } from './fixtures'
import type { ProfileDraft } from './types'
import { listProfiles, selectDefaultProfile, updateProfile, type Profile, type ProfileConfiguration } from '../../api/profiles'

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function getProfile(): Promise<ProfileDraft> {
  if (import.meta.env.MODE === 'test') { await delay(100); return structuredClone(profileFixture) }
  const profiles = await listProfiles()
  const profile = selectDefaultProfile(profiles)
  if (!profile) throw new Error('Create a service profile before editing configuration.')
  return fromApi(profile)
}

export async function saveProfile(profile: ProfileDraft): Promise<ProfileDraft> {
  if (import.meta.env.MODE === 'test') { await delay(180); return structuredClone(profile) }
  return fromApi(await updateProfile(profile.id, profile.name, toConfiguration(profile)))
}

function fromApi(profile: Profile): ProfileDraft {
  const config = profile.current_version.configuration
  const list = (key: string) => Array.isArray(config.icp[key]) ? (config.icp[key] as string[]).join(', ') : String(config.icp[key] ?? '')
  return { id: profile.id, name: profile.name, serviceRole: config.service_role ?? '', description: config.service_description, industries: list('industries'), geographies: list('geographies'), companySize: list('company_size'), operationalComplexity: list('operational_complexity'), version: profile.current_version.version, signals: config.signals.map((signal) => ({ id: signal.id, question: signal.question, positiveCriteria: signal.positive_criteria.join('\n'), exclusions: signal.exclusions.join('\n'), effect: signal.effect, weight: signal.weight, freshnessWindowDays: signal.freshness_window_days })) }
}

function toConfiguration(profile: ProfileDraft): ProfileConfiguration {
  const values = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
  return { service_role: profile.serviceRole, service_description: profile.description, icp: { industries: values(profile.industries), geographies: values(profile.geographies), company_size: profile.companySize, operational_complexity: profile.operationalComplexity }, signals: profile.signals.map((signal) => ({ id: signal.id, question: signal.question, positive_criteria: signal.positiveCriteria.split('\n').map((item) => item.trim()).filter(Boolean), exclusions: signal.exclusions.split('\n').map((item) => item.trim()).filter(Boolean), effect: signal.effect, weight: signal.weight, freshness_window_days: signal.freshnessWindowDays })) }
}
