from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


# ---------- Chemicals (existing + org id) ----------

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
    in_collection: Optional[bool] = False
    organization_id: Optional[int] = None


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
    organization_id: Optional[int] = None


class Chemical(ChemicalBase):
    id: int
    sds_filename: Optional[str] = None
    user_id: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Organizations ----------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)


class OrganizationOut(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None
    created_by: str
    created_at: Optional[datetime] = None
    role: Optional[str] = None  # current user's role in this org

    class Config:
        from_attributes = True


class OrganizationMemberOut(BaseModel):
    id: int
    organization_id: int
    user_id: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkspaceContext(BaseModel):
    """What the frontend uses for Personal vs Organization switch."""
    mode: str  # "personal" | "organization"
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    role: Optional[str] = None