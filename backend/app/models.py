import uuid

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID, JSONB
from sqlalchemy.sql import func

from .database import Base


# =============================================================================
# Organizations & membership
# =============================================================================

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=True, index=True)
    created_by = Column(String, nullable=True, index=True)  # Supabase auth user id
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    settings = Column(JSONB, nullable=True)  # e.g. {"sds_review_months": 12}


class LabUnit(Base):
    """Phase B — lab / team unit inside an organization."""

    __tablename__ = "lab_units"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_lab_unit_org_slug"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    slug = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(String, nullable=False, index=True)
    # owner | admin | ehs | member | viewer
    role = Column(String, nullable=False, default="member")
    lab_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lab_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="member")
    lab_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lab_units.id", ondelete="SET NULL"),
        nullable=True,
    )
    invited_by = Column(String, nullable=True)
    token = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)


# =============================================================================
# Chemicals (inventory)
# =============================================================================

class Chemical(Base):
    __tablename__ = "chemicals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cas_number = Column(String, index=True, nullable=True)
    quantity = Column(Float, default=0.0)
    unit = Column(String, default="g")
    location = Column(String, nullable=True)
    loc_building = Column(String, nullable=True)
    loc_room = Column(String, nullable=True)
    loc_cabinet = Column(String, nullable=True)
    loc_shelf = Column(String, nullable=True)

    expiry_date = Column(Date, nullable=True)
    min_stock = Column(Float, default=0.0)
    hazard_notes = Column(Text, nullable=True)
    sds_filename = Column(String, nullable=True)
    sds_reviewed_at = Column(Date, nullable=True)
    sds_review_months = Column(Integer, default=12)

    molecular_formula = Column(String, nullable=True)
    hazard_symbols = Column(ARRAY(String), nullable=True)
    chemical_classes = Column(ARRAY(String), nullable=True)
    batch_lot = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    barcode = Column(String, nullable=True, index=True)

    container_code = Column(String, nullable=True, index=True)
    parent_chemical_id = Column(
        Integer,
        ForeignKey("chemicals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    archived = Column(Boolean, default=False, nullable=False, index=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by = Column(String, nullable=True)

    in_collection = Column(Boolean, default=False)

    user_id = Column(String, nullable=True, index=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lab_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lab_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserCollection(Base):
    __tablename__ = "user_collections"
    __table_args__ = (
        UniqueConstraint("user_id", "chemical_id", name="uq_user_chemical_collection"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    chemical_id = Column(
        Integer,
        ForeignKey("chemicals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    added_at = Column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# Phase A — Audit (append-only)
# =============================================================================

class AuditEvent(Base):
    """Append-only compliance trail. Prefer INSERT only; never UPDATE/DELETE in app code."""

    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    action = Column(String, nullable=False, index=True)

    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String, nullable=True)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    lab_unit_id = Column(UUID(as_uuid=True), nullable=True)

    chemical_id = Column(Integer, nullable=True, index=True)
    chemical_name = Column(String, nullable=True)
    detail = Column(JSONB, nullable=True)


# =============================================================================
# Phase B — Waste / disposal
# =============================================================================

class WasteLog(Base):
    __tablename__ = "waste_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String, nullable=True)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lab_unit_id = Column(UUID(as_uuid=True), nullable=True)
    chemical_id = Column(
        Integer,
        ForeignKey("chemicals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chemical_name = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    disposition = Column(String, nullable=True)


# =============================================================================
# Phase B — Notification channels
# =============================================================================

class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_type = Column(String, nullable=False, default="email")
    name = Column(String, nullable=True)
    target = Column(String, nullable=False)
    events = Column(ARRAY(String), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# Phase C — Training / authorization gates
# =============================================================================

class TrainingRequirement(Base):
    __tablename__ = "training_requirements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    required_classes = Column(ARRAY(String), nullable=True)
    required_actions = Column(ARRAY(String), nullable=True)
    valid_months = Column(Integer, default=12)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserTrainingRecord(Base):
    __tablename__ = "user_training_records"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "training_requirement_id", name="uq_user_training"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    training_requirement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("training_requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    evidence_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)


# =============================================================================
# Phase C — Receiving / procurement
# =============================================================================

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lab_unit_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="draft")
    supplier = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chemical_name = Column(String, nullable=False)
    cas_number = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    catalog_number = Column(String, nullable=True)
    received_chemical_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)


class ReceivingRecord(Base):
    __tablename__ = "receiving_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purchase_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    received_by = Column(String, nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    chemical_id = Column(
        Integer,
        ForeignKey("chemicals.id", ondelete="SET NULL"),
        nullable=True,
    )
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    lot_number = Column(String, nullable=True)
    notes = Column(Text, nullable=True)


# =============================================================================
# Phase C — SSO config (metadata only; IdP handled by Supabase)
# =============================================================================

class OrganizationSsoConfig(Base):
    __tablename__ = "organization_sso_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    enforce_sso = Column(Boolean, default=False)
    meta = Column(JSONB, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


# =============================================================================
# Phase C — Offline mobile sync cursors
# =============================================================================

class DeviceSyncState(Base):
    __tablename__ = "device_sync_states"
    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_user_device_sync"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    device_id = Column(String, nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_cursor = Column(String, nullable=True)
    client_info = Column(JSONB, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


# =============================================================================
# Transactions (persist usage take/return/adjust)
# =============================================================================

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    user_email = Column(String, nullable=True)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    chemical_id = Column(
        Integer,
        ForeignKey("chemicals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chemical_name = Column(String, nullable=True)
    type = Column(String, nullable=False)
    quantity_change = Column(Float, nullable=True)
    quantity_before = Column(Float, nullable=True)
    quantity_after = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# =============================================================================
# Indexes
# =============================================================================

Index("idx_chemicals_user_org", Chemical.user_id, Chemical.organization_id)
Index("idx_chemicals_cas_location", Chemical.cas_number, Chemical.location)
Index("idx_chemicals_archived", Chemical.archived)
Index(
    "idx_invites_org_email_status",
    OrganizationInvite.organization_id,
    OrganizationInvite.email,
    OrganizationInvite.status,
)
Index("idx_audit_org_at", AuditEvent.organization_id, AuditEvent.at)
Index("idx_waste_org_at", WasteLog.organization_id, WasteLog.at)
Index("idx_tx_user_at", InventoryTransaction.user_id, InventoryTransaction.created_at)