# Product scope

## Objective

Help a sales representative decide which company to approach, for which service, and why now. Each recommendation must be traceable to public evidence.

Delivery constraint: 48 hours, five contributors. Presentation quality matters, especially the ranked list, evidence inspection, and configuration flow.

## Core journey

1. Select a service profile or duplicate a preset.
2. Configure industry, geography, company size, signal questions, weights, and exclusions.
3. Import company domains or run a bounded discovery search.
4. Start background research and see real progress and partial results.
5. Review ranked company–service opportunities.
6. Open an account, inspect evidence, and understand score contributions.
7. Shortlist, dismiss, add a note, or export an opportunity.
8. Optionally create and edit an outreach draft grounded in verified findings.

## Service presets

| Preset | Initial signal questions | Important limitation |
| --- | --- | --- |
| Process automation | Efficiency initiative? RPA or process-excellence hiring? Workflow modernization? | Hiring alone does not establish outsourcing intent. |
| Cybersecurity | Security hiring? Compliance initiative? Cloud migration? Publicly confirmed incident? | An incident alone does not establish present demand or budget. |
| Software development | Product launch? Platform modernization? Digital-channel expansion? Engineering hiring? | Growth alone does not prove external development demand. |

All presets use the same editable configuration schema. Users can create a fourth service without a code change. Each signal has a question, positive criteria, exclusions, weight, freshness window, and effect: positive, penalty, or disqualifier.

## Screens

| Screen | Required behavior |
| --- | --- |
| Opportunities | Filter by service and status; sort eligible researched accounts by score; show strongest signal, coverage, and last researched time. |
| Company workspace | Show service assessments, evidence excerpts, source links, score breakdown, uncertainty, notes, and research history. |
| Service profiles | Edit ICP, questions, weights, freshness, and exclusions; duplicate and create profiles. |
| Research activity | Show queued/running/completed/partial/failed states with collection and assessment progress. |

Keep the interface consistent: one app shell, clear hierarchy, accessible contrast, keyboard-operable controls, and useful loading/empty/error states. Do not show fabricated progress or decorative metrics without a defined meaning.

## Release priorities

**P0 — protect:** editable three-service configuration, domain import, real research, evidence inspection, transparent scores, ranked accounts, job progress, shortlist/export, deployed complete flow.

**P1 — deliver after P0 is integrated:** bounded discovery, custom profile UI, manual refresh/history, simple scheduled refresh, evidence-grounded outreach draft.

**Deferred:** CRM synchronization, contact enrichment, message sending, broad market crawling, predictive purchase probabilities, complex notification rules, and advanced analytics.

The schema must support custom profiles from the start even if the create-profile UI slips. Manual refresh is the fallback if scheduled execution is cut. Make limitations visible in the demo handoff.

## Evidence language

Separate observed fact, interpretation, and unknown. For example, an automation vacancy is an observed fact; possible investment in automation is an interpretation; intention to hire a vendor remains unknown.

An account has a separate assessment per service. Scores are priorities within a profile version, not probabilities of purchase. Do not add scores across services. An all-services view may show each account's strongest match, labeled with the corresponding service.

## Open decisions

- Named owners for the five roles.
- First geography/industry for discovery and evaluation.
- Model/search provider credentials and a spending cap.
- Deployment host and access model for the demo.
- Annex 1 reference pack, if available.

Resolve these at kickoff. Until then, use English-language research, one bounded market for discovery, and no dependency on licensed enrichment.
