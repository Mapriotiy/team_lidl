import { useMemo, useState } from 'react'
import type { Assessment, CompanyDetail } from '../companies/types'

type Selection = { companyId: string; question: string }

const latestRun = (company: CompanyDetail) => [...company.researchRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
const sources = (company: CompanyDetail) => new Set(company.sources?.map((source) => source.id) ?? company.evidence.map((item) => item.sourceId)).size
const canCompare = (company: CompanyDetail) => {
  const run = latestRun(company)
  return Boolean(run && run.status !== 'queued' && run.status !== 'running' && run.status !== 'failed' && sources(company) >= 2 && run.assessmentTotal > 0 && run.assessed >= run.assessmentTotal && !company.exclusions?.length)
}
const presentation = (assessment?: Assessment) => {
  if (!assessment || assessment.status === 'insufficient_evidence') return { label: 'Unknown', symbol: '?', tone: 'bg-[#E5E1DA] text-[#6F6961]' }
  if (assessment.status === 'contradicted') return { label: 'Counter-signal', symbol: '!', tone: 'bg-[#A54B3C] text-white' }
  if (assessment.strength === 'strong') return { label: 'Strong', symbol: '✓', tone: 'bg-[#278655] text-white' }
  return { label: assessment.strength === 'moderate' ? 'Moderate' : 'Early', symbol: '◐', tone: 'bg-[#397EAA] text-white' }
}

export function SignalHeatmap({ companies, onOpen }: { companies: CompanyDetail[]; onOpen: (company: CompanyDetail) => void }) {
  const comparable = useMemo(() => companies.filter(canCompare), [companies])
  const questions = useMemo(() => [...new Set(comparable.flatMap((company) => company.assessments.map((assessment) => assessment.question)))], [comparable])
  const first = comparable.flatMap((company) => company.assessments.map((assessment) => ({ companyId: company.id, question: assessment.question, supported: assessment.status === 'supported' }))).sort((a, b) => Number(b.supported) - Number(a.supported))[0]
  const [selection, setSelection] = useState<Selection | null>(first ? { companyId: first.companyId, question: first.question } : null)
  const selectedCompany = comparable.find((company) => company.id === selection?.companyId)
  const selectedAssessment = selectedCompany?.assessments.find((assessment) => assessment.question === selection?.question)
  const selectedEvidence = selectedAssessment?.evidenceIds.flatMap((id) => selectedCompany?.evidence.find((item) => item.id === id) ?? []) ?? []
  const selectedPresentation = presentation(selectedAssessment)
  const omitted = companies.length - comparable.length

  return <section aria-label="Signal heatmap" className="mt-6 rounded-2xl border border-[#D8D1C7] bg-white p-4 shadow-[0_8px_28px_rgba(58,45,31,0.07)] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C94F12]">Opportunity signals</p>
        <h2 className="mt-1 text-xl font-semibold text-[#292D32]">Where the evidence is strongest</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68645F]">Compare verified buying signals, then select a square to inspect the evidence.</p>
      </div>
      <span className="rounded-full bg-[#F2EEE8] px-3 py-1 text-xs font-semibold">{comparable.length} compared{omitted ? ` · ${omitted} omitted` : ''}</span>
    </div>
    {!comparable.length || !questions.length ? <div className="mt-5 rounded-xl border border-dashed border-[#CEC7BD] bg-[#FAF8F5] p-8 text-center text-sm text-[#68645F]">No companies have enough completed research to compare yet.</div> : <div className="mt-5">
      <div className="rounded-xl border border-[#E3DDD5] bg-[#FCFBF8] p-1.5 sm:p-2">
        <table className="w-full table-fixed border-separate border-spacing-0.5 text-left" aria-label="Companies by researched signal">
          <thead><tr><th className="w-[34%] px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#68645F] sm:w-48">Company</th>{questions.map((question, index) => <th className="px-0.5 pb-1 text-center text-[9px] font-bold text-[#625D57]" key={question} scope="col"><span aria-label={`Signal ${index + 1}: ${question}`} className="group relative inline-grid size-6 cursor-help place-items-center rounded-md outline-none hover:bg-[#EEE8E0] focus-visible:ring-2 focus-visible:ring-[#D65A1B]" tabIndex={0}>S{index + 1}<span className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-64 -translate-x-1/2 rounded-lg bg-[#292D32] p-2.5 text-left text-xs font-medium leading-4 text-white shadow-xl group-hover:block group-focus:block">{question}</span></span></th>)}</tr></thead>
          <tbody>{comparable.map((company) => <tr key={company.id}><th className="px-1.5 py-1"><span className="block truncate text-xs font-semibold text-[#292D32]" title={company.name}>{company.name}</span><span className="block truncate text-[9px] font-normal text-[#716C65]">ICP {Math.round(company.icpFit * 100)}% · {Math.round(company.score)} pts</span></th>{questions.map((question) => {
            const assessment = company.assessments.find((item) => item.question === question)
            const cell = presentation(assessment)
            const sourceTotal = new Set((assessment?.evidenceIds ?? []).flatMap((id) => company.evidence.find((item) => item.id === id)?.sourceId ?? [])).size
            const active = selection?.companyId === company.id && selection.question === question
            return <td className="h-9 p-px sm:h-10" key={question}><button aria-label={`${company.name}, ${question}: ${cell.label}, ${sourceTotal} supporting sources`} aria-pressed={active} className={`relative grid size-full min-h-8 place-items-center rounded-md text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D65A1B] focus-visible:ring-offset-1 ${cell.tone} ${active ? 'ring-2 ring-[#D65A1B] ring-offset-1' : ''}`} onClick={() => setSelection({ companyId: company.id, question })} type="button"><span>{cell.symbol}</span><span className="absolute bottom-0.5 right-1 text-[8px] font-semibold opacity-90">{sourceTotal}</span></button></td>
          })}</tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#68645F]">{[['bg-[#278655]', 'Strong'], ['bg-[#397EAA]', 'Moderate / early'], ['bg-[#A54B3C]', 'Counter-signal'], ['bg-[#E5E1DA]', 'Unknown']].map(([tone, label]) => <span className="flex items-center gap-1.5" key={label}><i className={`size-2.5 rounded-sm ${tone}`} />{label}</span>)}<span className="sm:ml-auto">Small number = sources</span></div>
      {selectedCompany && selection && <aside aria-live="polite" className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--foreground)] shadow-sm sm:p-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${selectedPresentation.tone}`}>{selectedPresentation.label}</span><h3 className="mt-3 text-lg font-semibold">{selectedCompany.name}</h3><p className="mt-1 text-sm font-medium leading-5 text-[var(--muted-foreground)]">{selection.question}</p><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{selectedAssessment?.interpretation ?? 'This signal was not assessed for this company.'}</p><button className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] transition hover:brightness-90" onClick={() => onOpen(selectedCompany)} type="button">Open full evidence →</button></div><div>{selectedEvidence.length > 0 ? <div className="grid gap-2 sm:grid-cols-3">{selectedEvidence.slice(0, 3).map((item) => <article className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" key={item.id}><p className="text-xs font-semibold leading-5 text-[var(--foreground)]">{item.factualClaim}</p><p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{item.sourceTitle} · {item.publicationDate ?? 'date unavailable'}</p></article>)}</div> : <p className="rounded-lg bg-[var(--muted)] p-4 text-xs text-[var(--muted-foreground)]">No verified supporting fact is attached to this result.</p>}</div></div></aside>}
    </div>}
    {omitted > 0 && <p className="mt-4 text-xs leading-5 text-[#716C65]">Companies with insufficient sources, incomplete or failed assessment, active research, or a disqualification are omitted from this comparison.</p>}
  </section>
}
