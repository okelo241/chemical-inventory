from sqlalchemy import Column, Integer, String, Float, Date, Text
from sqlalchemy.dialects.postgresql import ARRAY
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
    chemical_classes = Column(ARRAY(String), nullable=True)  # ← add
    batch_lot = Column(String, nullable=True)                # ← add
    supplier = Column(String, nullable=True)                 # ← add
    barcode = Column(String, nullable=True)                  # ← add
    user_id = Column(String, nullable=True)  # kept for compatibility