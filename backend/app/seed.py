import json
from importlib.resources import files

from sqlalchemy import select

from app.contracts.profile import ProfileCreate
from app.db import SessionLocal
from app.models.profile import ServiceProfile, ServiceProfileVersion


def load_presets() -> list[ProfileCreate]:
    fixture = files("app.fixtures").joinpath("service_profiles.json").read_text(encoding="utf-8")
    return [ProfileCreate.model_validate(item) for item in json.loads(fixture)]


def seed_profiles() -> None:
    with SessionLocal.begin() as session:
        for preset in load_presets():
            if session.scalar(select(ServiceProfile).where(ServiceProfile.name == preset.name)):
                continue
            profile = ServiceProfile(name=preset.name)
            profile.versions.append(
                ServiceProfileVersion(
                    version=1, configuration=preset.configuration.model_dump(mode="json")
                )
            )
            session.add(profile)


if __name__ == "__main__":
    seed_profiles()
