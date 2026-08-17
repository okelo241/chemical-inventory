from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Literal
from datetime import date, datetime
from uuid import UUID


# ---------- Chemicals ----------

class ChemicalBase(BaseModel):
    name: str
    cas_number: Optional[str] = None
    quantity: float = 0.0
    unit: str = "g"
    location: Optional[str] = None
    expiry_date: Optional[date] = None
    min_stock: float = 0.0
    hazard_notes: Optional[str] = None
    molecular_formula: Optional[str] = None
    hazard_symbols: Optional[List[str]] = None
    chemical_classes: Optional[List[str]] = None
    batch_lot: Optional[str] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None
    # kept for backward compatibility; prefer user_collections table
    in_collection: Optional[bool] = False
    organization_id: Optional[UUID] = None


class ChemicalCreate(ChemicalBase):
    pass


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


class Chemical(ChemicalBase):
    id: int
    sds_filename: Optional[str] = None
    user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Organizations ----------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    role: Optional[str] = None  # current user's role in this org

    class Config:
        from_attributes = True


class OrganizationMemberOut(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: str
    role: str
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
    status: str
    token: Optional[str] = None  # return only when creating
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AcceptInviteIn(BaseModel):
    token: str


# ---------- Personal collection ----------

class CollectionToggle(BaseModel):
    chemical_id: int


class CollectionItemOut(BaseModel):
    chemical_id: int
    added_at: Optional[datetime] = None
    chemical: Optional[Chemical] = None

    class Config:
        from_attributes = True


class CollectionToggleOut(BaseModel):
    chemical_id: int
    in_collection: bool