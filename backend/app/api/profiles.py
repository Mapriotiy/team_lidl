from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.contracts.profile import (
    ProfileCreate,
    ProfileRead,
    ProfileUpdate,
    ProfileVersionRead,
)
from app.db import get_session
from app.models.profile import ServiceProfile, ServiceProfileVersion, utc_now

router = APIRouter(prefix="/service-profiles", tags=["service profiles"])


def to_profile_read(profile: ServiceProfile) -> ProfileRead:
    current = profile.versions[-1]
    return ProfileRead(
        id=profile.id,
        name=profile.name,
        current_version=ProfileVersionRead(
            id=current.id,
            version=current.version,
            configuration=current.configuration,
            created_at=current.created_at,
        ),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[ProfileRead])
def list_profiles(session: Session = Depends(get_session)) -> list[ProfileRead]:
    statement = (
        select(ServiceProfile)
        .options(selectinload(ServiceProfile.versions))
        .order_by(ServiceProfile.name)
    )
    return [to_profile_read(profile) for profile in session.scalars(statement).all()]


@router.post("", response_model=ProfileRead, status_code=status.HTTP_201_CREATED)
def create_profile(payload: ProfileCreate, session: Session = Depends(get_session)) -> ProfileRead:
    if session.scalar(select(ServiceProfile).where(ServiceProfile.name == payload.name)):
        raise HTTPException(
            status_code=409, detail="A service profile with this name already exists"
        )

    profile = ServiceProfile(name=payload.name)
    profile.versions.append(
        ServiceProfileVersion(
            version=1, configuration=payload.configuration.model_dump(mode="json")
        )
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return to_profile_read(profile)


@router.patch("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: str, payload: ProfileUpdate, session: Session = Depends(get_session)
) -> ProfileRead:
    statement = (
        select(ServiceProfile)
        .where(ServiceProfile.id == profile_id)
        .options(selectinload(ServiceProfile.versions))
    )
    profile = session.scalar(statement)
    if profile is None:
        raise HTTPException(status_code=404, detail="Service profile not found")

    profile.versions.append(
        ServiceProfileVersion(
            version=profile.versions[-1].version + 1,
            configuration=payload.configuration.model_dump(mode="json"),
        )
    )
    profile.updated_at = utc_now()
    session.commit()
    return to_profile_read(profile)
