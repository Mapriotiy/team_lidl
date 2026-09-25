export type FactState = 'known' | 'unknown'
export type AssessmentStatus = 'supported' | 'contradicted' | 'insufficient_evidence'
export type EvidenceStrength = 'strong' | 'moderate' | 'weak'

export interface CompanyFact { label: string; value: string | null; state: FactState; sourceIds: string[] }
export interface Evidence { id: string; sourceId: string; sourceTitle: string; sourceUrl: string; sourceType: string; publicationDate: string | null; excerpt: string; factualClaim: string }
export interface Assessment { id: string; question: string; status: AssessmentStatus; strength: EvidenceStrength | null; interpretation: string; evidenceIds: string[] }
export interface Contribution { signal: string; effect: 'positive' | 'penalty'; points: number; evidenceIds: string[] }
export interface ResearchRun { id: string; status: 'completed' | 'partial' | 'failed'; startedAt: string; finishedAt: string; collected: number; assessed: number; warning: string | null }
export interface CompanyDetail { id: string; name: string; domain: string; aliases: string[]; profileName: string; score: number; coverage: number; eligibility: string; facts: CompanyFact[]; evidence: Evidence[]; assessments: Assessment[]; contributions: Contribution[]; researchRuns: ResearchRun[] }
