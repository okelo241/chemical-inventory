from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import shutil

from . import models, schemas
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chemical Inventory API")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Folder to store uploaded SDS files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def read_root():
    return {"message": "Chemical Inventory API is running"}


@app.get("/chemicals", response_model=List[schemas.Chemical])
def get_chemicals(db: Session = Depends(get_db)):
    return db.query(models.Chemical).all()


@app.get("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def get_chemical(chemical_id: int, db: Session = Depends(get_db)):
    chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")
    return chemical


@app.post("/chemicals", response_model=schemas.Chemical)
def create_chemical(chemical: schemas.ChemicalCreate, db: Session = Depends(get_db)):
    db_chemical = models.Chemical(**chemical.dict())
    db.add(db_chemical)
    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.put("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def update_chemical(chemical_id: int, chemical: schemas.ChemicalUpdate, db: Session = Depends(get_db)):
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    update_data = chemical.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chemical, key, value)

    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.delete("/chemicals/{chemical_id}")
def delete_chemical(chemical_id: int, db: Session = Depends(get_db)):
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    db.delete(db_chemical)
    db.commit()
    return {"message": "Chemical deleted successfully"}


@app.post("/chemicals/{chemical_id}/upload-sds")
def upload_sds(chemical_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    # Save the uploaded file
    file_location = f"{UPLOAD_DIR}/{chemical_id}_{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_chemical.sds_filename = file.filename
    db.commit()
    db.refresh(db_chemical)

    return {"message": "SDS uploaded successfully", "filename": file.filename}


@app.get("/chemicals/{chemical_id}/sds")
def download_sds(chemical_id: int, db: Session = Depends(get_db)):
    chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chemical or not chemical.sds_filename:
        raise HTTPException(status_code=404, detail="SDS file not found")

    file_path = f"{UPLOAD_DIR}/{chemical_id}_{chemical.sds_filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(file_path, filename=chemical.sds_filename)