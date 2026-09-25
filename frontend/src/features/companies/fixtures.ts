import type { CompanyDetail } from './types'

export const companyFixture: CompanyDetail = {
  id: 'company-lufthansa', name: 'Lufthansa Group', domain: 'lufthansagroup.com', aliases: ['Deutsche Lufthansa AG'], profileName: 'Process automation', score: 86, coverage: 0.88, eligibility: 'Eligible',
  facts: [
    { label: 'Industry', value: 'Aviation', state: 'known', sourceIds: ['source-report'] },
    { label: 'Geography', value: 'Germany', state: 'known', sourceIds: ['source-report'] },
    { label: 'Company size', value: '100,000+ employees', state: 'known', sourceIds: ['source-report'] },
    { label: 'Operational complexity', value: null, state: 'unknown', sourceIds: [] },
  ],
  evidence: [
    { id: 'evidence-efficiency', sourceId: 'source-newsroom', sourceTitle: 'Lufthansa Group outlines efficiency programme', sourceUrl: 'https://example.com/lufthansa/efficiency', sourceType: 'Company newsroom', publicationDate: '2026-08-14', excerpt: 'The Group announced a two-year operational-efficiency programme focused on simplifying shared processes.', factualClaim: 'The company announced a two-year operational-efficiency programme.' },
    { id: 'evidence-capability', sourceId: 'source-careers', sourceTitle: 'Automation centre of excellence roles', sourceUrl: 'https://example.com/lufthansa/careers', sourceType: 'Careers', publicationDate: '2026-07-03', excerpt: 'The automation centre of excellence will expand its internal delivery team across the Group.', factualClaim: 'The company is expanding an internal automation delivery team.' },
    { id: 'evidence-report', sourceId: 'source-report', sourceTitle: 'Annual report 2025', sourceUrl: 'https://example.com/lufthansa/report', sourceType: 'Annual report', publicationDate: '2026-03-12', excerpt: 'Deutsche Lufthansa AG is headquartered in Cologne, Germany, and operates a global aviation group.', factualClaim: 'The company is a German aviation group.' },
  ],
  assessments: [
    { id: 'assessment-efficiency', question: 'Is there a current operational-efficiency program?', status: 'supported', strength: 'strong', interpretation: 'The named, dated programme suggests active investment in process change.', evidenceIds: ['evidence-efficiency'] },
    { id: 'assessment-capability', question: 'Does the company have strong internal automation capability?', status: 'supported', strength: 'moderate', interpretation: 'Internal delivery strength may reduce the need for an external partner.', evidenceIds: ['evidence-capability'] },
    { id: 'assessment-incumbent', question: 'Is an exclusive incumbent partner confirmed?', status: 'insufficient_evidence', strength: null, interpretation: 'No reliable public source confirms an exclusive current agreement.', evidenceIds: [] },
  ],
  contributions: [
    { signal: 'Operational-efficiency programme', effect: 'positive', points: 18, evidenceIds: ['evidence-efficiency'] },
    { signal: 'Strong internal capability', effect: 'penalty', points: -4.8, evidenceIds: ['evidence-capability'] },
  ],
  researchRuns: [
    { id: 'run-2026-09-25', status: 'partial', startedAt: '2026-09-25T14:36:00Z', finishedAt: '2026-09-25T14:42:00Z', collected: 7, assessed: 5, warning: 'One careers page was blocked; completed sources were retained.' },
    { id: 'run-2026-09-18', status: 'completed', startedAt: '2026-09-18T09:10:00Z', finishedAt: '2026-09-18T09:17:00Z', collected: 6, assessed: 5, warning: null },
  ],
}
