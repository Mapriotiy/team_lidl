import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import type { Profile } from '../../api/profiles'
import { ScoringSettings } from './ScoringSettings'

const configuration = {
  service_role: 'RPA developers',
  service_description: 'Automation services',
  icp: { industry: ['Finance'], geography: ['Europe'] },
  signals: [
    { id: 'readiness', question: 'Is there an active programme?', positive_criteria: ['Named programme'], exclusions: [], weight: 20, effect: 'positive' as const, freshness_window_days: 365 },
    { id: 'capability', question: 'Is delivery already covered internally?', positive_criteria: ['Scaled internal team'], exclusions: [], weight: 8, effect: 'penalty' as const, freshness_window_days: 365 },
  ],
}
const profile: Profile = {
  id: 'profile-1', name: 'RPA', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  current_version: { id: 'version-1', version: 1, configuration, icp_criteria: [], created_at: '2026-01-01T00:00:00Z' },
}
const { listProfiles, updateProfile } = vi.hoisted(() => ({
  listProfiles: vi.fn(),
  updateProfile: vi.fn(),
}))
vi.mock('../../api/profiles', async (load) => {
  const actual = await load<typeof import('../../api/profiles')>()
  return { ...actual, listProfiles, updateProfile }
})

beforeEach(() => {
  listProfiles.mockReset().mockResolvedValue([profile])
  updateProfile.mockReset().mockImplementation(async (_id: string, next: typeof configuration) => ({
    ...profile,
    current_version: { ...profile.current_version, id: 'version-2', version: 2, configuration: next },
  }))
})

test('saves a new profile version with only the selected weights changed', async () => {
  render(<ScoringSettings />)
  const weight = await screen.findByRole('spinbutton', { name: 'Weight: Is there an active programme?' })
  fireEvent.change(weight, { target: { value: '35' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save weights' }))

  await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce())
  const [id, saved] = updateProfile.mock.calls[0]
  expect(id).toBe('profile-1')
  expect(saved).toEqual({
    ...configuration,
    signals: [{ ...configuration.signals[0], weight: 35 }, configuration.signals[1]],
  })
  expect(await screen.findByText('Version 2 saved. New research will use these weights.')).toBeInTheDocument()
})

test('refuses to save over a profile version changed elsewhere', async () => {
  listProfiles.mockResolvedValueOnce([profile]).mockResolvedValueOnce([{ ...profile, current_version: { ...profile.current_version, id: 'version-new' } }])
  render(<ScoringSettings />)
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'Weight: Is there an active programme?' }), { target: { value: '35' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save weights' }))

  expect(await screen.findByText(/This profile changed elsewhere/)).toBeInTheDocument()
  expect(updateProfile).not.toHaveBeenCalled()
})
