from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Set, Any, Dict
from datetime import datetime, timezone, date, timedelta
from uuid import UUID
import os
import re
import secrets
import time

import jwt

from supabase import create_client, Client
from functools import lru_cache
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
# Public app URL used in invite emails (no trailing slash)
APP_ORIGIN = (os.getenv("APP_ORIGIN") or os.getenv("FRONTEND_URL") or "https://labchemicalinventory.com").rstrip("/")
# Optional: send invite emails via Resend (recommended — Supabase default mail is unreliable)
RESEND_API_KEY = os.getenv("RESEND_API_KEY") or ""
INVITE_FROM_EMAIL = os.getenv("INVITE_FROM_EMAIL") or "Chemical Inventory <onboarding@resend.dev>"


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


# ========== Auth (local JWT verify + short cache) ==========
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET") or ""

# token -> (expires_monotonic, user_dict)
_TOKEN_CACHE: dict = {}
_TOKEN_CACHE_TTL_SEC = 60
_TOKEN_CACHE_MAX = 512


def _cache_get(token: str):
    item = _TOKEN_CACHE.get(token)
    if not item:
        return None
    expires_at, user = item
    if time.monotonic() > expires_at:
        _TOKEN_CACHE.pop(token, None)
        return None
    return user


def _cache_set(token: str, user: dict) -> None:
    if len(_TOKEN_CACHE) >= _TOKEN_CACHE_MAX:
        for k in list(_TOKEN_CACHE.keys())[:64]:
            _TOKEN_CACHE.pop(k, None)
    _TOKEN_CACHE[token] = (time.monotonic() + _TOKEN_CACHE_TTL_SEC, user)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Validate Supabase access token.

    1) Local HS256 verify when SUPABASE_JWT_SECRET is set (legacy projects).
    2) On any local failure (wrong secret, ES256/asymmetric JWT, aud mismatch),
       fall back to supabase.auth.get_user(token) using the service client.
    3) If secret is unset, use remote get_user only.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    cached = _cache_get(token)
    if cached is not None:
        return cached

    jwt_error = None

    # --- Try local HS256 verify (may fail on new Supabase asymmetric JWTs) ---
    if SUPABASE_JWT_SECRET:
        try:
            try:
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"require": ["exp", "sub"]},
                )
            except jwt.InvalidAudienceError:
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    options={"require": ["exp", "sub"], "verify_aud": False},
                )

            user_id = payload.get("sub")
            if user_id:
                email = payload.get("email")
                if not email and isinstance(payload.get("user_metadata"), dict):
                    email = payload["user_metadata"].get("email")
                result = {
                    "id": str(user_id),
                    "email": email,
                    "role": payload.get("role"),
                }
                _cache_set(token, result)
                return result
        except jwt.ExpiredSignatureError:
            # Truly expired — do not fall back (get_user would also fail)
            raise HTTPException(status_code=401, detail="Token expired — please sign in again")
        except jwt.PyJWTError as e:
            jwt_error = e
            print("Auth local JWT failed, will try supabase.auth.get_user:", repr(e))

    # --- Remote validation via Supabase Auth API (works with service or anon key) ---
    if supabase is None:
        detail = "Supabase is not configured on the API"
        if jwt_error:
            detail = f"Token could not be verified ({jwt_error}). SUPABASE_SERVICE_KEY missing."
        raise HTTPException(status_code=500, detail=detail)

    try:
        user_response = supabase.auth.get_user(token)
        user = getattr(user_response, "user", None)
        if not user or not getattr(user, "id", None):
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token — please sign out and sign in again",
            )
        result = {
            "id": str(user.id),
            "email": getattr(user, "email", None),
        }
        _cache_set(token, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print("Auth error (get_user):", repr(e))
        raise HTTPException(
            status_code=401,
            detail=f"Invalid or expired token — please sign in again ({e})",
        )


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    return get_current_user(authorization)["id"]


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return s[:60] if s else "org"


def _db_columns(db: Session, table: str) -> Set[str]:
    """Actual Postgres columns for a public table (avoids ORM/DB drift)."""
    try:
        rows = db.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :t"
            ),
            {"t": table},
        ).fetchall()
        return {str(r[0]) for r in rows}
    except Exception as e:
        print("_db_columns failed:", repr(e))
        return set()


