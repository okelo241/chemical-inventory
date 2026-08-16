from sqlalchemy import Column, Integer, String, Float, Date, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func
from .database import Base


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
    in_collection = Column(Boolean, default=False)
    user_id = Column(String, nullable=True, index=True)
    # Phase 1: nullable — personal chemicals stay user-scoped
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=True)
    created_by = Column(String, nullable=False, index=True)  # Supabase user id
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)  # Supabase user id
    role = Column(String, default="member")  # owner | admin | member
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    role = Column(String, default="member")  # member | admin
    invited_by = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, default="pending")  # pending | accepted | revoked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)