from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Set, Any, Dict
from datetime import datetime, timezone, date, timedelta
from uuid import UUID
import os
import re
import secrets

from supabase import create_client, Client

from . import models, schemas
from .database import engine, get_db

try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print("create_all warning:", e)

app = FastAPI(title="Chemical Inventory API")

ALLOWED_ORIGINS = [
    "https://labchemicalinventory.com",
    "https://www.labchemicalinventory.com",
    "https://chemical-inventory-zihn.vercel.app",
    "https://chemicalinventory-three.vercel.app",
    "https://chemicalinventory-git-main-chemical-inventory.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
VERCEL_ORIGIN_REGEX = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=VERCEL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin") or ""
        allowed = origin in ALLOWED_ORIGINS or bool(re.match(VERCEL_ORIGIN_REGEX, origin))

        if request.method == "OPTIONS" and allowed:
            return JSONResponse(
                content={"ok": True},
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
                    "Access-Control-Allow-Headers": request.headers.get(
                        "access-control-request-headers", "*"
                    ),
                    "Access-Control-Max-Age": "86400",
                },
            )

        try:
            response = await call_next(request)
        except Exception as exc:
            print("Unhandled error:", repr(exc))
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})

        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        return response


app.add_middleware(EnsureCORSHeadersMiddleware)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qgdtkwhgszvcywsnuyff.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_KEY:
    print("WARNING: SUPABASE_SERVICE_KEY is missing")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
BUCKET_NAME = "sds-files"

# Columns safe to set on Chemical from API payloads
CHEMICAL_WRITE_FIELDS = {
    "name", "cas_number", "quantity", "unit", "location",
    "loc_building", "loc_room", "loc_cabinet", "loc_shelf",
    "expiry_date", "min_stock", "hazard_notes", "molecular_formula",
    "hazard_symbols", "chemical_classes", "batch_lot", "supplier", "barcode",
    "container_code", "parent_chemical_id", "sds_reviewed_at", "sds_review_months",
    "archived", "in_collection", "organization_id", "lab_unit_id",
}


def _to_dict(obj, exclude_unset: bool = False):
    if hasattr(obj, "model_dump"):
        return obj.model_dump(exclude_unset=exclude_unset)
    return obj.dict(exclude_unset=exclude_unset)


def _parse_uuid(value: Any) -> Optional[UUID]:
    if value is None or value == "":
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception:
        return None


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_str_list(value: Any) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, list):
        return [str(x) for x in value if x is not None]
    if isinstance(value, str):
        parts = [p.strip() for p in value.split(",") if p.strip()]
        return parts or None
    return None


def _as_date_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _as_datetime_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def chemical_to_dict(r: Any) -> dict:
    try:
        if hasattr(schemas, "Chemical"):
            return schemas.Chemical.model_validate(r).model_dump(mode="json")
    except Exception as ve:
        print("Chemical validation error id=", getattr(r, "id", None), ":", ve)

    org_id = getattr(r, "organization_id", None)
    lab_id = getattr(r, "lab_unit_id", None)
    parent_id = getattr(r, "parent_chemical_id", None)
    return {
        "id": int(getattr(r, "id", 0) or 0),
        "name": getattr(r, "name", None) or "",
        "cas_number": getattr(r, "cas_number", None),
        "quantity": _as_float(getattr(r, "quantity", None), 0.0),
        "unit": getattr(r, "unit", None) or "g",
        "location": getattr(r, "location", None),
        "loc_building": getattr(r, "loc_building", None),
        "loc_room": getattr(r, "loc_room", None),
        "loc_cabinet": getattr(r, "loc_cabinet", None),
        "loc_shelf": getattr(r, "loc_shelf", None),
        "expiry_date": _as_date_iso(getattr(r, "expiry_date", None)),
        "min_stock": _as_float(getattr(r, "min_stock", None), 0.0),
        "hazard_notes": getattr(r, "hazard_notes", None),
        "molecular_formula": getattr(r, "molecular_formula", None),
        "hazard_symbols": _as_str_list(getattr(r, "hazard_symbols", None)) or [],
        "chemical_classes": _as_str_list(getattr(r, "chemical_classes", None)) or [],
        "batch_lot": getattr(r, "batch_lot", None),
        "supplier": getattr(r, "supplier", None),
        "barcode": getattr(r, "barcode", None),
        "container_code": getattr(r, "container_code", None),
        "parent_chemical_id": parent_id,
        "sds_reviewed_at": _as_date_iso(getattr(r, "sds_reviewed_at", None)),
        "sds_review_months": getattr(r, "sds_review_months", None) or 12,
        "archived": bool(getattr(r, "archived", False)),
        "archived_at": _as_datetime_iso(getattr(r, "archived_at", None)),
        "archived_by": getattr(r, "archived_by", None),
        "in_collection": bool(getattr(r, "in_collection", False)),
        "organization_id": str(org_id) if org_id is not None else None,
        "lab_unit_id": str(lab_id) if lab_id is not None else None,
        "sds_filename": getattr(r, "sds_filename", None),
        "user_id": getattr(r, "user_id", None),
        "created_at": _as_datetime_iso(getattr(r, "created_at", None)),
        "updated_at": _as_datetime_iso(getattr(r, "updated_at", None)),
    }


