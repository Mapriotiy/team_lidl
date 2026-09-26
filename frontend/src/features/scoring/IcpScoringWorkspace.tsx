import type { IcpCriterion, Profile } from '../../api/profiles'
import { ScoringSettings } from '../settings/ScoringSettings'
import '../settings/settings.css'

const criterionLabel: Record<IcpCriterion['key'], string> = {
  industry: 'Industries',
  geography: 'Regions',
  company_size: 'Company size',
  operational_complexity: 'Operations',
}

function criterionValues(criterion: IcpCriterion) {
  if (criterion.key === 'geography') {
    if (criterion.worldwide) return ['Worldwide']
    return criterion.values.length ? criterion.values : criterion.countries
  }
  if (criterion.key === 'company_size' && criterion.employees) {
    const { minimum, maximum } = criterion.employees
    if (minimum !== null && maximum !== null) return [`${minimum.toLocaleString('en')}–${maximum.toLocaleString('en')} employees`]
    if (minimum !== null) return [`${minimum.toLocaleString('en')}+ employees`]
    if (maximum !== null) return [`Up to ${maximum.toLocaleString('en')} employees`]
  }
  return criterion.values
}

function IdealCustomer({ profile, onEditProfile }: { profile: Profile; onEditProfile: () => void }) {
  const criteria = profile.current_version.icp_criteria.filter((criterion) => criterionValues(criterion).length > 0)
  const signals = profile.current_version.configuration.signals
  const exclusions = signals.filter((signal) => signal.effect === 'disqualifier')
  const penalties = signals.filter((signal) => signal.effect === 'penalty')
  return (
    <section className="settings-card" aria-labelledby="icp-heading">
      <div className="settings-heading-row">
        <div>
          <h2 id="icp-heading">Ideal customer</h2>
          <p>Who {profile.name} is sold to. Companies outside these criteria score lower; unknown facts lower confidence, not the score.</p>
        </div>
        <button type="button" className="settings-button" onClick={onEditProfile}>Edit criteria</button>
      </div>
      {criteria.length === 0 ? (
        <p className="settings-notice">No customer criteria yet, so every company counts as a fit. Add industries, regions or size to sharpen the ranking.</p>
      ) : (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {criteria.map((criterion) => (
            <div key={criterion.key}>
              <dt className="settings-small font-semibold uppercase tracking-wider">{criterionLabel[criterion.key]}</dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {criterionValues(criterion).map((value) => <span key={value} className="settings-badge">{value}</span>)}
                {criterion.include_unknown && <span className="settings-small self-center">unknown allowed</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {(exclusions.length > 0 || penalties.length > 0) && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="settings-small font-semibold uppercase tracking-wider">Warnings &amp; exclusions</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {exclusions.map((signal) => <li key={signal.id}><span className="settings-badge negative">Excludes</span> {signal.question}</li>)}
            {penalties.map((signal) => <li key={signal.id}><span className="settings-badge warning">Lowers score</span> {signal.question}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

export function IcpScoringWorkspace({ onEditProfile }: { onEditProfile: () => void }) {
  return (
    <div className="settings-workspace">
      <header className="settings-page-header">
        <span className="settings-eyebrow">Qualification & prioritization</span>
        <h1>ICP & Scoring</h1>
        <p>Who counts as a good customer, and how much each buying signal moves the score. Scores rank companies within a profile; they are not a probability of purchase.</p>
      </header>
      <ScoringSettings intro={false} renderProfileContext={(profile) => <IdealCustomer profile={profile} onEditProfile={onEditProfile} />} />
    </div>
  )
}
