import type { SettingsSection } from '../features/settings/SettingsWorkspace'

interface SettingsDestination {
  id: SettingsSection
  label: string
  keywords: string
}

export const settingsDestinations: SettingsDestination[] = [
  { id: 'general', label: 'General & appearance', keywords: 'workspace name slug timezone theme light dark preferences' },
  { id: 'model', label: 'Connected model', keywords: 'ai llm openrouter provider model api key credentials' },
  { id: 'team', label: 'Team', keywords: 'members invitations invite access roles users' },
  { id: 'notifications', label: 'Notifications', keywords: 'alerts digest email crawl failures updates preferences' },
  { id: 'scoring', label: 'ICP & Scoring', keywords: 'icp ideal customer industry geography company size dynamic weights signals readiness likelihood buy buying prioritize penalties disqualification rules' },
  { id: 'sources', label: 'Data sources & crawl log', keywords: 'collection providers attempts errors failures websites news fallback' },
  { id: 'runtime', label: 'Backend runtime', keywords: 'worker concurrency retention rendering configuration server' },
]

// These are navigation shortcuts to supported source integrations, not claims
// that a provider is configured, enabled, healthy, or has returned results.
export const sourceDestinations = [
  { id: 'gdelt', label: 'GDELT', keywords: 'news articles global events' },
  { id: 'newsapi', label: 'NewsAPI', keywords: 'news articles supplementary fallback' },
  { id: 'websites', label: 'Public websites', keywords: 'company websites pages careers newsroom reports playwright crawl' },
  { id: 'eu-tenders', label: 'EU Tenders', keywords: 'tenders procurement contracts ted cpv market signals' },
]

export const screenKeywords: Record<string, string> = {
  profiles: 'service profile icp ideal customer industry geography company size criteria',
  discovery: 'discover companies find leads import domains catalogue catalog',
  activity: 'research companies evidence facts signals results outreach gmail email',
  settings: 'settings configuration preferences',
}

export function matchesSearch(query: string, text: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const candidate = text.toLocaleLowerCase()
  return terms.every((term) => candidate.includes(term))
}
