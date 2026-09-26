import type { OpportunityRecord } from '../../api/opportunities'

export function LeadsFunnel({ leads }: { leads: OpportunityRecord[] }) {
  const withSignal = leads.filter((lead) => lead.strongest_signal !== null).length
  const ready = leads.filter((lead) => lead.eligibility === 'eligible' && lead.status !== 'dismissed').length
  const shortlisted = leads.filter((lead) => lead.status === 'shortlisted').length
  const tiles = [
    { label: 'Researched', value: leads.length, note: 'companies with a score' },
    { label: 'Signal found', value: withSignal, note: 'at least one quoted signal' },
    { label: 'Ready to contact', value: ready, note: 'enough independent evidence' },
    { label: 'Shortlisted', value: shortlisted, note: 'picked by the team' },
  ]
  return (
    <ol aria-label="Lead funnel" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile, index) => (
        <li key={tile.label} className="rounded-2xl border border-[#CFC7BC] bg-white p-5 shadow-[0_8px_28px_rgba(58,45,31,0.06)]">
          <p className="text-sm text-[#625D57]">{tile.label}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[#20242A]">{tile.value}</p>
            {index > 0 && leads.length > 0 && <p className="text-sm font-semibold tabular-nums text-[#625D57]">{Math.round((tile.value / leads.length) * 100)}%</p>}
          </div>
          <p className="mt-2 text-xs text-[#8A847D]">{tile.note}</p>
        </li>
      ))}
    </ol>
  )
}
