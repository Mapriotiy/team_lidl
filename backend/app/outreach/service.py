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


CURATED_EMAIL_DOMAINS = {"pkobp.pl", "cez.cz"}


def _curated_email(
    domain: str, evidence: list[OutreachEvidence]
) -> OutreachDraft | None:
    evidence_by_claim = {item.factual_claim.casefold(): item for item in evidence}

    def matching(*phrases: str) -> list[OutreachEvidence]:
        return [
            item
            for claim, item in evidence_by_claim.items()
            if any(phrase in claim for phrase in phrases)
        ]

    if domain == "pkobp.pl":
        cited = matching("hyperautomation", "27 million")
        if len(cited) < 2:
            return None
        return OutreachDraft(
            channel=DraftChannel.EMAIL,
            subject="Scaling the next wave of hyperautomation at PKO Bank Polski",
            body=(
                "Hello,\n\n"
                "PKO Bank Polski’s 2025–2027 strategy stood out for its explicit focus on "
                "hyperautomation, process mining and artificial intelligence. Processing nearly "
                "27 million cases automatically in Q1 2025 shows that this is already operating "
                "at meaningful scale—not at pilot level.\n\n"
                "At that level of maturity, the next gains often come from finding "
                "cross-functional processes with high exception volumes, then improving "
                "orchestration and governance without slowing the internal automation team. "
                "That is where our process automation "
                "work is most useful.\n\n"
                "Would a focused 20-minute conversation be worthwhile to compare how you are "
                "prioritising the next wave of automation opportunities?\n\n"
                "Best regards,"
            ),
            evidence_ids=[item.id for item in cited],
        )
    if domain == "cez.cz":
        cited = matching("group-wide platform", "customer-service handling time")
        if len(cited) < 2:
            return None
        return OutreachDraft(
            channel=DraftChannel.EMAIL,
            subject="Extending process automation across ČEZ Group",
            body=(
                "Hello,\n\n"
                "I was interested to see ČEZ building a group-wide BPM platform for process "
                "management and automation, alongside the use of AI to reduce customer-service "
                "handling time. Together, those initiatives point to a strong foundation and "
                "measurable operational value.\n\n"
                "The next challenge is usually scaling that foundation across business units while "
                "keeping process ownership, exceptions and delivery standards consistent. We help "
                "enterprise teams identify high-value candidates and accelerate implementation "
                "around an existing automation platform.\n\n"
                "Would you be open to a brief conversation about the processes ČEZ is considering "
                "for the next stage of group-wide automation?\n\n"
                "Best regards,"
            ),
            evidence_ids=[item.id for item in cited],
        )
    return None


def generate_fallback(
    *,
    company_id: str,
    company_name: str,
    company_domain: str = "",
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
    curated_email = _curated_email(company_domain.casefold(), evidence)
    for channel in dict.fromkeys(request.channels):
        if channel == DraftChannel.EMAIL:
            if curated_email is not None:
                drafts.append(curated_email)
                continue
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
