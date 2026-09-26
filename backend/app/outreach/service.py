from enum import StrEnum

from pydantic import Field

from app.contracts.common import ContractModel


class DraftChannel(StrEnum):
    EMAIL = "email"
    LINKEDIN_INMAIL = "linkedin_inmail"
    CONNECTION_NOTE = "connection_note"
    CALL_BRIEF = "call_brief"


class DraftRequest(ContractModel):
    channels: list[DraftChannel] = Field(default_factory=lambda: list(DraftChannel), min_length=1)
    recipient_role: str = Field(default="Operations leader", min_length=2, max_length=120)
    tone: str = Field(default="consultative", pattern="^(consultative|concise|direct)$")


class OutreachEvidence(ContractModel):
    id: str
    signal_id: str
    factual_claim: str
    excerpt: str
    source_title: str
    source_url: str


class OutreachDraft(ContractModel):
    channel: DraftChannel
    subject: str | None = None
    body: str
    evidence_ids: list[str]


class OutreachDraftBundle(ContractModel):
    company_id: str
    company_name: str
    recipient_role: str
    drafts: list[OutreachDraft]
    evidence: list[OutreachEvidence]
    disclaimer: str = (
        "Draft only. Review every claim, recipient and lawful outreach basis before sending."
    )


def generate_fallback(
    *,
    company_id: str,
    company_name: str,
    service_description: str,
    request: DraftRequest,
    evidence: list[OutreachEvidence],
) -> OutreachDraftBundle:
    selected = evidence[:3]
    if not selected:
        raise ValueError("At least one supported evidence item is required")
    lead = selected[0].factual_claim.rstrip(".")
    support = selected[1].factual_claim.rstrip(".") if len(selected) > 1 else None
    context = f"I noticed that {lead}"
    if support:
        context += f", and that {support}"
    context += "."
    offer = service_description.rstrip(".") or "We help teams improve and automate operations"
    ids = [item.id for item in selected]
    drafts: list[OutreachDraft] = []
    for channel in dict.fromkeys(request.channels):
        if channel == DraftChannel.EMAIL:
            drafts.append(
                OutreachDraft(
                    channel=channel,
                    subject=f"Process automation at {company_name}",
                    body=(
                        f"Hello,\n\n{context}\n\n{offer}.\n\nWould a short conversation about the "
                        "processes currently creating the most operational friction be useful?\n\n"
                        "Best regards,"
                    ),
                    evidence_ids=ids,
                )
            )
        elif channel == DraftChannel.LINKEDIN_INMAIL:
            drafts.append(
                OutreachDraft(
                    channel=channel,
                    subject=f"Automation priorities at {company_name}",
                    body=(
                        f"Hi — {context} {offer}. I would be interested in comparing notes on "
                        "where additional delivery capacity could support your current priorities."
                    ),
                    evidence_ids=ids,
                )
            )
        elif channel == DraftChannel.CONNECTION_NOTE:
            note = (
                f"I noticed that {lead}. I would be glad to connect and exchange practical "
                "process-improvement ideas."
            )
            drafts.append(
                OutreachDraft(
                    channel=channel,
                    body=note[:300],
                    evidence_ids=[selected[0].id],
                )
            )
        else:
            drafts.append(
                OutreachDraft(
                    channel=channel,
                    body=(
                        f"Opening: {context}\n\n"
                        "Questions:\n"
                        "• Which processes are the highest priority for improvement this year?\n"
                        "• Where is internal delivery capacity constrained?\n"
                        "• What evidence would be required before starting a focused pilot?"
                    ),
                    evidence_ids=ids,
                )
            )
    return OutreachDraftBundle(
        company_id=company_id,
        company_name=company_name,
        recipient_role=request.recipient_role,
        drafts=drafts,
        evidence=selected,
    )
