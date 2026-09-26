import { useEffect, useState } from 'react'
import { searchEuTenders, type EuTendersSearch } from '../../api/euTenders'
import { errorMessage } from '../../api/errors'
import { listProfiles, selectDefaultProfile, type Profile } from '../../api/profiles'
import { Icon } from '../../components/icons'

const shortDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
  : 'Not specified'

export function EuTenderSignals() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState<EuTendersSearch | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void listProfiles(controller.signal).then((items) => {
      if (controller.signal.aborted) return
      setProfiles(items)
      setSelected(selectDefaultProfile(items)?.id ?? '')
    }).catch((reason) => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [])

  async function search() {
    if (!selected || loading) return
    setLoading(true); setError(''); setResult(null)
    try { setResult(await searchEuTenders(selected)) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setLoading(false) }
  }

  return <section className="settings-card tender-signals">
    <div className="settings-heading-row"><div><span className="settings-eyebrow">Market demand</span><h3>EU tender signals</h3><p>Find open and forthcoming EU calls related to a service profile.</p></div><Icon name="landmark" width="24" height="24" /></div>
    <p className="settings-notice">These calls show demand in a service area. They do not name or qualify companies and are never treated as company evidence.</p>
    <div className="tender-controls"><label className="settings-field">Service profile<select aria-label="EU tender service profile" disabled={loading || !profiles?.length} value={selected} onChange={(event) => { setSelected(event.target.value); setResult(null); setError('') }}>{profiles?.map((profile) => <option value={profile.id} key={profile.id}>{profile.name} · v{profile.current_version.version}</option>)}</select></label><button className="settings-button primary" disabled={!selected || loading} onClick={() => void search()}>{loading ? 'Searching…' : 'Find matching calls'}</button></div>
    {!profiles && !error && <p role="status" className="settings-empty">Loading service profiles…</p>}
    {profiles?.length === 0 && <p className="settings-empty">Create a service profile before searching EU calls.</p>}
    {error && <p role="alert" className="settings-notice error">Could not search EU calls. {error}</p>}
    {result && <div className="tender-results"><div className="settings-heading-row"><div><h3>{result.calls.length} matching calls</h3><p>Query: {result.query} · {result.total} results reported by the portal</p></div><time className="settings-small" dateTime={result.retrieved_at}>Retrieved {shortDate(result.retrieved_at)}</time></div>
      {result.calls.length === 0 ? <p className="settings-empty">No matching open or forthcoming calls were returned.</p> : <div className="tender-list">{result.calls.map((call) => <article key={call.identifier}><div><span className={`settings-badge ${call.status === 'open' ? 'positive' : 'warning'}`}>{call.status}</span>{call.programme && <span className="settings-small">{call.programme}</span>}</div><a href={call.url} target="_blank" rel="noreferrer">{call.title}</a>{call.summary && <p>{call.summary}</p>}<p className="settings-small">Deadline: {shortDate(call.deadline)}</p></article>)}</div>}
    </div>}
  </section>
}
