from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from typing import Optional, List, Literal, Any, Dict
from datetime import date, datetime
from uuid import UUID


def _coerce_uuid(v: Any) -> Optional[UUID]:
    if v is None or v == "":
        return None
    if isinstance(v, UUID):
        return v
    try:
        return UUID(str(v))
    except Exception:
        return None


def _coerce_float(v: Any, default: float = 0.0) -> float:
    if v is None or v == "":
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _coerce_str_list(v: Any) -> Optional[List[str]]:
    if v is None:
        return None
    if isinstance(v, list):
        return [str(x) for x in v if x is not None]
    if isinstance(v, str):
        parts = [p.strip() for p in v.split(",") if p.strip()]
        return parts or None
    return None


# ---------- Chemicals ----------

class ChemicalBase(BaseModel):
    name: str = ""
    cas_number: Optional[str] = None
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "g"
    location: Optional[str] = None
    loc_building: Optional[str] = None
    loc_room: Optional[str] = None
    loc_cabinet: Optional[str] = None
    loc_shelf: Optional[str] = None
    expiry_date: Optional[date] = None
    min_stock: Optional[float] = 0.0
    hazard_notes: Optional[str] = None
    molecular_formula: Optional[str] = None
    hazard_symbols: Optional[List[str]] = None
    chemical_classes: Optional[List[str]] = None
    batch_lot: Optional[str] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None
    container_code: Optional[str] = None
    parent_chemical_id: Optional[int] = None
    sds_reviewed_at: Optional[date] = None
    sds_review_months: Optional[int] = 12
    archived: Optional[bool] = False
    in_collection: Optional[bool] = False
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None

    @field_validator("quantity", "min_stock", mode="before")
    @classmethod
    def coerce_float_fields(cls, v: Any) -> float:
        return _coerce_float(v, 0.0)

    @field_validator("hazard_symbols", "chemical_classes", mode="before")
    @classmethod
    def coerce_lists(cls, v: Any) -> Optional[List[str]]:
        return _coerce_str_list(v)

    @field_validator("organization_id", "lab_unit_id", mode="before")
    @classmethod
    def coerce_ids(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)

    @field_validator("in_collection", "archived", mode="before")
    @classmethod
    def coerce_bool(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)

    @field_validator("name", mode="before")
    @classmethod
    def coerce_name(cls, v: Any) -> str:
        return "" if v is None else str(v)

    @field_validator("unit", mode="before")
    @classmethod
    def coerce_unit(cls, v: Any) -> str:
        return "g" if v is None or v == "" else str(v)


class ChemicalCreate(ChemicalBase):
    name: str = Field(..., min_length=1)


class ChemicalUpdate(BaseModel):
    name: Optional[str] = None
    cas_number: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    loc_building: Optional[str] = None
    loc_room: Optional[str] = None
    loc_cabinet: Optional[str] = None
    loc_shelf: Optional[str] = None
    expiry_date: Optional[date] = None
    min_stock: Optional[float] = None
    hazard_notes: Optional[str] = None
    molecular_formula: Optional[str] = None
    hazard_symbols: Optional[List[str]] = None
    chemical_classes: Optional[List[str]] = None
    batch_lot: Optional[str] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None
    container_code: Optional[str] = None
    parent_chemical_id: Optional[int] = None
    sds_reviewed_at: Optional[date] = None
    sds_review_months: Optional[int] = None
    archived: Optional[bool] = None
    in_collection: Optional[bool] = None
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None

    @field_validator("organization_id", "lab_unit_id", mode="before")
    @classmethod
    def coerce_ids(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)

    @field_validator("hazard_symbols", "chemical_classes", mode="before")
    @classmethod
    def coerce_lists(cls, v: Any) -> Optional[List[str]]:
        return _coerce_str_list(v)