def _invite_row_to_dict(row) -> dict:
    if row is None:
        return {}
    data = dict(row) if hasattr(row, "keys") else dict(row)
    return {
        "id": str(data.get("id")) if data.get("id") is not None else None,
        "organization_id": str(data["organization_id"]) if data.get("organization_id") is not None else None,
        "email": data.get("email"),
        "role": data.get("role") or "member",
        "status": data.get("status") or "pending",
        "token": data.get("token"),
        "invited_by": data.get("invited_by"),
        "lab_unit_id": str(data["lab_unit_id"]) if data.get("lab_unit_id") is not None else None,
        "expires_at": _as_datetime_iso(data.get("expires_at")),
        "created_at": _as_datetime_iso(data.get("created_at")),
        "accepted_at": _as_datetime_iso(data.get("accepted_at")),
    }


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
    name = (getattr(payload, "name", None) or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Organization name must be at least 2 characters")

    try:
        base_slug = _slugify(name)
        slug = base_slug
        n = 1
        if hasattr(models.Organization, "slug"):
            while db.query(models.Organization).filter(models.Organization.slug == slug).first():
                n += 1
                slug = f"{base_slug}-{n}"
                if n > 50:
                    slug = f"{base_slug}-{secrets.token_hex(3)}"
                    break

        org_cols = {c.name for c in models.Organization.__table__.columns}
        org_kwargs = {"name": name}
        if "created_by" in org_cols:
            org_kwargs["created_by"] = str(user_id)
        if "slug" in org_cols:
            org_kwargs["slug"] = slug

        org = models.Organization(**org_kwargs)
        db.add(org)
        db.flush()

        member_cols = {c.name for c in models.OrganizationMember.__table__.columns}
        member_kwargs = {
            "organization_id": org.id,
            "user_id": str(user_id),
            "role": "owner",
        }
        # Drop unknown columns (older schemas)
        member_kwargs = {k: v for k, v in member_kwargs.items() if k in member_cols}
        db.add(models.OrganizationMember(**member_kwargs))
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
            created_by=str(org.created_by) if getattr(org, "created_by", None) else None,
            created_at=getattr(org, "created_at", None),
            role="owner",
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("POST /organizations error:", repr(e))
        # SQL fallback if ORM model columns drift from DB
        try:
            slug = _slugify(name)
            row = db.execute(
                text(
                    """
                    INSERT INTO organizations (name, slug, created_by)
                    VALUES (:name, :slug, :created_by)
                    RETURNING id, name, slug, created_by, created_at
                    """
                ),
                {"name": name, "slug": slug, "created_by": str(user_id)},
            ).mappings().first()
            if not row:
                # Try without slug
                row = db.execute(
                    text(
                        """
                        INSERT INTO organizations (name, created_by)
                        VALUES (:name, :created_by)
                        RETURNING id, name, created_by, created_at
                        """
                    ),
                    {"name": name, "created_by": str(user_id)},
                ).mappings().first()
            if not row:
                raise RuntimeError("INSERT organizations returned no row")

            org_id = row["id"]
            try:
                db.execute(
                    text(
                        """
                        INSERT INTO organization_members (organization_id, user_id, role)
                        VALUES (:organization_id, :user_id, :role)
                        """
                    ),
                    {
                        "organization_id": str(org_id),
                        "user_id": str(user_id),
                        "role": "owner",
                    },
                )
            except Exception as mem_err:
                print("member insert fallback warning:", repr(mem_err))
            db.commit()

            write_audit(
                db,
                action="organization_create",
                user_id=user_id,
                user_email=user.get("email"),
                organization_id=org_id,
                detail={"name": name, "fallback": True},
            )
            return schemas.OrganizationOut(
                id=org_id,
                name=row.get("name") or name,
                slug=row.get("slug"),
                created_by=str(row["created_by"]) if row.get("created_by") else str(user_id),
                created_at=row.get("created_at"),
                role="owner",
            )
        except Exception as e2:
            db.rollback()
            print("POST /organizations SQL fallback failed:", repr(e2))
            raise HTTPException(
                status_code=500,
                detail=f"Could not create organization: {e}; fallback: {e2}",
            )


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


def _resolve_auth_user_profile(uid: str) -> dict:
    """Best-effort email / name from Supabase Auth admin API."""
    out = {"email": None, "full_name": None}
    if not uid or supabase is None:
        return out
    try:
        resp = supabase.auth.admin.get_user_by_id(str(uid))
        user = getattr(resp, "user", None) or resp
        if not user:
            return out
        out["email"] = getattr(user, "email", None)
        meta = getattr(user, "user_metadata", None) or {}
        if isinstance(meta, dict):
            out["full_name"] = (
                meta.get("full_name")
                or meta.get("name")
                or meta.get("display_name")
            )
        return out
    except Exception as e:
        print("get_user_by_id failed:", uid, repr(e))
        return out


@app.get("/organizations/{organization_id}/members")
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

    cols = _db_columns(db, "organization_members")
    wanted = ["id", "organization_id", "user_id", "role", "lab_unit_id", "created_at", "email"]
    select_cols = [c for c in wanted if not cols or c in cols]
    if not select_cols:
        select_cols = ["user_id", "role"]
    try:
        rows = db.execute(
            text(
                f"SELECT {', '.join(select_cols)} FROM organization_members "
                "WHERE organization_id = :organization_id"
            ),
            {"organization_id": str(org_uuid)},
        ).mappings().all()
        base = [dict(r) for r in rows]
    except Exception as e:
        print("list_org_members SQL error:", repr(e))
        members = (
            db.query(models.OrganizationMember)
            .filter(models.OrganizationMember.organization_id == org_uuid)
            .all()
        )
        base = [
            {
                "id": getattr(m, "id", None),
                "organization_id": m.organization_id,
                "user_id": m.user_id,
                "role": m.role,
                "email": getattr(m, "email", None),
            }
            for m in members
        ]

    result = []
    for r in base:
        uid = r.get("user_id")
        email = r.get("email")
        full_name = None
        if not email or not full_name:
            profile = _resolve_auth_user_profile(str(uid) if uid else "")
            email = email or profile.get("email")
            full_name = profile.get("full_name")
        result.append(
            {
                "id": str(r["id"]) if r.get("id") is not None else None,
                "organization_id": str(r["organization_id"])
                if r.get("organization_id") is not None
                else str(org_uuid),
                "user_id": str(uid) if uid is not None else None,
                "role": r.get("role") or "member",
                "email": email,
                "full_name": full_name,
                "lab_unit_id": str(r["lab_unit_id"]) if r.get("lab_unit_id") is not None else None,
            }
        )
    return result


@app.delete("/organizations/{organization_id}/members/{member_user_id}")
def remove_org_member(
    organization_id: str,
    member_user_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Remove a member from the organization (owner/admin only).
    Does not delete their Auth account — only org membership.
    """
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    actor_id = user["id"]
    require_org_role(db, actor_id, org_uuid, {"owner", "admin"})

    target = str(member_user_id).strip()
    if not target:
        raise HTTPException(status_code=400, detail="member_user_id required")

    if target == str(actor_id):
        raise HTTPException(status_code=400, detail="You cannot remove yourself from the organization")

    target_membership = get_membership(db, target, org_uuid)
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found in this organization")

    # Only an owner can remove another owner/admin; admins can remove members
    actor_membership = get_membership(db, actor_id, org_uuid)
    actor_role = (actor_membership.role if actor_membership else "").lower()
    target_role = (target_membership.role or "member").lower()
    if target_role in ("owner", "admin") and actor_role != "owner":
        raise HTTPException(status_code=403, detail="Only an owner can remove admins/owners")

    try:
        db.execute(
            text(
                "DELETE FROM organization_members "
                "WHERE organization_id = :organization_id AND user_id = :user_id"
            ),
            {"organization_id": str(org_uuid), "user_id": target},
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print("remove_org_member error:", repr(e))
        raise HTTPException(status_code=500, detail=f"Could not remove member: {e}")

    write_audit(
        db,
        action="member_remove",
        user_id=actor_id,
        user_email=user.get("email"),
        organization_id=org_uuid,
        detail={"removed_user_id": target, "removed_role": target_role},
    )
    return {"message": "Member removed", "user_id": target}



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



def _send_invite_email_resend(
    *,
    to_email: str,
    org_name: str,
    invite_link: str,
    inviter_email: Optional[str] = None,
    temp_password: Optional[str] = None,
) -> tuple:
    """
    Send invite email via Resend HTTP API.
    Returns (ok: bool, error: Optional[str]).
    """
    if not RESEND_API_KEY:
        return False, "RESEND_API_KEY not set"
    try:
        import urllib.request
        import json as _json

        subject = f"You're invited to join {org_name} on Chemical Inventory"
        inviter_line = f" from {inviter_email}" if inviter_email else ""
        password_block = ""
        if temp_password:
            password_block = f"""
          <div style="margin:20px 0;padding:14px 16px;background:#f1f5f9;border-radius:10px;border:1px solid #e2e8f0">
            <p style="margin:0 0 8px;font-size:13px;color:#475569"><strong>Sign in with this email:</strong></p>
            <p style="margin:0 0 6px;font-family:ui-monospace,monospace;font-size:14px">{to_email}</p>
            <p style="margin:12px 0 8px;font-size:13px;color:#475569"><strong>Temporary password:</strong></p>
            <p style="margin:0;font-family:ui-monospace,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em">{temp_password}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.45">
              After you sign in, open <em>Forgot password</em> (or account settings) to set your own password.
              Keep this email private.
            </p>
          </div>
            """
        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
          <h2 style="margin:0 0 12px">Join {org_name}</h2>
          <p style="line-height:1.5">
            You have been invited{inviter_line} to the <strong>{org_name}</strong>
            workspace on Chemical Inventory.
          </p>
          {password_block}
          <p style="margin:24px 0">
            <a href="{invite_link}"
               style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                      padding:12px 20px;border-radius:10px;font-weight:600">
              Open invite &amp; sign in
            </a>
          </p>
          <p style="font-size:13px;color:#64748b;line-height:1.5">
            Open the link, sign in with the email and temporary password above,
            and you will join <strong>{org_name}</strong> automatically.
          </p>
          <p style="font-size:12px;color:#94a3b8;word-break:break-all">{invite_link}</p>
        </div>
        """
        payload = _json.dumps(
            {
                "from": INVITE_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if resp.status >= 200 and resp.status < 300:
                return True, None
            return False, f"Resend HTTP {resp.status}: {body}"
    except Exception as e:
        return False, str(e)


def _supabase_send_invite_email(email: str, invite_link: str, meta: dict) -> tuple:
    """
    Try Supabase Auth admin invite / magic link.
    Returns (ok: bool, error: Optional[str]).
    """
    if supabase is None:
        return False, "Supabase client not configured (SUPABASE_SERVICE_KEY)"
    errors = []
    # 1) Official invite (creates user if new)
    try:
        supabase.auth.admin.invite_user_by_email(
            email,
            options={
                "redirect_to": invite_link,
                "data": meta or {},
            },
        )
        return True, None
    except Exception as e:
        errors.append(f"invite_user_by_email: {e}")
        print("invite_user_by_email:", repr(e))

    # 2) User may already exist — magic link email
    try:
        supabase.auth.admin.generate_link(
            {
                "type": "magiclink",
                "email": email,
                "options": {"redirect_to": invite_link},
            }
        )
        # generate_link does NOT always send email depending on SDK/version;
        # try invite again is useless — mark as not sent for magiclink-only
        errors.append(
            "generate_link(magiclink) ran but does not guarantee email delivery; use Resend or Supabase SMTP"
        )
    except Exception as e:
        errors.append(f"generate_link: {e}")
        print("generate_link:", repr(e))

    return False, " | ".join(errors)


# ---------------------------------------------------------------------------
# Invites  (SQL-first — avoids ORM selecting missing columns e.g. lab_unit_id)
# ---------------------------------------------------------------------------

def _invite_to_dict(invite) -> dict:
    # ORM object or mapping
    if hasattr(invite, "keys") and not hasattr(invite, "id"):
        return _invite_row_to_dict(invite)
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


def _sql_select_invites(db: Session, where_sql: str, params: dict):
    """SELECT only columns that exist on organization_invites."""
    cols = _db_columns(db, "organization_invites")
    if not cols:
        # fallback minimal set
        cols = {
            "id", "organization_id", "email", "role", "status", "token",
            "invited_by", "created_at", "accepted_at",
        }
    wanted = [
        "id", "organization_id", "email", "role", "status", "token",
        "invited_by", "lab_unit_id", "expires_at", "created_at", "accepted_at",
    ]
    select_cols = [c for c in wanted if c in cols]
    if "id" not in select_cols:
        select_cols.insert(0, "id")
    sql = f"SELECT {', '.join(select_cols)} FROM organization_invites WHERE {where_sql}"
    return db.execute(text(sql), params).mappings().all()


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

        # Existing pending invite (SQL — no lab_unit_id required)
        existing_rows = _sql_select_invites(
            db,
            "organization_id = :organization_id AND email = :email AND status = :status",
            {
                "organization_id": str(org_uuid),
                "email": email,
                "status": "pending",
            },
        )
        if existing_rows:
            return _invite_row_to_dict(existing_rows[0])

        token = secrets.token_urlsafe(32)
        cols = _db_columns(db, "organization_invites")
        insert_cols = ["organization_id", "email", "role", "invited_by", "token", "status"]
        insert_vals = {
            "organization_id": str(org_uuid),
            "email": email,
            "role": role,
            "invited_by": str(user_id),
            "token": token,
            "status": "pending",
        }
        if "expires_at" in cols:
            insert_cols.append("expires_at")
            insert_vals["expires_at"] = datetime.now(timezone.utc) + timedelta(days=14)
        lab_uuid = _parse_uuid(getattr(payload, "lab_unit_id", None))
        if lab_uuid is not None and "lab_unit_id" in cols:
            insert_cols.append("lab_unit_id")
            insert_vals["lab_unit_id"] = str(lab_uuid)

        # Only columns that exist
        insert_cols = [c for c in insert_cols if not cols or c in cols]
        col_list = ", ".join(insert_cols)
        param_list = ", ".join(f":{c}" for c in insert_cols)
        returning = ", ".join(
            c for c in [
                "id", "organization_id", "email", "role", "status", "token",
                "invited_by", "created_at", "accepted_at", "expires_at", "lab_unit_id",
            ]
            if not cols or c in cols
        ) or "id, organization_id, email, role, status, token, invited_by"

        row = db.execute(
            text(
                f"""
                INSERT INTO organization_invites ({col_list})
                VALUES ({param_list})
                RETURNING {returning}
                """
            ),
            insert_vals,
        ).mappings().first()
        db.commit()
        if not row:
            raise HTTPException(status_code=500, detail="Could not create invite")

        write_audit(
            db,
            action="invite_create",
            user_id=user_id,
            user_email=user.get("email"),
            organization_id=org_uuid,
            detail={"email": email, "role": role},
        )

        invite_dict = _invite_row_to_dict(row)
        email_sent = False
        email_error = None
        email_provider = None

        # Resolve org name for branded link / email
        org_name = "your organization"
        try:
            org_row = (
                db.query(models.Organization)
                .filter(models.Organization.id == org_uuid)
                .first()
            )
            if org_row and getattr(org_row, "name", None):
                org_name = org_row.name
        except Exception as e:
            print("org name lookup:", repr(e))

        from urllib.parse import quote

        invite_link = (
            f"{APP_ORIGIN}/?token={quote(str(invite_dict.get('token') or token))}"
            f"&org={quote(str(org_uuid))}"
            f"&orgName={quote(org_name)}"
        )
        invite_dict["invite_link"] = invite_link

        meta = {
            "invite_token": token,
            "organization_id": str(org_uuid),
            "organization_name": org_name,
            "invited_role": role,
        }

        # Create or update Auth user with a temporary password so they can sign in
        temp_password = secrets.token_urlsafe(10)
        auth_user_ready = False
        if supabase is not None:
            try:
                supabase.auth.admin.create_user(
                    {
                        "email": email,
                        "password": temp_password,
                        "email_confirm": True,
                        "user_metadata": meta,
                    }
                )
                auth_user_ready = True
            except Exception as e_create:
                print("create_user (invite):", repr(e_create))
                # User may already exist — try set a new temp password
                try:
                    listed = supabase.auth.admin.list_users()
                    users = getattr(listed, "users", None) or listed or []
                    existing = None
                    for u in users:
                        if str(getattr(u, "email", "") or "").lower() == email:
                            existing = u
                            break
                    if existing and getattr(existing, "id", None):
                        supabase.auth.admin.update_user_by_id(
                            str(existing.id),
                            {"password": temp_password, "email_confirm": True},
                        )
                        auth_user_ready = True
                    else:
                        # Fallback: invite email (no known password)
                        try:
                            supabase.auth.admin.invite_user_by_email(
                                email,
                                options={"redirect_to": invite_link, "data": meta},
                            )
                        except Exception as e_inv:
                            print("invite_user_by_email:", repr(e_inv))
                except Exception as e2:
                    print("invite existing-user path:", repr(e2))

        # Prefer Resend with temp password + link
        if RESEND_API_KEY:
            ok, err = _send_invite_email_resend(
                to_email=email,
                org_name=org_name,
                invite_link=invite_link,
                inviter_email=user.get("email"),
                temp_password=temp_password if auth_user_ready else None,
            )
            if ok:
                email_sent = True
                email_provider = "resend"
            else:
                email_error = err
                print("Resend invite email failed:", err)

        # Fallback: Supabase Auth invite email (no password in body)
        if not email_sent:
            ok, err = _supabase_send_invite_email(email, invite_link, meta)
            if ok:
                email_sent = True
                email_provider = "supabase"
            else:
                email_error = (
                    (email_error + " | " if email_error else "") + (err or "unknown")
                )

        invite_dict["auth_user_ready"] = auth_user_ready
        if auth_user_ready and not email_sent:
            # Still return password only in API for admin to share manually (dev fallback)
            invite_dict["temp_password_dev"] = temp_password
            invite_dict["email_error"] = (
                (email_error or "")
                + " | Set RESEND_API_KEY to email the temporary password automatically."
            )

        invite_dict["email_sent"] = email_sent
        invite_dict["email_provider"] = email_provider
        if email_error and not email_sent:
            invite_dict["email_error"] = email_error
            print(
                "INVITE EMAIL NOT SENT. Set RESEND_API_KEY or configure "
                "Supabase Auth → SMTP. Link still works if shared manually:",
                invite_link,
            )
        return invite_dict
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
    try:
        rows = _sql_select_invites(
            db,
            "organization_id = :organization_id ORDER BY created_at DESC NULLS LAST",
            {"organization_id": str(org_uuid)},
        )
        return [_invite_row_to_dict(r) for r in rows]
    except Exception as e:
        print("list_invites error:", repr(e))
        # last resort without order
        try:
            rows = _sql_select_invites(
                db,
                "organization_id = :organization_id",
                {"organization_id": str(org_uuid)},
            )
            return [_invite_row_to_dict(r) for r in rows]
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Could not list invites: {e2}")


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

    rows = _sql_select_invites(
        db,
        "token = :token AND status = :status",
        {"token": token, "status": "pending"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    inv = dict(rows[0])

    expires_at = inv.get("expires_at")
    if expires_at is not None:
        try:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                db.execute(
                    text("UPDATE organization_invites SET status = 'expired' WHERE id = :id"),
                    {"id": str(inv["id"])},
                )
                db.commit()
                raise HTTPException(status_code=400, detail="Invite has expired")
        except HTTPException:
            raise
        except Exception as e:
            print("expires_at parse warning:", repr(e))

    org_id = inv["organization_id"]
    invite_role = inv.get("role") or "member"
    invite_email = inv.get("email")

    if not get_membership(db, user_id, org_id):
        member_cols = _db_columns(db, "organization_members") or {
            "organization_id", "user_id", "role"
        }
        mcols = ["organization_id", "user_id", "role"]
        mvals = {
            "organization_id": str(org_id),
            "user_id": str(user_id),
            "role": invite_role,
        }
        if inv.get("lab_unit_id") and "lab_unit_id" in member_cols:
            mcols.append("lab_unit_id")
            mvals["lab_unit_id"] = str(inv["lab_unit_id"])
        mcols = [c for c in mcols if c in member_cols]
        db.execute(
            text(
                f"INSERT INTO organization_members ({', '.join(mcols)}) "
                f"VALUES ({', '.join(':' + c for c in mcols)})"
            ),
            mvals,
        )

    # Mark invite accepted (only touch columns that exist)
    inv_cols = _db_columns(db, "organization_invites")
    if "accepted_at" in inv_cols:
        db.execute(
            text(
                "UPDATE organization_invites SET status = 'accepted', accepted_at = :accepted_at "
                "WHERE id = :id"
            ),
            {"id": str(inv["id"]), "accepted_at": datetime.now(timezone.utc)},
        )
    else:
        db.execute(
            text("UPDATE organization_invites SET status = 'accepted' WHERE id = :id"),
            {"id": str(inv["id"])},
        )
    db.commit()

    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    membership = get_membership(db, user_id, org.id)
    write_audit(
        db,
        action="invite_accept",
        user_id=user_id,
        user_email=user.get("email"),
        organization_id=org.id,
        detail={"invite_email": invite_email},
    )
    return schemas.OrganizationOut(
        id=org.id,
        name=org.name,
        slug=getattr(org, "slug", None),
        created_by=str(org.created_by) if org.created_by else None,
        created_at=org.created_at,
        role=membership.role if membership else invite_role,
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
    rows = _sql_select_invites(
        db,
        "id = :id AND organization_id = :organization_id",
        {"id": str(invite_uuid), "organization_id": str(org_uuid)},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Invite not found")
    db.execute(
        text("UPDATE organization_invites SET status = 'revoked' WHERE id = :id"),
        {"id": str(invite_uuid)},
    )
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

@app.get("/transactions")
def get_transactions(
    organization_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Personal: only the caller's transactions.
    Organization: all members' usage for that org (so admins see who used what).
    """
    if not hasattr(models, "InventoryTransaction"):
        raise HTTPException(status_code=501, detail="Transactions table missing")

    org_uuid = _parse_uuid(organization_id)
    q = db.query(models.InventoryTransaction)

    if org_uuid is not None:
        if not get_membership(db, user_id, org_uuid):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        q = q.filter(models.InventoryTransaction.organization_id == org_uuid)
    else:
        q = q.filter(
            models.InventoryTransaction.user_id == str(user_id),
            models.InventoryTransaction.organization_id.is_(None),
        )

    rows = (
        q.order_by(models.InventoryTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
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


@app.post("/transactions")
def create_transaction(
    payload: dict,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if not hasattr(models, "InventoryTransaction"):
        raise HTTPException(status_code=501, detail="Transactions table missing")

    org_uuid = _parse_uuid(payload.get("organization_id"))
    if org_uuid is not None and not get_membership(db, user["id"], org_uuid):
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    row = models.InventoryTransaction(
        user_id=user["id"],
        user_email=user.get("email") or payload.get("user_email"),
        organization_id=org_uuid,
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

    write_audit(
        db,
        action="usage_log",
        user_id=user["id"],
        user_email=user.get("email"),
        organization_id=org_uuid,
        chemical_id=payload.get("chemical_id"),
        chemical_name=payload.get("chemical_name"),
        detail={
            "type": payload.get("type") or "take",
            "quantity_change": payload.get("quantity_change"),
            "quantity_before": payload.get("quantity_before"),
            "quantity_after": payload.get("quantity_after"),
            "unit": payload.get("unit"),
            "notes": payload.get("notes"),
        },
    )

    return {
        "id": str(row.id),
        "user_id": row.user_id,
        "user_email": row.user_email,
        "organization_id": str(row.organization_id) if row.organization_id else None,
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

@app.get("/health")
def health(db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        print("health db error:", e)
    status = 200 if db_ok else 503
    return JSONResponse(
        status_code=status,
        content={"ok": db_ok, "db": db_ok, "cors": "enabled"},
    )
# ---------------------------------------------------------------------------
# Account delete
# ---------------------------------------------------------------------------

@app.delete("/account")
def delete_account(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Permanently delete the authenticated user's Auth account.

    Requires SUPABASE_SERVICE_KEY (service role) on the server.
    Cleans org memberships / invites best-effort, then deletes auth.users
    so the same email/password cannot sign in again.
    """
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured (set SUPABASE_SERVICE_KEY)",
        )

    user_id = str(user["id"])
    email = user.get("email")

    write_audit(
        db,
        action="account_delete_requested",
        user_id=user_id,
        user_email=email,
        detail={},
    )

    # --- Best-effort app data cleanup (does not block auth delete) ---
    try:
        if hasattr(models, "OrganizationMember"):
            db.query(models.OrganizationMember).filter(
                models.OrganizationMember.user_id == user_id
            ).delete(synchronize_session=False)
        if hasattr(models, "OrganizationInvite"):
            # pending invites addressed to this email
            if email:
                db.query(models.OrganizationInvite).filter(
                    models.OrganizationInvite.email == str(email).strip().lower(),
                    models.OrganizationInvite.status == "pending",
                ).delete(synchronize_session=False)
        # Personal chemicals only (leave org inventory intact for the lab)
        if hasattr(models, "Chemical"):
            q = db.query(models.Chemical).filter(models.Chemical.user_id == user_id)
            try:
                q = q.filter(models.Chemical.organization_id.is_(None))
            except Exception:
                pass
            q.delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()
        print("delete_account DB cleanup warning:", repr(e))

    # --- Permanent Auth deletion (service role) ---
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        print("Supabase admin delete_user failed:", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete auth user. Ensure SUPABASE_SERVICE_KEY is the service_role secret. Error: {e}",
        )

    return {
        "message": "Account permanently deleted",
        "auth_deleted": True,
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
