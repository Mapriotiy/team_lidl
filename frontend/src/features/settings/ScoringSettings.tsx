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
    {profile && <section className="settings-card signal-questions-card"><div className="settings-heading-row"><div>{renderProfileContext ? <><h2>Signal questions</h2><p>The questions asked during every company assessment. Adjust their scoring weight without changing how research works.</p></> : <label className="settings-field">Service profile<select aria-label="Scoring service profile" disabled={saving || dirty} value={selected} onChange={(event) => { setSelected(event.target.value); setWeights({}); setNotice(''); setError('') }}>{profiles?.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.current_version.version}</option>)}</select></label>}</div><span className="settings-badge">{signals.length} questions</span></div>
      {dirty && <p className="settings-small">Save or reset your changes before switching profiles.</p>}
      <div className="signal-question-table-wrap"><table className="signal-question-table"><caption className="sr-only">Signal questions and their scoring weights</caption><thead><tr><th scope="col">Question</th><th scope="col">Type</th><th scope="col">Weight</th><th scope="col">Freshness</th></tr></thead><tbody>{signals.map((signal) => {
        const effectLabel = signal.effect === 'positive' ? 'Buying signal' : signal.effect === 'penalty' ? 'Penalty' : 'Disqualifier'
        return <tr key={signal.id}><td><span className="signal-question-key">{signal.id}</span><span className="signal-question-copy">{signal.question}</span></td><td><span className={`settings-badge ${signal.effect === 'positive' ? 'positive' : signal.effect === 'penalty' ? 'warning' : 'negative'}`}>{effectLabel}</span></td><td>{signal.effect === 'disqualifier' ? <span className="settings-small">Overrides score</span> : <div className="signal-weight-editor"><input id={`weight-${signal.id}`} type="range" min="0" max={Math.max(100, signal.weight, weightOf(signal))} step="1" disabled={saving} value={weightOf(signal)} onChange={(event) => { setWeights({ ...weights, [signal.id]: Number(event.target.value) }); setNotice('') }} /><input aria-label={`Weight: ${signal.question}`} type="number" min="0" step="any" disabled={saving} value={weightOf(signal)} onChange={(event) => { setWeights({ ...weights, [signal.id]: Number(event.target.value) }); setNotice('') }} />{signal.effect === 'positive' && positiveTotal > 0 && <span className="settings-small">{Math.round(weightOf(signal) / positiveTotal * 100)}%</span>}</div>}</td><td><span className="signal-freshness">{signal.freshness_window_days} days</span></td></tr>
      })}</tbody></table>{signals.length === 0 && <p className="settings-empty">No signal questions are configured for this profile.</p>}</div>
      {invalid && <p role="alert" className="settings-notice error">Use non-negative weights and keep at least one positive signal above zero.</p>}
      <div className="settings-footer"><p className="settings-small">Saving creates a new profile version. Existing research and scores stay attached to their original version.</p><button className="settings-button" disabled={!dirty || saving} onClick={() => { setWeights({}); setError(''); setNotice('') }}>Reset</button><button className="settings-button primary" disabled={!dirty || saving || invalid} onClick={() => void save()}>{saving ? 'Saving…' : 'Save weights'}</button></div>
    </section>}
  </div>
}
