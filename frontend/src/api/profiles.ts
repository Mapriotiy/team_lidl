import { apiRequest } from './client'

export interface SignalDefinition { id: string; question: string; positive_criteria: string[]; exclusions: string[]; weight: number; effect: 'positive' | 'penalty' | 'disqualifier'; freshness_window_days: number }
export interface IcpEmployeeRange { minimum: number | null; maximum: number | null }
export type IcpCriterionKey = 'industry' | 'geography' | 'company_size' | 'operational_complexity'
/** A profile criterion after the server resolved it: geography arrives as ISO country codes. */
export interface IcpCriterion { key: IcpCriterionKey; values: string[]; countries: string[]; worldwide: boolean; employees: IcpEmployeeRange | null; include_unknown: boolean; unresolved: string[]; note: string | null }
export interface ProfileConfiguration { service_role?: string | null; service_description: string; icp: Record<string, string[] | string | number | boolean | null>; icp_criteria?: IcpCriterion[] | null; signals: SignalDefinition[] }
export interface Profile { id: string; name: string; current_version: { id: string; version: number; configuration: ProfileConfiguration; icp_criteria: IcpCriterion[]; created_at: string }; created_at: string; updated_at: string }

export const selectDefaultProfile = (profiles: Profile[]) =>
  profiles.find((profile) => profile.name.trim().toLowerCase() === 'rpa')
  ?? profiles.find((profile) => profile.name.trim().toLowerCase() === 'process automation')
  ?? profiles[0]

export const listProfiles = (signal?: AbortSignal) => apiRequest<Profile[]>('/service-profiles', { signal })
export const createProfile = (name: string, configuration: ProfileConfiguration) => apiRequest<Profile>('/service-profiles', { method: 'POST', body: JSON.stringify({ name, configuration }) })
export const updateProfile = (id: string, name: string, configuration: ProfileConfiguration) => apiRequest<Profile>(`/service-profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name, configuration }) })
