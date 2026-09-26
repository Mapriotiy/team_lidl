from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.discovery import router as discovery_router
from app.api.outreach import router as outreach_router
from app.api.profiles import router as profiles_router
from app.api.research import router as research_router
from app.api.results import router as results_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(profiles_router)
app.include_router(research_router)
app.include_router(results_router)
app.include_router(discovery_router)
app.include_router(outreach_router)


class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]
    version: str


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(service="api", status="ok", version=settings.app_version)
