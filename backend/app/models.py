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
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=True, index=True)
    created_by = Column(String, nullable=True, index=True)  # Supabase auth user id
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
    user_id = Column(String, nullable=False, index=True)  # Supabase auth user id
    role = Column(String, nullable=False, default="member")  # owner | admin | member
    joined_at = Column(DateTime(timezone=True), server_default=func.now())


class Chemical(Base):
    __tablename__ = "chemicals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cas_number = Column(String, index=True, nullable=True)
    quantity = Column(Float, default=0.0)
    unit = Column(String, default="g")
    location = Column(String, nullable=True)
    expiry_date = Column(Date, nullable=True)
    min_stock = Column(Float, default=0.0)
    hazard_notes = Column(Text, nullable=True)
    sds_filename = Column(String, nullable=True)
    molecular_formula = Column(String, nullable=True)
    hazard_symbols = Column(ARRAY(String), nullable=True)
    chemical_classes = Column(ARRAY(String), nullable=True)
    batch_lot = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    barcode = Column(String, nullable=True)

    # Legacy collection flag (JSX still toggles this via PUT /chemicals/{id})
    in_collection = Column(Boolean, default=False)

    # Personal owner (Supabase auth user id)
    user_id = Column(String, nullable=True, index=True)

    # None = personal workspace; set = organization workspace
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
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
    """Preferred personal collection table (per-user, not per-chemical row)."""

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
    role = Column(String, nullable=False, default="member")  # member | admin
    invited_by = Column(String, nullable=True)  # Supabase auth user id
    token = Column(String, unique=True, nullable=False, index=True)
    status = Column(
        String, nullable=False, default="pending"
    )  # pending | accepted | revoked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)


# Helpful indexes
Index("idx_chemicals_user_org", Chemical.user_id, Chemical.organization_id)
Index(
    "idx_invites_org_email_status",
    OrganizationInvite.organization_id,
    OrganizationInvite.email,
    OrganizationInvite.status,
)