def get_current_user(
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Return {id, email} from Bearer JWT."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured")
    token = authorization.replace("Bearer ", "").strip()
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user or not user.id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": str(user.id), "email": getattr(user, "email", None)}
    except HTTPException:
        raise
    except Exception as e:
        print("Auth error:", str(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    return get_current_user(authorization)["id"]


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return s[:60] if s else "org"


def get_membership(
    db: Session, user_id: str, organization_id: Any
) -> Optional[models.OrganizationMember]:
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        return None
    return (
        db.query(models.OrganizationMember)
        .filter(
            models.OrganizationMember.user_id == str(user_id),
            models.OrganizationMember.organization_id == org_uuid,
        )
        .first()
    )


def require_org_role(
    db: Session, user_id: str, organization_id: Any, allowed: Set[str]
) -> models.OrganizationMember:
    membership = get_membership(db, user_id, organization_id)
    if not membership or membership.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient organization permissions")
    return membership


def can_access_chemical(db: Session, user_id: str, chemical: models.Chemical) -> bool:
    org_id = getattr(chemical, "organization_id", None)
    if org_id:
        return get_membership(db, user_id, org_id) is not None
    return str(chemical.user_id) == str(user_id)


def write_audit(
    db: Session,
    *,
    action: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    organization_id: Any = None,
    lab_unit_id: Any = None,
    chemical_id: Optional[int] = None,
    chemical_name: Optional[str] = None,
    detail: Optional[dict] = None,
) -> None:
    if not hasattr(models, "AuditEvent"):
        return
    try:
        row = models.AuditEvent(
            action=action,
            user_id=str(user_id) if user_id else None,
            user_email=user_email,
            organization_id=_parse_uuid(organization_id),
            lab_unit_id=_parse_uuid(lab_unit_id),
            chemical_id=chemical_id,
            chemical_name=chemical_name,
            detail=detail or {},
        )
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print("audit write skipped:", e)


def _filter_chemical_payload(data: dict) -> dict:
    out = {k: v for k, v in data.items() if k in CHEMICAL_WRITE_FIELDS}
    # Drop keys for columns that may not exist yet on older DBs — setattr will still work if model has them
    return out


def _join_location_from_parts(data: dict) -> Optional[str]:
    parts = [
        (data.get("loc_building") or "").strip(),
        (data.get("loc_room") or "").strip(),
        (data.get("loc_cabinet") or "").strip(),
        (data.get("loc_shelf") or "").strip(),
    ]
    parts = [p for p in parts if p]
    if parts:
        return " / ".join(parts)
    loc = data.get("location")
    return loc.strip() if isinstance(loc, str) and loc.strip() else None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"message": "Chemical Inventory API is running"}


@app.get("/health")
def health():
    return {"ok": True, "cors": "enabled", "phases": "A-B-C"}


# ---------------------------------------------------------------------------
# Chemicals
# ---------------------------------------------------------------------------

@app.get("/chemicals")
def get_chemicals(
    organization_id: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    lab_unit_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        org_uuid = _parse_uuid(organization_id)
        lab_uuid = _parse_uuid(lab_unit_id)

        if org_uuid is None:
            q = db.query(models.Chemical).filter(models.Chemical.user_id == str(user_id))
            try:
                q = q.filter(models.Chemical.organization_id.is_(None))
            except Exception as e:
                print("personal org filter skipped:", e)
        else:
            if not get_membership(db, user_id, org_uuid):
                raise HTTPException(status_code=403, detail="Not a member of this organization")
            q = db.query(models.Chemical).filter(models.Chemical.organization_id == org_uuid)

        if hasattr(models.Chemical, "archived") and not include_archived:
            try:
                q = q.filter(models.Chemical.archived.is_(False))
            except Exception:
                pass

        if lab_uuid is not None and hasattr(models.Chemical, "lab_unit_id"):
            try:
                q = q.filter(models.Chemical.lab_unit_id == lab_uuid)
            except Exception:
                pass

        rows = q.order_by(models.Chemical.name).all()
        return [chemical_to_dict(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        print("GET /chemicals error:", repr(e))
        raise HTTPException(status_code=500, detail=f"Could not load chemicals: {e}")


@app.get("/chemicals/{chemical_id}")
def get_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chemical or not can_access_chemical(db, user_id, chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")
    return chemical_to_dict(chemical)


@app.post("/chemicals")
def create_chemical(
    chemical: schemas.ChemicalCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    data = _filter_chemical_payload(_to_dict(chemical))
    org_uuid = _parse_uuid(data.get("organization_id"))
    lab_uuid = _parse_uuid(data.get("lab_unit_id"))

    if org_uuid is not None:
        if not get_membership(db, user_id, org_uuid):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        data["organization_id"] = org_uuid
    else:
        data["organization_id"] = None

    data["lab_unit_id"] = lab_uuid
    if data.get("quantity") is None:
        data["quantity"] = 0.0
    if data.get("min_stock") is None:
        data["min_stock"] = 0.0
    joined = _join_location_from_parts(data)
    if joined:
        data["location"] = joined
    if data.get("archived") is None:
        data["archived"] = False

    # Only pass attrs that exist on the model
    model_cols = {c.name for c in models.Chemical.__table__.columns}
    safe = {k: v for k, v in data.items() if k in model_cols}

    db_chemical = models.Chemical(**safe, user_id=str(user_id))
    db.add(db_chemical)
    db.commit()
    db.refresh(db_chemical)

    write_audit(
        db,
        action="chemical_create",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=org_uuid,
        chemical_id=db_chemical.id,
        chemical_name=db_chemical.name,
        detail={"location": db_chemical.location},
    )
    return chemical_to_dict(db_chemical)


@app.put("/chemicals/{chemical_id}")
def update_chemical(
    chemical_id: int,
    chemical: schemas.ChemicalUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical or not can_access_chemical(db, user_id, db_chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    update_data = _filter_chemical_payload(_to_dict(chemical, exclude_unset=True))
    update_data.pop("user_id", None)

    if "organization_id" in update_data:
        new_org = _parse_uuid(update_data.get("organization_id"))
        update_data["organization_id"] = new_org
        if new_org is not None and not get_membership(db, user_id, new_org):
            raise HTTPException(status_code=403, detail="Not a member of target organization")

    if "lab_unit_id" in update_data:
        update_data["lab_unit_id"] = _parse_uuid(update_data.get("lab_unit_id"))

    if any(k in update_data for k in ("loc_building", "loc_room", "loc_cabinet", "loc_shelf")):
        merged = {
            "loc_building": update_data.get("loc_building", getattr(db_chemical, "loc_building", None)),
            "loc_room": update_data.get("loc_room", getattr(db_chemical, "loc_room", None)),
            "loc_cabinet": update_data.get("loc_cabinet", getattr(db_chemical, "loc_cabinet", None)),
            "loc_shelf": update_data.get("loc_shelf", getattr(db_chemical, "loc_shelf", None)),
            "location": update_data.get("location", db_chemical.location),
        }
        joined = _join_location_from_parts(merged)
        if joined:
            update_data["location"] = joined

    model_cols = {c.name for c in models.Chemical.__table__.columns}
    for key, value in update_data.items():
        if key in model_cols:
            setattr(db_chemical, key, value)

    db.commit()
    db.refresh(db_chemical)

    write_audit(
        db,
        action="chemical_update",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=getattr(db_chemical, "organization_id", None),
        chemical_id=db_chemical.id,
        chemical_name=db_chemical.name,
        detail={"fields": list(update_data.keys())},
    )
    return chemical_to_dict(db_chemical)


@app.post("/chemicals/{chemical_id}/archive")
def archive_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    chem = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chem or not can_access_chemical(db, user_id, chem):
        raise HTTPException(status_code=404, detail="Chemical not found")
    if hasattr(chem, "archived"):
        chem.archived = True
        if hasattr(chem, "archived_at"):
            chem.archived_at = datetime.now(timezone.utc)
        if hasattr(chem, "archived_by"):
            chem.archived_by = str(user_id)
        db.commit()
        db.refresh(chem)
    write_audit(
        db,
        action="chemical_archive",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=getattr(chem, "organization_id", None),
        chemical_id=chem.id,
        chemical_name=chem.name,
    )
    return chemical_to_dict(chem)


@app.post("/chemicals/{chemical_id}/unarchive")
def unarchive_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    chem = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chem or not can_access_chemical(db, user_id, chem):
        raise HTTPException(status_code=404, detail="Chemical not found")
    if hasattr(chem, "archived"):
        chem.archived = False
        if hasattr(chem, "archived_at"):
            chem.archived_at = None
        if hasattr(chem, "archived_by"):
            chem.archived_by = None
        db.commit()
        db.refresh(chem)
    write_audit(
        db,
        action="chemical_unarchive",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=getattr(chem, "organization_id", None),
        chemical_id=chem.id,
        chemical_name=chem.name,
    )
    return chemical_to_dict(chem)


@app.post("/chemicals/{chemical_id}/sds-reviewed")
def mark_sds_reviewed(
    chemical_id: int,
    months: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    chem = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chem or not can_access_chemical(db, user_id, chem):
        raise HTTPException(status_code=404, detail="Chemical not found")
    today = date.today()
    if hasattr(chem, "sds_reviewed_at"):
        chem.sds_reviewed_at = today
    if hasattr(chem, "sds_review_months"):
        chem.sds_review_months = months
    db.commit()
    db.refresh(chem)
    write_audit(
        db,
        action="sds_reviewed",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=getattr(chem, "organization_id", None),
        chemical_id=chem.id,
        chemical_name=chem.name,
        detail={"sds_reviewed_at": today.isoformat(), "months": months},
    )
    return chemical_to_dict(chem)


@app.delete("/chemicals/{chemical_id}")
def delete_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical or not can_access_chemical(db, user_id, db_chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    name = db_chemical.name
    org_id = getattr(db_chemical, "organization_id", None)

    if db_chemical.sds_filename and supabase is not None:
        try:
            supabase.storage.from_(BUCKET_NAME).remove([db_chemical.sds_filename])
        except Exception:
            pass

    db.delete(db_chemical)
    db.commit()
    write_audit(
        db,
        action="chemical_delete",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=org_id,
        chemical_id=chemical_id,
        chemical_name=name,
    )
    return {"message": "Chemical deleted successfully"}


@app.post("/chemicals/{chemical_id}/upload-sds")
def upload_sds(
    chemical_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured")

    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical or not can_access_chemical(db, user_id, db_chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    file_path = f"{user_id}/{chemical_id}/{file.filename}"
    file_content = file.file.read()
    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={
                "content-type": file.content_type or "application/pdf",
                "upsert": "true",
            },
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
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured")
    chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not chemical or not chemical.sds_filename or not can_access_chemical(db, user_id, chemical):
        raise HTTPException(status_code=404, detail="SDS file not found")
    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(chemical.sds_filename)
    return {"url": public_url}


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

@app.get("/collections/me")
def get_my_collection(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if hasattr(models, "UserCollection"):
        rows = (
            db.query(models.Chemical)
            .join(models.UserCollection, models.UserCollection.chemical_id == models.Chemical.id)
            .filter(models.UserCollection.user_id == str(user_id))
            .order_by(models.Chemical.name)
            .all()
        )
        return [chemical_to_dict(r) for r in rows]
    rows = (
        db.query(models.Chemical)
        .filter(models.Chemical.user_id == str(user_id), models.Chemical.in_collection.is_(True))
        .order_by(models.Chemical.name)
        .all()
    )
    return [chemical_to_dict(r) for r in rows]


@app.post("/collections/toggle")
def toggle_collection(
    payload: schemas.CollectionToggle,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    chemical = db.query(models.Chemical).filter(models.Chemical.id == payload.chemical_id).first()
    if not chemical or not can_access_chemical(db, user_id, chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    if hasattr(models, "UserCollection"):
        existing = (
            db.query(models.UserCollection)
            .filter(
                models.UserCollection.user_id == str(user_id),
                models.UserCollection.chemical_id == payload.chemical_id,
            )
            .first()
        )
        if existing:
            db.delete(existing)
            db.commit()
            return {"chemical_id": payload.chemical_id, "in_collection": False}
        db.add(models.UserCollection(user_id=str(user_id), chemical_id=payload.chemical_id))
        db.commit()
        return {"chemical_id": payload.chemical_id, "in_collection": True}

    chemical.in_collection = not bool(getattr(chemical, "in_collection", False))
    db.commit()
    db.refresh(chemical)
    return {"chemical_id": chemical.id, "in_collection": bool(chemical.in_collection)}


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------

@app.post("/organizations", response_model=schemas.OrganizationOut)
def create_organization(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    try:
        base_slug = _slugify(payload.name)
        slug = base_slug
        n = 1
        if hasattr(models.Organization, "slug"):
            while db.query(models.Organization).filter(models.Organization.slug == slug).first():
                n += 1
                slug = f"{base_slug}-{n}"

        org_kwargs = {"name": payload.name.strip(), "created_by": str(user_id)}
        if hasattr(models.Organization, "slug"):
            org_kwargs["slug"] = slug

        org = models.Organization(**org_kwargs)
        db.add(org)
        db.flush()
        db.add(
            models.OrganizationMember(
                organization_id=org.id,
                user_id=str(user_id),
                role="owner",
            )
        )
        db.commit()
        db.refresh(org)
        write_audit(
            db,
            action="organization_create",
            user_id=user_id,
            user_email=user.get("email"),
            organization_id=org.id,
            detail={"name": org.name},
        )
        return schemas.OrganizationOut(
            id=org.id,
            name=org.name,
            slug=getattr(org, "slug", None),
            created_by=str(org.created_by) if org.created_by else None,
            created_at=org.created_at,
            role="owner",
        )
    except Exception as e:
        db.rollback()
        print("POST /organizations error:", repr(e))
        raise HTTPException(status_code=500, detail=f"Could not create organization: {e}")


@app.get("/organizations", response_model=List[schemas.OrganizationOut])
@app.get("/organizations/me", response_model=List[schemas.OrganizationOut])
def list_my_organizations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        rows = (
            db.query(models.Organization, models.OrganizationMember.role)
            .join(
                models.OrganizationMember,
                models.OrganizationMember.organization_id == models.Organization.id,
            )
            .filter(models.OrganizationMember.user_id == str(user_id))
            .all()
        )
        return [
            schemas.OrganizationOut(
                id=org.id,
                name=org.name,
                slug=getattr(org, "slug", None),
                created_by=str(org.created_by) if org.created_by else None,
                created_at=org.created_at,
                role=role,
            )
            for org, role in rows
        ]
    except Exception as e:
        print("GET /organizations error:", repr(e))
        return []


@app.get("/organizations/{organization_id}/members", response_model=List[schemas.OrganizationMemberOut])
def list_org_members(
    organization_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    if not get_membership(db, user_id, org_uuid):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return (
        db.query(models.OrganizationMember)
        .filter(models.OrganizationMember.organization_id == org_uuid)
        .all()
    )


@app.get("/workspace", response_model=schemas.WorkspaceContext)
def get_workspace_hint(
    organization_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        return schemas.WorkspaceContext(mode="personal")
    membership = get_membership(db, user_id, org_uuid)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    org = db.query(models.Organization).filter(models.Organization.id == org_uuid).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return schemas.WorkspaceContext(
        mode="organization",
        organization_id=org.id,
        organization_name=org.name,
        role=membership.role,
        lab_unit_id=getattr(membership, "lab_unit_id", None),
    )


# ---------------------------------------------------------------------------
# Lab units (Phase B)
# ---------------------------------------------------------------------------

@app.post("/organizations/{organization_id}/lab-units")
def create_lab_unit(
    organization_id: str,
    payload: schemas.LabUnitCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "LabUnit"):
        raise HTTPException(status_code=501, detail="Lab units not available")
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    require_org_role(db, user_id, org_uuid, {"owner", "admin"})
    slug = payload.slug or _slugify(payload.name)
    unit = models.LabUnit(
        organization_id=org_uuid,
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return {
        "id": str(unit.id),
        "organization_id": str(unit.organization_id),
        "name": unit.name,
        "slug": unit.slug,
        "description": unit.description,
        "created_at": _as_datetime_iso(unit.created_at),
    }


@app.get("/organizations/{organization_id}/lab-units")
def list_lab_units(
    organization_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "LabUnit"):
        return []
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    if not get_membership(db, user_id, org_uuid):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    rows = (
        db.query(models.LabUnit)
        .filter(models.LabUnit.organization_id == org_uuid)
        .order_by(models.LabUnit.name)
        .all()
    )
    return [
        {
            "id": str(u.id),
            "organization_id": str(u.organization_id),
            "name": u.name,
            "slug": u.slug,
            "description": u.description,
            "created_at": _as_datetime_iso(u.created_at),
        }
        for u in rows
    ]


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

def _invite_to_dict(invite) -> dict:
    return {
        "id": str(invite.id),
        "organization_id": str(invite.organization_id),
        "email": invite.email,
        "role": invite.role,
        "status": invite.status,
        "token": invite.token,
        "invited_by": invite.invited_by,
        "lab_unit_id": str(invite.lab_unit_id) if getattr(invite, "lab_unit_id", None) else None,
        "expires_at": _as_datetime_iso(getattr(invite, "expires_at", None)),
        "created_at": _as_datetime_iso(getattr(invite, "created_at", None)),
        "accepted_at": _as_datetime_iso(getattr(invite, "accepted_at", None)),
    }


@app.post("/organizations/{organization_id}/invites")
def invite_member(
    organization_id: str,
    payload: schemas.InviteCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    try:
        org_uuid = _parse_uuid(organization_id)
        if org_uuid is None:
            raise HTTPException(status_code=400, detail="Invalid organization_id")

        require_org_role(db, user_id, org_uuid, {"owner", "admin"})

        role = (payload.role or "member").lower()
        if role not in ("member", "admin", "ehs", "viewer"):
            raise HTTPException(status_code=400, detail="Invalid role")

        email = str(payload.email).strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Invalid email")

        existing_invite = (
            db.query(models.OrganizationInvite)
            .filter(
                models.OrganizationInvite.organization_id == org_uuid,
                models.OrganizationInvite.email == email,
                models.OrganizationInvite.status == "pending",
            )
            .first()
        )
        if existing_invite:
            return _invite_to_dict(existing_invite)

        kwargs = dict(
            organization_id=org_uuid,
            email=email,
            role=role,
            invited_by=str(user_id),
            token=secrets.token_urlsafe(32),
            status="pending",
        )
        lab_uuid = _parse_uuid(getattr(payload, "lab_unit_id", None))
        if lab_uuid is not None and hasattr(models.OrganizationInvite, "lab_unit_id"):
            kwargs["lab_unit_id"] = lab_uuid
        if hasattr(models.OrganizationInvite, "expires_at"):
            kwargs["expires_at"] = datetime.now(timezone.utc) + timedelta(days=14)

        invite = models.OrganizationInvite(**kwargs)
        db.add(invite)
        db.commit()
        db.refresh(invite)

        write_audit(
            db,
            action="invite_create",
            user_id=user_id,
            user_email=user.get("email"),
            organization_id=org_uuid,
            detail={"email": email, "role": role},
        )
        return _invite_to_dict(invite)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("POST invite error:", repr(e))
        raise HTTPException(status_code=500, detail=f"Could not create invite: {e}")


@app.get("/organizations/{organization_id}/invites")
def list_invites(
    organization_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    require_org_role(db, user_id, org_uuid, {"owner", "admin"})
    rows = (
        db.query(models.OrganizationInvite)
        .filter(models.OrganizationInvite.organization_id == org_uuid)
        .order_by(models.OrganizationInvite.created_at.desc())
        .all()
    )
    return [_invite_to_dict(i) for i in rows]


@app.post("/invites/accept", response_model=schemas.OrganizationOut)
def accept_invite(
    payload: schemas.AcceptInviteIn,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")

    invite = (
        db.query(models.OrganizationInvite)
        .filter(
            models.OrganizationInvite.token == token,
            models.OrganizationInvite.status == "pending",
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")

    if getattr(invite, "expires_at", None) and invite.expires_at < datetime.now(timezone.utc):
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Invite has expired")

    if not get_membership(db, user_id, invite.organization_id):
        member_kwargs = dict(
            organization_id=invite.organization_id,
            user_id=str(user_id),
            role=invite.role or "member",
        )
        if getattr(invite, "lab_unit_id", None) and hasattr(models.OrganizationMember, "lab_unit_id"):
            member_kwargs["lab_unit_id"] = invite.lab_unit_id
        db.add(models.OrganizationMember(**member_kwargs))

    invite.status = "accepted"
    invite.accepted_at = datetime.now(timezone.utc)
    db.commit()

    org = db.query(models.Organization).filter(models.Organization.id == invite.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    membership = get_membership(db, user_id, org.id)
    write_audit(
        db,
        action="invite_accept",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=org.id,
        detail={"invite_email": invite.email},
    )
    return schemas.OrganizationOut(
        id=org.id,
        name=org.name,
        slug=getattr(org, "slug", None),
        created_by=str(org.created_by) if org.created_by else None,
        created_at=org.created_at,
        role=membership.role if membership else (invite.role or "member"),
    )


@app.delete("/organizations/{organization_id}/invites/{invite_id}")
def revoke_invite(
    organization_id: str,
    invite_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    invite_uuid = _parse_uuid(invite_id)
    if org_uuid is None or invite_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid id")
    require_org_role(db, user_id, org_uuid, {"owner", "admin"})
    invite = (
        db.query(models.OrganizationInvite)
        .filter(
            models.OrganizationInvite.id == invite_uuid,
            models.OrganizationInvite.organization_id == org_uuid,
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.status = "revoked"
    db.commit()
    return {"message": "Invite revoked"}


@app.patch("/organizations/{organization_id}/members/{member_user_id}")
def update_member_role(
    organization_id: str,
    member_user_id: str,
    role: str = Query(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    require_org_role(db, user_id, org_uuid, {"owner"})
    if role not in ("member", "admin", "owner", "ehs", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    member = get_membership(db, member_user_id, org_uuid)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = role
    db.commit()
    return {"message": "Role updated", "user_id": member_user_id, "role": role}


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

@app.post("/audit")
def create_audit_event(
    payload: schemas.AuditEventCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if not hasattr(models, "AuditEvent"):
        raise HTTPException(status_code=501, detail="Audit not available")
    org_uuid = _parse_uuid(payload.organization_id)
    if org_uuid and not get_membership(db, user["id"], org_uuid):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    row = models.AuditEvent(
        action=payload.action,
        user_id=user["id"],
        user_email=user.get("email"),
        organization_id=org_uuid,
        lab_unit_id=_parse_uuid(payload.lab_unit_id),
        chemical_id=payload.chemical_id,
        chemical_name=payload.chemical_name,
        detail=payload.detail or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": str(row.id),
        "at": _as_datetime_iso(row.at),
        "action": row.action,
        "user_id": row.user_id,
        "user_email": row.user_email,
        "organization_id": str(row.organization_id) if row.organization_id else None,
        "chemical_id": row.chemical_id,
        "chemical_name": row.chemical_name,
        "detail": row.detail,
    }


@app.get("/audit")
def list_audit_events(
    organization_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "AuditEvent"):
        return []
    org_uuid = _parse_uuid(organization_id)
    q = db.query(models.AuditEvent)
    if org_uuid:
        if not get_membership(db, user_id, org_uuid):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        q = q.filter(models.AuditEvent.organization_id == org_uuid)
    else:
        q = q.filter(models.AuditEvent.user_id == str(user_id))
    rows = q.order_by(models.AuditEvent.at.desc()).limit(limit).all()
    return [
        {
            "id": str(r.id),
            "at": _as_datetime_iso(r.at),
            "action": r.action,
            "user_id": r.user_id,
            "user_email": r.user_email,
            "organization_id": str(r.organization_id) if r.organization_id else None,
            "chemical_id": r.chemical_id,
            "chemical_name": r.chemical_name,
            "detail": r.detail,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Waste
# ---------------------------------------------------------------------------

@app.post("/waste")
def create_waste_log(
    payload: schemas.WasteLogCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if not hasattr(models, "WasteLog"):
        raise HTTPException(status_code=501, detail="Waste log not available")
    org_uuid = _parse_uuid(payload.organization_id)
    if org_uuid and not get_membership(db, user["id"], org_uuid):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    name = payload.chemical_name
    if payload.chemical_id and not name:
        chem = db.query(models.Chemical).filter(models.Chemical.id == payload.chemical_id).first()
        if chem:
            name = chem.name
    row = models.WasteLog(
        user_id=user["id"],
        user_email=user.get("email"),
        organization_id=org_uuid,
        lab_unit_id=_parse_uuid(payload.lab_unit_id),
        chemical_id=payload.chemical_id,
        chemical_name=name,
        quantity=payload.quantity,
        unit=payload.unit,
        reason=payload.reason,
        notes=payload.notes,
        disposition=payload.disposition,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    write_audit(
        db,
        action="waste_logged",
        user_id=user["id"],
        user_email=user.get("email"),
        organization_id=org_uuid,
        chemical_id=payload.chemical_id,
        chemical_name=name,
        detail={"quantity": payload.quantity, "unit": payload.unit, "reason": payload.reason},
    )
    return {
        "id": str(row.id),
        "at": _as_datetime_iso(row.at),
        "chemical_id": row.chemical_id,
        "chemical_name": row.chemical_name,
        "quantity": row.quantity,
        "unit": row.unit,
        "reason": row.reason,
        "notes": row.notes,
        "disposition": row.disposition,
    }


@app.get("/waste")
def list_waste_logs(
    organization_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "WasteLog"):
        return []
    org_uuid = _parse_uuid(organization_id)
    q = db.query(models.WasteLog)
    if org_uuid:
        if not get_membership(db, user_id, org_uuid):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        q = q.filter(models.WasteLog.organization_id == org_uuid)
    else:
        q = q.filter(models.WasteLog.user_id == str(user_id))
    rows = q.order_by(models.WasteLog.at.desc()).limit(limit).all()
    return [
        {
            "id": str(r.id),
            "at": _as_datetime_iso(r.at),
            "user_email": r.user_email,
            "chemical_id": r.chemical_id,
            "chemical_name": r.chemical_name,
            "quantity": r.quantity,
            "unit": r.unit,
            "reason": r.reason,
            "notes": r.notes,
            "disposition": r.disposition,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Transactions (DB-backed with in-memory fallback)
# ---------------------------------------------------------------------------

_TRANSACTIONS: list = []


@app.get("/transactions")
def get_transactions(
    organization_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if hasattr(models, "InventoryTransaction"):
        try:
            q = db.query(models.InventoryTransaction).filter(
                models.InventoryTransaction.user_id == str(user_id)
            )
            org_uuid = _parse_uuid(organization_id)
            if org_uuid:
                q = q.filter(models.InventoryTransaction.organization_id == org_uuid)
            rows = q.order_by(models.InventoryTransaction.created_at.desc()).limit(500).all()
            return [
                {
                    "id": str(r.id),
                    "user_id": r.user_id,
                    "user_email": r.user_email,
                    "organization_id": str(r.organization_id) if r.organization_id else None,
                    "chemical_id": r.chemical_id,
                    "chemical_name": r.chemical_name,
                    "type": r.type,
                    "quantity_change": r.quantity_change,
                    "quantity_before": r.quantity_before,
                    "quantity_after": r.quantity_after,
                    "unit": r.unit,
                    "notes": r.notes,
                    "created_at": _as_datetime_iso(r.created_at),
                }
                for r in rows
            ]
        except Exception as e:
            print("DB transactions fallback:", e)
    return [t for t in _TRANSACTIONS if t.get("user_id") == user_id]


@app.post("/transactions")
def create_transaction(
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    if hasattr(models, "InventoryTransaction"):
        try:
            row = models.InventoryTransaction(
                user_id=user_id,
                user_email=user.get("email"),
                organization_id=_parse_uuid(payload.get("organization_id")),
                chemical_id=payload.get("chemical_id"),
                chemical_name=payload.get("chemical_name"),
                type=payload.get("type") or "take",
                quantity_change=payload.get("quantity_change"),
                quantity_before=payload.get("quantity_before"),
                quantity_after=payload.get("quantity_after"),
                unit=payload.get("unit"),
                notes=payload.get("notes"),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return {
                "id": str(row.id),
                "user_id": row.user_id,
                "user_email": row.user_email,
                "chemical_id": row.chemical_id,
                "chemical_name": row.chemical_name,
                "type": row.type,
                "quantity_change": row.quantity_change,
                "quantity_before": row.quantity_before,
                "quantity_after": row.quantity_after,
                "unit": row.unit,
                "notes": row.notes,
                "created_at": _as_datetime_iso(row.created_at),
            }
        except Exception as e:
            db.rollback()
            print("DB transaction write fallback:", e)

    mem = {
        "id": f"tx-{len(_TRANSACTIONS) + 1}",
        "user_id": user_id,
        **payload,
    }
    if "created_at" not in mem:
        mem["created_at"] = datetime.now(timezone.utc).isoformat()
    _TRANSACTIONS.insert(0, mem)
    return mem


# ---------------------------------------------------------------------------
# Account delete
# ---------------------------------------------------------------------------

@app.delete("/account")
def delete_account(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(None),
):
    """
    Best-effort account cleanup.
    Deletes auth user via Supabase Admin API when SERVICE_KEY is set.
    """
    user_id = user["id"]
    write_audit(
        db,
        action="account_delete_requested",
        user_id=user_id,
        user_email=user.get("email"),
        detail={},
    )
    deleted_auth = False
    if supabase is not None:
        try:
            # Requires service role key
            supabase.auth.admin.delete_user(user_id)
            deleted_auth = True
        except Exception as e:
            print("Supabase admin delete_user failed:", e)
    return {
        "message": "Account deletion processed",
        "auth_deleted": deleted_auth,
        "user_id": user_id,
    }


# ---------------------------------------------------------------------------
# Notification channels (Phase B light)
# ---------------------------------------------------------------------------

@app.get("/organizations/{organization_id}/notification-channels")
def list_notification_channels(
    organization_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "NotificationChannel"):
        return []
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    require_org_role(db, user_id, org_uuid, {"owner", "admin", "ehs"})
    rows = (
        db.query(models.NotificationChannel)
        .filter(models.NotificationChannel.organization_id == org_uuid)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "organization_id": str(r.organization_id),
            "channel_type": r.channel_type,
            "name": r.name,
            "target": r.target,
            "events": r.events,
            "enabled": r.enabled,
            "created_at": _as_datetime_iso(r.created_at),
        }
        for r in rows
    ]


@app.post("/organizations/{organization_id}/notification-channels")
def create_notification_channel(
    organization_id: str,
    payload: schemas.NotificationChannelCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if not hasattr(models, "NotificationChannel"):
        raise HTTPException(status_code=501, detail="Notification channels not available")
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")
    require_org_role(db, user_id, org_uuid, {"owner", "admin"})
    row = models.NotificationChannel(
        organization_id=org_uuid,
        channel_type=payload.channel_type,
        name=payload.name,
        target=payload.target,
        events=payload.events,
        enabled=payload.enabled,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": str(row.id),
        "organization_id": str(row.organization_id),
        "channel_type": row.channel_type,
        "name": row.name,
        "target": row.target,
        "events": row.events,
        "enabled": row.enabled,
    }
