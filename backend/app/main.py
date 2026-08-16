from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import os
import re
from supabase import create_client, Client

from . import models, schemas
from .database import engine, get_db

# Create tables (new columns still need ALTER on an existing DB)
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


def _to_dict(obj, exclude_unset: bool = False):
    """Works with both Pydantic v1 (.dict) and v2 (.model_dump)."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(exclude_unset=exclude_unset)
    return obj.dict(exclude_unset=exclude_unset)


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


# ========== Organization helpers (Phase 1) ==========

def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return (s[:60] if s else "org")


def get_membership(
    db: Session, user_id: str, organization_id: int
) -> Optional[models.OrganizationMember]:
    return (
        db.query(models.OrganizationMember)
        .filter(
            models.OrganizationMember.user_id == user_id,
            models.OrganizationMember.organization_id == organization_id,
        )
        .first()
    )


def user_org_ids(db: Session, user_id: str) -> List[int]:
    rows = (
        db.query(models.OrganizationMember.organization_id)
        .filter(models.OrganizationMember.user_id == user_id)
        .all()
    )
    return [r[0] for r in rows]


@app.get("/")
def read_root():
    return {"message": "Chemical Inventory API is running"}


# ========== Chemicals ==========

@app.get("/chemicals", response_model=List[schemas.Chemical])
def get_chemicals(
    organization_id: Optional[int] = Query(
        None,
        description="If set, return org chemicals (member only). If omitted, personal chemicals.",
    ),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Personal (default): chemicals for this user.
    Organization: chemicals for organization_id if the user is a member.
    """
    q = db.query(models.Chemical)

    if organization_id is None:
        # Keep individual accounts working (same behaviour as before)
        q = q.filter(models.Chemical.user_id == user_id)
        # Prefer personal-only rows when organization_id column exists
        if hasattr(models.Chemical, "organization_id"):
            q = q.filter(
                (models.Chemical.organization_id.is_(None))
                | (models.Chemical.organization_id == None)  # noqa: E711
            )
    else:
        membership = get_membership(db, user_id, organization_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        if not hasattr(models.Chemical, "organization_id"):
            raise HTTPException(
                status_code=500,
                detail="organization_id column missing on chemicals — run Phase 1 SQL",
            )
        q = q.filter(models.Chemical.organization_id == organization_id)

    return q.order_by(models.Chemical.name).all()


@app.get("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def get_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    chemical = (
        db.query(models.Chemical)
        .filter(models.Chemical.id == chemical_id)
        .first()
    )
    if not chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    # Personal chemical
    if chemical.user_id == user_id and (
        not getattr(chemical, "organization_id", None)
    ):
        return chemical

    # Org chemical — must be a member
    org_id = getattr(chemical, "organization_id", None)
    if org_id and get_membership(db, user_id, org_id):
        return chemical

    raise HTTPException(status_code=404, detail="Chemical not found")


@app.post("/chemicals", response_model=schemas.Chemical)
def create_chemical(
    chemical: schemas.ChemicalCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    data = _to_dict(chemical)

    org_id = data.get("organization_id")
    if org_id is not None:
        if not get_membership(db, user_id, org_id):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
    else:
        # Personal chemical
        data["organization_id"] = None

    db_chemical = models.Chemical(**data, user_id=user_id)
    db.add(db_chemical)
    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.put("/chemicals/{chemical_id}", response_model=schemas.Chemical)
def update_chemical(
    chemical_id: int,
    chemical: schemas.ChemicalUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    db_chemical = (
        db.query(models.Chemical)
        .filter(models.Chemical.id == chemical_id)
        .first()
    )
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    org_id = getattr(db_chemical, "organization_id", None)
    if org_id:
        if not get_membership(db, user_id, org_id):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
    elif db_chemical.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chemical not found")

    update_data = _to_dict(chemical, exclude_unset=True)
    # Do not let clients reassign ownership casually
    update_data.pop("user_id", None)

    for key, value in update_data.items():
        setattr(db_chemical, key, value)

    db.commit()
    db.refresh(db_chemical)
    return db_chemical


@app.delete("/chemicals/{chemical_id}")
def delete_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    db_chemical = (
        db.query(models.Chemical)
        .filter(models.Chemical.id == chemical_id)
        .first()
    )
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    org_id = getattr(db_chemical, "organization_id", None)
    if org_id:
        membership = get_membership(db, user_id, org_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
    elif db_chemical.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chemical not found")

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
    user_id: str = Depends(get_current_user_id),
):
    db_chemical = (
        db.query(models.Chemical)
        .filter(models.Chemical.id == chemical_id)
        .first()
    )
    if not db_chemical:
        raise HTTPException(status_code=404, detail="Chemical not found")

    org_id = getattr(db_chemical, "organization_id", None)
    if org_id:
        if not get_membership(db, user_id, org_id):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
    elif db_chemical.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chemical not found")

    file_path = f"{user_id}/{chemical_id}/{file.filename}"
    file_content = file.file.read()

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type, "upsert": "true"},
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
    user_id: str = Depends(get_current_user_id),
):
    chemical = (
        db.query(models.Chemical)
        .filter(models.Chemical.id == chemical_id)
        .first()
    )
    if not chemical or not chemical.sds_filename:
        raise HTTPException(status_code=404, detail="SDS file not found")

    org_id = getattr(chemical, "organization_id", None)
    if org_id:
        if not get_membership(db, user_id, org_id):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
    elif chemical.user_id != user_id:
        raise HTTPException(status_code=404, detail="SDS file not found")

    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(chemical.sds_filename)
    return {"url": public_url}


# ========== Organizations (Phase 1) ==========

@app.post("/organizations", response_model=schemas.OrganizationOut)
def create_organization(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    base_slug = _slugify(payload.name)
    slug = base_slug
    n = 1
    while db.query(models.Organization).filter(models.Organization.slug == slug).first():
        n += 1
        slug = f"{base_slug}-{n}"

    org = models.Organization(
        name=payload.name.strip(),
        slug=slug,
        created_by=user_id,
    )
    db.add(org)
    db.flush()

    member = models.OrganizationMember(
        organization_id=org.id,
        user_id=user_id,
        role="owner",
    )
    db.add(member)
    db.commit()
    db.refresh(org)

    return schemas.OrganizationOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        created_by=org.created_by,
        created_at=org.created_at,
        role="owner",
    )


@app.get("/organizations", response_model=List[schemas.OrganizationOut])
def list_my_organizations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    rows = (
        db.query(models.Organization, models.OrganizationMember.role)
        .join(
            models.OrganizationMember,
            models.OrganizationMember.organization_id == models.Organization.id,
        )
        .filter(models.OrganizationMember.user_id == user_id)
        .all()
    )
    return [
        schemas.OrganizationOut(
            id=org.id,
            name=org.name,
            slug=org.slug,
            created_by=org.created_by,
            created_at=org.created_at,
            role=role,
        )
        for org, role in rows
    ]


@app.get(
    "/organizations/{organization_id}/members",
    response_model=List[schemas.OrganizationMemberOut],
)
def list_org_members(
    organization_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not get_membership(db, user_id, organization_id):
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    return (
        db.query(models.OrganizationMember)
        .filter(models.OrganizationMember.organization_id == organization_id)
        .all()
    )


@app.get("/workspace", response_model=schemas.WorkspaceContext)
def get_workspace_hint(
    organization_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Frontend uses this for Personal vs Organization switch."""
    if not organization_id:
        return schemas.WorkspaceContext(mode="personal")

    membership = get_membership(db, user_id, organization_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    org = (
        db.query(models.Organization)
        .filter(models.Organization.id == organization_id)
        .first()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return schemas.WorkspaceContext(
        mode="organization",
        organization_id=org.id,
        organization_name=org.name,
        role=membership.role,
    )


# ========== Transactions (optional – stops frontend 404) ==========
_TRANSACTIONS: list = []


@app.get("/transactions")
def get_transactions(user_id: str = Depends(get_current_user_id)):
    return [t for t in _TRANSACTIONS if t.get("user_id") == user_id]


@app.post("/transactions")
def create_transaction(
    payload: dict,
    user_id: str = Depends(get_current_user_id),
):
    row = {
        "id": f"tx-{len(_TRANSACTIONS) + 1}",
        "user_id": user_id,
        **payload,
    }
    if "created_at" not in row:
        row["created_at"] = datetime.now(timezone.utc).isoformat()
    _TRANSACTIONS.insert(0, row)
    return row