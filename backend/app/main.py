from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from supabase import create_client, Client

from . import models, schemas
from .database import engine, get_db

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chemical Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Supabase Configuration ==========
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qgdtkwhgszvcywsnuyff.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
BUCKET_NAME = "sds-files"
# ===========================================


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract the current user ID from the Supabase access token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")

    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user

        if not user or not user.id:
            raise HTTPException(status_code=401, detail="Invalid token")

        return str(user.id)
    except Exception as e:
        print("Auth error:", str(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.get("/")
def read_root():
    return {"message": "Chemical Inventory API is running"}


@app.get("/chemicals", response_model=List[schemas.Chemical])
def get_chemicals(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    return db.query(models.Chemical).filter(models.Chemical.user_id == user_id).all()


@app.get("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def get_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    chemical = db.query(models.Chemical).filter(
        models.Chemical.id == chemical_id,
        models.Chemical.user_id == user_id
    ).first()
    if not chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")
    return chemical


@app.post("/chemicals", response_model=schemas.Chemical)
def create_chemical(
    chemical: schemas.ChemicalCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    db_chemical = models.Chemical(**chemical.dict(), user_id=user_id)
    db.add(db_chemical)
    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.put("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def update_chemical(
    chemical_id: int,
    chemical: schemas.ChemicalUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    db_chemical = db.query(models.Chemical).filter(
        models.Chemical.id == chemical_id,
        models.Chemical.user_id == user_id
    ).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    update_data = chemical.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chemical, key, value)

    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.delete("/chemicals/{chemical_id}")
def delete_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    db_chemical = db.query(models.Chemical).filter(
        models.Chemical.id == chemical_id,
        models.Chemical.user_id == user_id
    ).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    # Delete SDS file from storage if it exists
    if db_chemical.sds_filename:
        try:
            supabase.storage.from_(BUCKET_NAME).remove([db_chemical.sds_filename])
        except Exception:
            pass

    db.delete(db_chemical)
    db.commit()
    return {"message": "Chemical deleted successfully"}


@app.post("/chemicals/{chemical_id}/upload-sds")
def upload_sds(
    chemical_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    db_chemical = db.query(models.Chemical).filter(
        models.Chemical.id == chemical_id,
        models.Chemical.user_id == user_id
    ).first()
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    file_path = f"{user_id}/{chemical_id}/{file.filename}"
    file_content = file.file.read()

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    db_chemical.sds_filename = file_path
    db.commit()
    db.refresh(db_chemical)

    return {"message": "SDS uploaded successfully", "filename": file_path}


@app.get("/chemicals/{chemical_id}/sds")
def get_sds_url(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    chemical = db.query(models.Chemical).filter(
        models.Chemical.id == chemical_id,
        models.Chemical.user_id == user_id
    ).first()
    if not chemical or not chemical.sds_filename:
        raise HTTPException(status_code=404, detail="SDS file not found")

    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(chemical.sds_filename)
    return {"url": public_url}