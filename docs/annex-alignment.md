# Participant Reference Pack alignment

## Source role

The supplied `Annex 1: Participant Reference Pack` describes the current manual sales process and gives illustrative Intelligent Automation examples. It is a product reference, not an account-research fixture and not evidence that may be cited for a live opportunity.

## Requirement traceability

| Annex content | Product response | Planned ownership |
| --- | --- | --- |
| Define an ICP using geography, industry, size, operational complexity and other criteria | Versioned service profiles contain editable ICP criteria and preserve unknown values | R3 contract; R1 editor |
| Build a target-account list | Domain import is P0; bounded discovery is P1 and requires candidate confirmation | R3 import; R4 discovery |
| Research public sources | Collection adapters store canonical URLs, dates, hashes and permitted text | R4 |
| Monitor signals | Background runs expose collection and assessment progress without fabricated percentages | R3 jobs; R2 activity UI |
| Judge relevance, recency, strength and direction | Assessments store status and evidence strength; scoring applies freshness, positive effects, penalties and disqualifiers | R5 assessment; R3 scorer |
| Prioritize accounts | Opportunities are ranked within one immutable profile version and remain explainable | R3 API; R1 UI |

## Intelligent Automation signal coverage

The initial Process automation preset must be capable of representing every signal family named in the Annex:

- cost reduction and operational-efficiency programs;
- digital-transformation initiatives;
- AI, RPA, Agentic AI and process-mining projects;
- relevant hiring activity;
- executive appointments;
- shared-service or process-consolidation initiatives;
- technologies already in use;
- existing technology partners.

These are configurable questions, not hard-coded scoring rules. A signal may be positive, a penalty, or a disqualifier. Internal automation maturity, strong internal delivery capability, or incumbent providers may reduce the priority even when they also demonstrate budget and interest.

## Example handling

The Lufthansa Group and DHL Group examples demonstrate mixed interpretation: positive investment signals can coexist with negative vendor-fit signals. They do not represent confirmed sales opportunities. If either company is used in the demo or evaluation set, its current findings must be independently collected, dated, attributed, and reviewed.

The Annex describes current researchers using company newsrooms, annual reports, strategy publications, news search, job pages, and industry media. The first collection spike should cover at least one representative corporate publication and one reputable news source while keeping adapters provider-neutral.

Decision-maker identification through Sales Navigator is part of the described manual workflow, but automated contact enrichment is outside the initial release. The product may preserve a manually supplied contact note later; it must not scrape LinkedIn, invent a contact, or imply that account ranking also identifies a verified buyer.

## Deliberate extensions

The repository adds safeguards that are not specified in the Annex but are necessary for a trustworthy implementation: exact evidence excerpts, company-attribution validation, unknown states, duplicate-event protection, immutable configuration versions, collection failure states, SSRF protection, cost limits, and export formula neutralization.

## Alignment gate

Before release, verify that one reviewed automation account visibly contains an ICP result, at least one positive and one negative or uncertain signal, evidence links, freshness treatment, contribution breakdown, and final ranking. This provides an end-to-end demonstration of the Annex process without presenting the illustrative companies as real prospects.

