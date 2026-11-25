"""Validate the existing multipart JSON contract without changing the frontend payload."""
from datetime import date, datetime
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class PatientWrite(BaseModel):
    model_config = ConfigDict(extra="allow")
    patientId: str = Field(min_length=1, max_length=100)
    patientName: str = Field(min_length=1, max_length=100)
    patientGender: Literal["M", "F", "O", ""] = "M"
    patientBirth: date | None = None
    patientVisit: datetime | None = None
    patientNote: str = Field(default="", max_length=1000)
    projectSeq: int = Field(default=1, ge=1)
    addType: Literal["new", "exist"] = "new"
    stl_seq: int | None = Field(default=None, ge=1)
    srl_seq: int | None = Field(default=None, ge=1)
    nail: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @field_validator("patientBirth", "patientVisit", mode="before")
    @classmethod
    def empty_date(cls, value):
        return None if value == "" else value


def parse_patient_payload(body):
    try:
        return PatientWrite.model_validate_json(body).model_dump(mode="json")
    except ValidationError as exc:
        # Do not echo patient values in validation errors.
        issues = [{"field": ".".join(map(str, item["loc"])), "message": item["msg"]}
                  for item in exc.errors()]
        raise HTTPException(422, issues) from exc
