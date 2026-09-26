import { useState } from 'react'
import type { DataSourcesSnapshot } from '../../api/dataSources'
import { DataSources } from './DataSources'
import { ScoringSettings } from './ScoringSettings'
import './settings.css'

export type SettingsSection = 'general' | 'model' | 'team' | 'notifications' | 'scoring' | 'sources' | 'runtime'
const sections: Array<{ id: SettingsSection; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: '◈' },
  { id: 'model', label: 'Model', icon: '✧' },
  { id: 'team', label: 'Team', icon: '♧' },
  { id: 'notifications', label: 'Notifications', icon: '◉' },
  { id: 'scoring', label: 'Prospect scoring', icon: '≋' },
  { id: 'sources', label: 'Data sources', icon: '▤' },
  { id: 'runtime', label: 'Backend', icon: '⌘' },
]
interface Props {
  section: SettingsSection
  onSection: (section: SettingsSection) => void
  appearance: 'light' | 'dark'
  setAppearance: (value: 'light' | 'dark') => void
  snapshot: DataSourcesSnapshot | null
  loading: boolean
  error: string
  refresh: () => void
  limit: number
  setLimit: (value: number) => void
}
function PreviewNotice() { return <p className="settings-notice">Preview · These controls are not connected yet.</p> }

export function SettingsWorkspace(props: Props) {
  const { section, onSection, appearance, setAppearance, snapshot, error, loading, refresh } = props
  const [visited, setVisited] = useState<SettingsSection[]>([section])
  const runtime = snapshot?.runtime
  return <div className="settings-workspace"><header className="settings-page-header"><span className="settings-eyebrow">Your workspace</span><h1>Settings</h1><p>Workspace preferences, research priorities, and the sources behind your intelligence.</p></header>
    <div className={`settings-layout ${section === 'sources' ? 'settings-wide' : ''}`}><nav aria-label="Settings sections" className="settings-nav">{sections.map((item) => <button key={item.id} aria-current={section === item.id ? 'page' : undefined} onClick={() => { setVisited((current) => current.includes(item.id) ? current : [...current, item.id]); onSection(item.id) }}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav><div className="settings-content">
      <div hidden={section !== 'general'} className="settings-stack"><section className="settings-card"><h2>Workspace</h2><p>The identity of your sales intelligence workspace.</p><PreviewNotice /><fieldset disabled className="settings-stack"><label className="settings-field">Workspace name<input defaultValue="LeadRadar" /></label><label className="settings-field">Workspace slug<input defaultValue="leadradar" /></label><label className="settings-field">Timezone<select defaultValue="browser"><option value="browser">Browser timezone</option></select></label><div><button className="settings-button primary">Save changes</button></div></fieldset></section><section className="settings-card"><h2>Appearance</h2><p>Choose a comfortable workspace. Your preference is saved in this browser.</p><div className="appearance-options">{(['light', 'dark'] as const).map((mode) => <button key={mode} className={`appearance-option ${appearance === mode ? 'selected' : ''}`} aria-pressed={appearance === mode} onClick={() => setAppearance(mode)}><span className={`appearance-preview ${mode}`} aria-hidden="true"><i /><b /><em /></span><span>{mode === 'light' ? 'Light appearance' : 'Dark appearance'}</span><span aria-hidden="true">{appearance === mode ? '✓' : '○'}</span></button>)}</div></section></div>
      {section === 'model' && <section className="settings-card"><div className="settings-heading-row"><h2>Connected model</h2><span className={`settings-badge ${runtime?.assessment_configured ? 'positive' : ''}`}>{!runtime ? 'Unknown' : runtime.assessment_configured ? 'Configured' : 'Not configured'}</span></div><p>Model configuration is currently managed by the server.</p><PreviewNotice /><fieldset disabled className="settings-stack"><label className="settings-field">Provider<select><option>OpenRouter</option></select></label><label className="settings-field">Base URL<input value="https://openrouter.ai/api/v1" readOnly /></label><label className="settings-field">Model<input value={runtime?.assessment_model ?? ''} placeholder={loading ? 'Loading…' : 'Not configured'} readOnly /></label><label className="settings-field">API key<input type="password" value="" placeholder="Managed on the server" readOnly /></label><label className="settings-field">Extra headers<textarea placeholder="Optional headers" /></label><div className="settings-actions"><button className="settings-button">Test connection</button><button className="settings-button primary">Save model</button></div></fieldset>{error && <p role="alert" className="settings-notice error">Model status unavailable. {error}</p>}</section>}
      {section === 'team' && <section className="settings-card"><div className="settings-heading-row"><div><h2>Team</h2><p>Manage members and workspace access.</p></div><button className="settings-button primary" disabled>+ Invite member</button></div><PreviewNotice /><div className="team-table"><span>Member</span><span>Role</span><span>Status</span></div><div className="settings-empty"><strong>Team management is not connected</strong><p>Members and invitations will appear here once accounts are enabled.</p></div></section>}
      {section === 'notifications' && <section className="settings-card"><h2>Notifications</h2><p>Choose the updates that matter to your team.</p><PreviewNotice />{[['A lead reaches the hot band', 'A prospect becomes a high-priority opportunity.'], ['Weekly pipeline digest', 'A summary of new evidence and confirmed signals.'], ['Crawl failures', 'A source stops returning documents.'], ['Product updates', 'Changes to the platform.']].map(([label, hint]) => <label className="notification-row" key={label}><span><strong>{label}</strong><small>{hint}</small></span><input type="checkbox" role="switch" disabled aria-label={label} /></label>)}<p className="settings-small">The topbar bell already shows recorded crawl failures. Notification delivery preferences are a preview.</p></section>}
      {(visited.includes('scoring') || section === 'scoring') && <div hidden={section !== 'scoring'}><ScoringSettings /></div>}
      {section === 'sources' && <DataSources {...props} />}
      {section === 'runtime' && <section className="settings-card"><div className="settings-heading-row"><div><h2>Backend</h2><p>Read-only runtime configuration. Secret values are never displayed.</p></div><button className="settings-button" disabled={loading} onClick={refresh}>Refresh</button></div>{error && <p role="alert" className="settings-notice error">{error}</p>}{!runtime ? <p className="settings-empty">{error ? 'Runtime configuration unavailable.' : 'Loading runtime configuration…'}</p> : <dl className="runtime-details">{[['Assessment model', runtime.assessment_model || 'Not configured'], ['Assessment credentials', runtime.assessment_configured ? 'Configured' : 'Not configured'], ['NewsAPI credentials', runtime.newsapi_configured ? 'Configured' : 'Not configured'], ['JavaScript rendering', runtime.browser_rendering_enabled ? 'Enabled' : 'Disabled'], ['Source text retention', `${runtime.source_text_retention_days} days`], ['Worker concurrency', String(runtime.worker_concurrency)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</section>}
    </div></div></div>
}
