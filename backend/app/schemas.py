from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import Optional, List, Literal, Any, Union
from datetime import date, datetime
from uuid import UUID


# ---------- Chemicals ----------

class ChemicalBase(BaseModel):
    name: str = ""
    cas_number: Optional[str] = None
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "g"
    location: Optional[str] = None
    expiry_date: Optional[date] = None
    min_stock: Optional[float] = 0.0
    hazard_notes: Optional[str] = None
    molecular_formula: Optional[str] = None
    hazard_symbols: Optional[List[str]] = None
    chemical_classes: Optional[List[str]] = None
    batch_lot: Optional[str] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None
    # Legacy flag; prefer user_collections when available
    in_collection: Optional[bool] = False
    # None = personal workspace; set = org workspace
    organization_id: Optional[UUID] = None

    @field_validator("quantity", "min_stock", mode="before")
    @classmethod
    def coerce_float(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    @field_validator("hazard_symbols", "chemical_classes", mode="before")
    @classmethod
    def coerce_str_list(cls, v: Any) -> Optional[List[str]]:
        if v is None:
            return None
        if isinstance(v, list):
            return [str(x) for x in v if x is not None]
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",") if p.strip()]
            return parts or None
        return None

    @field_validator("organization_id", mode="before")
    @classmethod
    def coerce_org_id(cls, v: Any) -> Optional[UUID]:
        if v is None or v == "":
            return None
        if isinstance(v, UUID):
            return v
        try:
            return UUID(str(v))
        except Exception:
            return None

    @field_validator("in_collection", mode="before")
    @classmethod
    def coerce_bool(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)

    @field_validator("name", mode="before")
    @classmethod
    def coerce_name(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)

    @field_validator("unit", mode="before")
    @classmethod
    def coerce_unit(cls, v: Any) -> str:
        if v is None or v == "":
            return "g"
        return str(v)


class ChemicalCreate(ChemicalBase):
    name: str = Field(..., min_length=1)


class ChemicalUpdate(BaseModel):
    name: Optional[str] = None
    cas_number: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[date] = None
    min_stock: Optional[float] = None
    hazard_notes: Optional[str] = None
    molecular_formula: Optional[str] = None
    hazard_symbols: Optional[List[str]] = None
    chemical_classes: Optional[List[str]] = None
    batch_lot: Optional[str] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None
    in_collection: Optional[bool] = None
    organization_id: Optional[UUID] = None

    @field_validator("organization_id", mode="before")
    @classmethod
    def coerce_org_id(cls, v: Any) -> Optional[UUID]:
        if v is None or v == "":
            return None
        if isinstance(v, UUID):
            return v
        try:
            return UUID(str(v))
        except Exception:
            return None


class Chemical(ChemicalBase):
    id: int
    sds_filename: Optional[str] = None
    user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Organizations ----------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    # Current user's role in this org (from join)
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberOut(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: str
    role: str
    joined_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceContext(BaseModel):
    """Frontend Personal vs Organization switch."""
    mode: Literal["personal", "organization"] = "personal"
    organization_id: Optional[UUID] = None
    organization_name: Optional[str] = None
    role: Optional[str] = None


# ---------- Invites ----------

class InviteCreate(BaseModel):
    email: EmailStr
    role: Literal["member", "admin"] = "member"


class InviteOut(BaseModel):
    id: UUID
    organization_id: UUID
    email: str
    role: str
    status: str  # pending | accepted | revoked
    token: Optional[str] = None
    invited_by: Optional[str] = None
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AcceptInviteIn(BaseModel):
    token: str = Field(..., min_length=8)


# ---------- Personal collection ----------

class CollectionToggle(BaseModel):
    chemical_id: int


class CollectionItemOut(BaseModel):
    chemical_id: int
    added_at: Optional[datetime] = None
    chemical: Optional[Chemical] = None

    model_config = ConfigDict(from_attributes=True)


class CollectionToggleOut(BaseModel):
    chemical_id: int
    in_collection: bool