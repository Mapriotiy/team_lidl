import type { EuTendersSearch } from '../../api/euTenders'
import snapshot from './preseededTenders.json'

type TenderSource = 'all' | 'eu' | 'moldova'
type ProfileSnapshot = { eu: EuTendersSearch; moldova: EuTendersSearch }

const snapshots = snapshot as Record<string, ProfileSnapshot>

export function preseededTenderResults(
  profileId: string,
  profileName: string,
  source: TenderSource,
): EuTendersSearch[] {
  const profile = snapshots[profileName]
  if (!profile) return []
  const results = source === 'all' ? [profile.eu, profile.moldova] : [profile[source]]
  return results.map((result) => ({ ...result, profile_id: profileId, profile_name: profileName }))
}
