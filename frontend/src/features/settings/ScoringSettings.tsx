import { useEffect, useState, type ReactNode } from 'react'
import { listProfiles, selectDefaultProfile, updateProfile, type Profile } from '../../api/profiles'
import { errorMessage } from '../../api/errors'

export function ScoringSettings({ renderProfileContext, intro = true }: { renderProfileContext?: (profile: Profile) => ReactNode; intro?: boolean } = {}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [selected, setSelected] = useState('')
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    void listProfiles(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setProfiles(items)
      setSelected(selectDefaultProfile(items)?.id ?? '')
      setWeights({})
    }).catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [revision])
  const profile = profiles?.find((item) => item.id === selected)
  const signals = profile?.current_version.configuration.signals ?? []
  const positives = signals.filter((signal) => signal.effect === 'positive')
  const weightOf = (signal: { id: string; weight: number }) => weights[signal.id] ?? signal.weight
  const positiveTotal = positives.reduce((sum, signal) => sum + weightOf(signal), 0)
  const dirty = signals.some((signal) => weightOf(signal) !== signal.weight)
  const invalid = signals.some((signal) => !Number.isFinite(weightOf(signal)) || weightOf(signal) < 0) || positiveTotal <= 0
  async function save() {
    if (!profile || invalid || saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      // Refuse to overwrite a version saved elsewhere while this editor was open.
      const latest = (await listProfiles()).find((item) => item.id === profile.id)
      if (!latest || latest.current_version.id !== profile.current_version.id) throw new Error('This profile changed elsewhere. Reload profiles before saving your weights.')
      const saved = await updateProfile(profile.id, {
        ...profile.current_version.configuration,
        signals: signals.map((signal) => ({ ...signal, weight: weightOf(signal) })),
      })
      setProfiles((current) => current?.map((item) => item.id === saved.id ? saved : item) ?? null)
      setWeights({})
      setNotice(`Version ${saved.current_version.version} saved. New research will use these weights.`)
    } catch (reason) { setError(errorMessage(reason)) }
    finally { setSaving(false) }
  }
  return <div className="settings-stack">
    {intro && <section className="settings-card scoring-intro"><span className="settings-eyebrow">Qualification & prioritization</span><h2>Dynamic prospect scoring</h2><p>Prioritize prospects by the signals that matter to your service, their readiness, and the strength of the evidence.</p><p className="settings-small">Scores rank opportunities within a profile. They are not a measured probability of purchase.</p></section>}
    {error && <div role="alert" className="settings-notice error">{error} <button className="settings-link" disabled={saving} onClick={() => setRevision((value) => value + 1)}>Reload profiles</button></div>}
    {notice && <div role="status" className="settings-notice">{notice}</div>}
    {!profiles && !error && <p role="status" className="settings-empty">Loading scoring profiles…</p>}
    {profiles?.length === 0 && <p className="settings-empty">Create a service profile to configure its weights.</p>}
    {profile && renderProfileContext && <section className="settings-card"><div className="settings-heading-row"><label className="settings-field">Service profile<select aria-label="Scoring service profile" disabled={saving || dirty} value={selected} onChange={(event) => { setSelected(event.target.value); setWeights({}); setNotice(''); setError('') }}>{profiles?.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.current_version.version}</option>)}</select></label><span className="settings-badge">{signals.length} rules</span></div></section>}
    {profile && renderProfileContext?.(profile)}
    {profile && <section className="settings-card">{!renderProfileContext && <div className="settings-heading-row"><label className="settings-field">Service profile<select aria-label="Scoring service profile" disabled={saving || dirty} value={selected} onChange={(event) => { setSelected(event.target.value); setWeights({}); setNotice(''); setError('') }}>{profiles?.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.current_version.version}</option>)}</select></label><span className="settings-badge">{signals.length} rules</span></div>}{renderProfileContext && <div><h2>Signal weights</h2><p>How much each buying signal adds to the score. Only signals backed by quoted evidence count.</p></div>}
      {dirty && <p className="settings-small">Save or reset your changes before switching profiles.</p>}
      <div className="weight-list">{signals.map((signal) => <div className="weight-row" key={signal.id}><div className="settings-heading-row"><label htmlFor={`weight-${signal.id}`}>{signal.question}</label><span className={`settings-badge ${signal.effect === 'positive' ? 'positive' : signal.effect === 'penalty' ? 'warning' : 'negative'}`}>{signal.effect === 'positive' ? 'Buying signal' : signal.effect === 'penalty' ? 'Penalty' : 'Disqualifier'}</span></div>{signal.effect === 'disqualifier' ? <p className="settings-small">A supported disqualifier excludes a company. Its effect does not depend on weight.</p> : <div className="weight-control"><input id={`weight-${signal.id}`} type="range" min="0" max={Math.max(100, signal.weight, weightOf(signal))} step="1" disabled={saving} value={weightOf(signal)} onChange={(event) => { setWeights({ ...weights, [signal.id]: Number(event.target.value) }); setNotice('') }} /><input aria-label={`Weight: ${signal.question}`} type="number" min="0" step="any" disabled={saving} value={weightOf(signal)} onChange={(event) => { setWeights({ ...weights, [signal.id]: Number(event.target.value) }); setNotice('') }} /><span className="settings-small">{signal.effect === 'positive' && positiveTotal > 0 ? `${Math.round(weightOf(signal) / positiveTotal * 100)}% of positive weight` : 'Penalty weight'}</span></div>}</div>)}</div>
      <div className="weight-summary"><strong>Positive signal weight distribution</strong><div className="weight-distribution" aria-hidden="true">{positives.map((signal, index) => <span key={signal.id} title={`${signal.question}: ${weightOf(signal)}`} style={{ flex: weightOf(signal), background: ['#E86722', '#B86338', '#608773', '#698FAC', '#AA8B4E'][index % 5] }} />)}</div><p className="settings-small">Relative weights only. Actual scoring also considers evidence, freshness, ICP fit, penalties, and exclusions.</p></div>
      {invalid && <p role="alert" className="settings-notice error">Use non-negative weights and keep at least one positive signal above zero.</p>}
      <div className="settings-footer"><p className="settings-small">Saving creates a new profile version. Existing research and scores stay attached to their original version.</p><button className="settings-button" disabled={!dirty || saving} onClick={() => { setWeights({}); setError(''); setNotice('') }}>Reset</button><button className="settings-button primary" disabled={!dirty || saving || invalid} onClick={() => void save()}>{saving ? 'Saving…' : 'Save weights'}</button></div>
    </section>}
  </div>
}
