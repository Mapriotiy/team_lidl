import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCompanies } from '../api/research'
import { listProfiles, type Profile } from '../api/profiles'
import { TopBar, type TopBarProps } from './TopBar'
vi.mock('../api/research', () => ({ listCompanies: vi.fn() }))
vi.mock('../api/profiles', () => ({ listProfiles: vi.fn() }))
const props = (): TopBarProps => ({
  viewLabel: 'Research', screens: [{ id: 'profiles', label: 'Service Profile' }, { id: 'discovery', label: 'Discover companies', disabled: true }, { id: 'settings', label: 'Settings' }],
  onNavigate: vi.fn(), onOpenCompany: vi.fn(), onOpenSources: vi.fn(), onOpenSetting: vi.fn(), appearance: 'light', setAppearance: vi.fn(), notifications: { loading: false, failures: [], entryCount: 0 },
})
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listCompanies).mockResolvedValue([]); vi.mocked(listProfiles).mockResolvedValue([]) })
describe('TopBar', () => {
  it('opens by shortcut, skips locked screens and navigates by keyboard', async () => {
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    expect(listCompanies).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByRole('combobox', { name: 'Search companies or screens' })
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByRole('option', { name: /Discover companies/ })).toBeDisabled()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(callbacks.onNavigate).toHaveBeenCalledWith('settings')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search companies and screens' })).toHaveFocus()
  })
  it('searches persisted companies by domain and opens the chosen company', async () => {
    vi.mocked(listCompanies).mockResolvedValue([{ id: 'company-42', canonical_domain: 'example.com', display_name: 'Example Ltd', aliases: [], industry: null, geography: null, company_size: null, operational_complexity: null }])
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    await screen.findByRole('option', { name: 'Example Ltd example.com' })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(callbacks.onOpenCompany).toHaveBeenCalledWith('company-42')
    expect(callbacks.onNavigate).not.toHaveBeenCalled()
  })
  it('reports company API failure while keeping screen navigation usable', async () => {
    vi.mocked(listCompanies).mockRejectedValue(new Error('Network is offline'))
    render(<TopBar {...props()} />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(await screen.findByRole('alert')).toHaveTextContent('Company search is unavailable. Network is offline')
    expect(screen.getByRole('option', { name: 'Settings' })).toBeEnabled()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('keeps focus inside the palette and restores it on dismissal', async () => {
    render(<TopBar {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    const input = screen.getByRole('combobox')
    await act(async () => { fireEvent.keyDown(input, { key: 'Tab', shiftKey: true }) })
    expect(screen.getByRole('option', { name: 'EU Tenders' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Search companies and screens' })).toHaveFocus()
  })
  it('does not portray unavailable notifications as successful collection', () => {
    render(<TopBar {...props()} notifications={{ loading: false, error: 'API unavailable', failures: [], entryCount: 0 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crawl notifications unavailable' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Crawl notifications are unavailable. API unavailable')
    expect(screen.queryByText(/No problems|No source attempts/)).not.toBeInTheDocument()
  })
  it('shows recorded failures and opens Data sources', () => {
    const callbacks = props()
    render(<TopBar {...callbacks} notifications={{ loading: false, entryCount: 2, failures: [{ id: 'attempt-1', sourceName: 'GDELT', detail: 'Provider timed out; NewsAPI also queried.' }] }} />)
    fireEvent.click(screen.getByRole('button', { name: '1 recorded crawl problems' }))
    expect(screen.getByText('GDELT')).toBeInTheDocument()
    expect(screen.getByText('Provider timed out; NewsAPI also queried.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Data sources' }))
    expect(callbacks.onOpenSources).toHaveBeenCalledOnce()
    expect(screen.queryByRole('region', { name: 'Crawl notifications' })).not.toBeInTheDocument()
  })
  it('provides a theme toggle without adding a service selector', () => {
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark appearance' }))
    expect(callbacks.setAppearance).toHaveBeenCalledWith('dark')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

const savedProfile: Profile = {
  id: 'profile-security', name: 'Cybersecurity', created_at: '2026-09-26', updated_at: '2026-09-26',
  current_version: { id: 'version-2', version: 2, created_at: '2026-09-26', icp_criteria: [], configuration: { service_description: 'Security incident response', service_role: 'Cybersecurity', icp: {}, signals: [] } },
}

describe('global search destinations', () => {
  it.each([
    ['dark theme', 'general'], ['readiness weights', 'scoring'], ['llm credentials', 'model'],
    ['invite members', 'team'], ['digest', 'notifications'], ['worker retention', 'runtime'], ['crawl log', 'sources'],
  ])('opens the settings section matching "%s"', async (query, section) => {
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    const input = screen.getByRole('combobox')
    await act(async () => fireEvent.change(input, { target: { value: query } }))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(callbacks.onOpenSetting).toHaveBeenCalledWith(section)
    expect(callbacks.onNavigate).not.toHaveBeenCalled()
  })

  it.each(['GDELT', 'NewsAPI', 'Public websites', 'EU Tenders'])('opens Data sources for %s without claiming provider health', async (name) => {
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    await act(async () => fireEvent.change(screen.getByRole('combobox'), { target: { value: name } }))
    const option = screen.getByRole('option', { name })
    expect(option).toHaveTextContent('Open Data sources')
    expect(option).not.toHaveTextContent(/healthy|enabled|configured/i)
    fireEvent.click(option)
    expect(callbacks.onOpenSetting).toHaveBeenCalledWith('sources')
  })

  it('finds persisted profiles by description and opens the existing profile workspace', async () => {
    vi.mocked(listProfiles).mockResolvedValue([savedProfile])
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    expect(listProfiles).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    await screen.findByRole('option', { name: 'Profile: Cybersecurity' })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'incident response' } })
    const option = screen.getByRole('option', { name: 'Profile: Cybersecurity' })
    expect(option).toHaveTextContent('Open service profile workspace')
    fireEvent.click(option)
    expect(callbacks.onNavigate).toHaveBeenCalledWith('profiles')
  })

  it('keeps settings and company search available if profile loading fails', async () => {
    vi.mocked(listProfiles).mockRejectedValue(new Error('Profile API unavailable'))
    vi.mocked(listCompanies).mockResolvedValue([{ id: 'company-42', canonical_domain: 'example.com', display_name: 'Example Ltd', aliases: ['Legacy Example'], industry: null, geography: null, company_size: null, operational_complexity: null }])
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Profile search is unavailable. Profile API unavailable')
    expect(screen.getByRole('option', { name: 'Prospect scoring' })).toBeEnabled()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'legacy example' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(callbacks.onOpenCompany).toHaveBeenCalledWith('company-42')
  })

  it('keeps the keyboard selection stable when another result group finishes loading', async () => {
    let finishProfiles: (items: Profile[]) => void = () => {}
    vi.mocked(listProfiles).mockReturnValue(new Promise((resolve) => { finishProfiles = resolve }))
    vi.mocked(listCompanies).mockResolvedValue([{ id: 'security-company', canonical_domain: 'security.example', display_name: 'Security Company', aliases: [], industry: null, geography: null, company_size: null, operational_complexity: null }])
    const callbacks = props()
    render(<TopBar {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    await screen.findByRole('option', { name: 'Security Company security.example' })
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'security' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await act(async () => finishProfiles([savedProfile]))
    expect(input).toHaveAttribute('aria-activedescendant', 'company-security-company')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(callbacks.onOpenCompany).toHaveBeenCalledWith('security-company')
  })

  it('cancels both API requests when search is dismissed', async () => {
    vi.mocked(listProfiles).mockImplementation(() => new Promise(() => {}))
    vi.mocked(listCompanies).mockImplementation(() => new Promise(() => {}))
    render(<TopBar {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search companies and screens' }))
    const companySignal = vi.mocked(listCompanies).mock.calls[0][0]
    const profileSignal = vi.mocked(listProfiles).mock.calls[0][0]
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(companySignal?.aborted).toBe(true)
    expect(profileSignal?.aborted).toBe(true)
  })
})
