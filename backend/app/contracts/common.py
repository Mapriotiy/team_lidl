from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContractModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorDetail(ContractModel):
    code: str
    message: str
    request_id: str
    occurred_at: datetime
