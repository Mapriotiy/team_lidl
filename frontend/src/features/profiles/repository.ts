import { profileFixture } from './fixtures'
import type { ProfileDraft } from './types'

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function getProfile(): Promise<ProfileDraft> {
  await delay(100)
  return structuredClone(profileFixture)
}

export async function saveProfile(profile: ProfileDraft): Promise<ProfileDraft> {
  await delay(180)
  return structuredClone(profile)
}