class Chemical(ChemicalBase):
    id: int
    sds_filename: Optional[str] = None
    user_id: Optional[str] = None
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None
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
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberOut(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: str
    role: str
    lab_unit_id: Optional[UUID] = None
    joined_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceContext(BaseModel):
    mode: Literal["personal", "organization"] = "personal"
    organization_id: Optional[UUID] = None
    organization_name: Optional[str] = None
    role: Optional[str] = None
    lab_unit_id: Optional[UUID] = None


# ---------- Lab units ----------

class LabUnitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: Optional[str] = None
    description: Optional[str] = None


class LabUnitOut(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Invites ----------

class InviteCreate(BaseModel):
    email: EmailStr
    role: Literal["member", "admin", "ehs", "viewer"] = "member"
    lab_unit_id: Optional[UUID] = None

    @field_validator("lab_unit_id", mode="before")
    @classmethod
    def coerce_lab(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class InviteOut(BaseModel):
    id: UUID
    organization_id: UUID
    email: str
    role: str
    status: str
    token: Optional[str] = None
    invited_by: Optional[str] = None
    lab_unit_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AcceptInviteIn(BaseModel):
    token: str = Field(..., min_length=8)


# ---------- Collections ----------

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


# ---------- Audit ----------

class AuditEventCreate(BaseModel):
    action: str = Field(..., min_length=1)
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    detail: Optional[Dict[str, Any]] = None

    @field_validator("organization_id", "lab_unit_id", mode="before")
    @classmethod
    def coerce_ids(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class AuditEventOut(BaseModel):
    id: UUID
    at: Optional[datetime] = None
    action: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    detail: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Waste ----------

class WasteLogCreate(BaseModel):
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = "g"
    reason: Optional[str] = None
    notes: Optional[str] = None
    disposition: Optional[str] = None
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None

    @field_validator("organization_id", "lab_unit_id", mode="before")
    @classmethod
    def coerce_ids(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class WasteLogOut(BaseModel):
    id: UUID
    at: Optional[datetime] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    organization_id: Optional[UUID] = None
    lab_unit_id: Optional[UUID] = None
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    disposition: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Notification channels ----------

class NotificationChannelCreate(BaseModel):
    channel_type: Literal["email", "webhook", "slack"] = "email"
    name: Optional[str] = None
    target: str = Field(..., min_length=1)
    events: Optional[List[str]] = None
    enabled: bool = True


class NotificationChannelOut(BaseModel):
    id: UUID
    organization_id: UUID
    channel_type: str
    name: Optional[str] = None
    target: str
    events: Optional[List[str]] = None
    enabled: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Training ----------

class TrainingRequirementCreate(BaseModel):
    code: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    required_classes: Optional[List[str]] = None
    required_actions: Optional[List[str]] = None
    valid_months: int = 12


class TrainingRequirementOut(BaseModel):
    id: UUID
    organization_id: UUID
    code: str
    title: str
    description: Optional[str] = None
    required_classes: Optional[List[str]] = None
    required_actions: Optional[List[str]] = None
    valid_months: Optional[int] = 12
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserTrainingRecordCreate(BaseModel):
    training_requirement_id: UUID
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    evidence_url: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("training_requirement_id", mode="before")
    @classmethod
    def coerce_tid(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class UserTrainingRecordOut(BaseModel):
    id: UUID
    user_id: str
    training_requirement_id: UUID
    organization_id: Optional[UUID] = None
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    evidence_url: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Procurement ----------

class PurchaseOrderCreate(BaseModel):
    supplier: Optional[str] = None
    notes: Optional[str] = None
    lab_unit_id: Optional[UUID] = None

    @field_validator("lab_unit_id", mode="before")
    @classmethod
    def coerce_lab(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class PurchaseOrderItemCreate(BaseModel):
    chemical_name: str
    cas_number: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    catalog_number: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderOut(BaseModel):
    id: UUID
    organization_id: UUID
    lab_unit_id: Optional[UUID] = None
    created_by: Optional[str] = None
    status: str
    supplier: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ReceivingRecordCreate(BaseModel):
    purchase_order_id: Optional[UUID] = None
    chemical_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    lot_number: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("purchase_order_id", mode="before")
    @classmethod
    def coerce_po(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class ReceivingRecordOut(BaseModel):
    id: UUID
    organization_id: UUID
    purchase_order_id: Optional[UUID] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    chemical_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    lot_number: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Transactions ----------

class TransactionCreate(BaseModel):
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    type: Literal["take", "return", "adjust"] = "take"
    quantity_change: Optional[float] = None
    quantity_before: Optional[float] = None
    quantity_after: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    organization_id: Optional[UUID] = None

    @field_validator("organization_id", mode="before")
    @classmethod
    def coerce_org(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class TransactionOut(BaseModel):
    id: UUID
    user_id: str
    user_email: Optional[str] = None
    organization_id: Optional[UUID] = None
    chemical_id: Optional[int] = None
    chemical_name: Optional[str] = None
    type: str
    quantity_change: Optional[float] = None
    quantity_before: Optional[float] = None
    quantity_after: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Device sync ----------

class DeviceSyncUpsert(BaseModel):
    device_id: str = Field(..., min_length=1)
    organization_id: Optional[UUID] = None
    last_cursor: Optional[str] = None
    client_info: Optional[Dict[str, Any]] = None

    @field_validator("organization_id", mode="before")
    @classmethod
    def coerce_org(cls, v: Any) -> Optional[UUID]:
        return _coerce_uuid(v)


class DeviceSyncOut(BaseModel):
    id: UUID
    user_id: str
    device_id: str
    organization_id: Optional[UUID] = None
    last_sync_at: Optional[datetime] = None
    last_cursor: Optional[str] = None
    client_info: Optional[Dict[str, Any]] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)