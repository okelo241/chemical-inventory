from pydantic import BaseModel
from typing import Optional, List
from datetime import date


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


class Chemical(ChemicalBase):
    id: int
    sds_filename: Optional[str] = None

    class Config:
        from_attributes = True