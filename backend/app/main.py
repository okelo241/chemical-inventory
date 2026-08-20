from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Set, Any
from datetime import datetime, timezone, date
from uuid import UUID
import os
import re
import secrets

from supabase import create_client, Client

from . import models, schemas
from .database import engine, get_db

# Create tables (existing DB may still need ALTER for new columns)
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print("create_all warning:", e)

app = FastAPI(title="Chemical Inventory API")

# ---------------------------------------------------------------------------
# CORS — must run early. Allow all Vercel preview/production hosts + local.
# ---------------------------------------------------------------------------
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

VERCEL_ORIGIN_REGEX = r"https://[a-zA-Z0-9-]+\.vercel\.app"

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
        allowed = origin in ALLOWED_ORIGINS or bool(
            re.match(VERCEL_ORIGIN_REGEX, origin)
        )

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
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"

        return response


app.add_middleware(EnsureCORSHeadersMiddleware)


# ========== Supabase ==========
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qgdtkwhgszvcywsnuyff.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_KEY:
    print("WARNING: SUPABASE_SERVICE_KEY is missing")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_KEY else None
BUCKET_NAME = "sds-files"


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
    """Serialize Chemical ORM row without ResponseValidationError."""
    try:
        if hasattr(schemas, "Chemical"):
            return schemas.Chemical.model_validate(r).model_dump(mode="json")
    except Exception as ve:
        print("Chemical validation error id=", getattr(r, "id", None), ":", ve)

    org_id = getattr(r, "organization_id", None)
    return {
        "id": int(getattr(r, "id", 0) or 0),
        "name": getattr(r, "name", None) or "",
        "cas_number": getattr(r, "cas_number", None),
        "quantity": _as_float(getattr(r, "quantity", None), 0.0),
        "unit": getattr(r, "unit", None) or "g",
        "location": getattr(r, "location", None),
        "expiry_date": _as_date_iso(getattr(r, "expiry_date", None)),
        "min_stock": _as_float(getattr(r, "min_stock", None), 0.0),
        "hazard_notes": getattr(r, "hazard_notes", None),
        "molecular_formula": getattr(r, "molecular_formula", None),
        "hazard_symbols": _as_str_list(getattr(r, "hazard_symbols", None)) or [],
        "chemical_classes": _as_str_list(getattr(r, "chemical_classes", None)) or [],
        "batch_lot": getattr(r, "batch_lot", None),
        "supplier": getattr(r, "supplier", None),
        "barcode": getattr(r, "barcode", None),
        "in_collection": bool(getattr(r, "in_collection", False)),
        "organization_id": str(org_id) if org_id is not None else None,
        "sds_filename": getattr(r, "sds_filename", None),
        "user_id": getattr(r, "user_id", None),
        "created_at": _as_datetime_iso(getattr(r, "created_at", None)),
        "updated_at": _as_datetime_iso(getattr(r, "updated_at", None)),
    }


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
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
        return str(user.id)
    except HTTPException:
        raise
    except Exception as e:
        print("Auth error:", str(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return (s[:60] if s else "org")


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


@app.get("/")
def read_root():
    return {"message": "Chemical Inventory API is running"}


@app.get("/health")
def health():
    return {"ok": True, "cors": "enabled"}


# ========== Chemicals (no strict response_model — fixes ResponseValidationError) ==========

@app.get("/chemicals")
def get_chemicals(
    organization_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        org_uuid = _parse_uuid(organization_id)

        if org_uuid is None:
            q = db.query(models.Chemical).filter(models.Chemical.user_id == str(user_id))
            try:
                q = q.filter(models.Chemical.organization_id.is_(None))
            except Exception as e:
                print("personal org filter skipped:", e)
            rows = q.order_by(models.Chemical.name).all()
        else:
            if not get_membership(db, user_id, org_uuid):
                raise HTTPException(status_code=403, detail="Not a member of this organization")
            rows = (
                db.query(models.Chemical)
                .filter(models.Chemical.organization_id == org_uuid)
                .order_by(models.Chemical.name)
                .all()
            )

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
    user_id: str = Depends(get_current_user_id),
):
    data = _to_dict(chemical)
    org_uuid = _parse_uuid(data.get("organization_id"))

    if org_uuid is not None:
        if not get_membership(db, user_id, org_uuid):
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        data["organization_id"] = org_uuid
    else:
        data["organization_id"] = None

    if data.get("quantity") is None:
        data["quantity"] = 0.0
    if data.get("min_stock") is None:
        data["min_stock"] = 0.0

    db_chemical = models.Chemical(**data, user_id=str(user_id))
    db.add(db_chemical)
    db.commit()
    db.refresh(db_chemical)
    return chemical_to_dict(db_chemical)


@app.put("/chemicals/{chemical_id}")
def update_chemical(
    chemical_id: int,
    chemical: schemas.ChemicalUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical or not can_access_chemical(db, user_id, db_chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    update_data = _to_dict(chemical, exclude_unset=True)
    update_data.pop("user_id", None)

    if "organization_id" in update_data:
        new_org = _parse_uuid(update_data.get("organization_id"))
        update_data["organization_id"] = new_org
        if new_org is not None and not get_membership(db, user_id, new_org):
            raise HTTPException(status_code=403, detail="Not a member of target organization")

    for key, value in update_data.items():
        setattr(db_chemical, key, value)

    db.commit()
    db.refresh(db_chemical)
    return chemical_to_dict(db_chemical)


@app.delete("/chemicals/{chemical_id}")
def delete_chemical(
    chemical_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    db_chemical = db.query(models.Chemical).filter(models.Chemical.id == chemical_id).first()
    if not db_chemical or not can_access_chemical(db, user_id, db_chemical):
        raise HTTPException(status_code=404, detail="Chemical not found")

    if db_chemical.sds_filename and supabase is not None:
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


# ========== Collections ==========

@app.get("/collections/me")
def get_my_collection(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    if hasattr(models, "UserCollection"):
        rows = (
            db.query(models.Chemical)
            .join(
                models.UserCollection,
                models.UserCollection.chemical_id == models.Chemical.id,
            )
            .filter(models.UserCollection.user_id == str(user_id))
            .order_by(models.Chemical.name)
            .all()
        )
        return [chemical_to_dict(r) for r in rows]

    rows = (
        db.query(models.Chemical)
        .filter(
            models.Chemical.user_id == str(user_id),
            models.Chemical.in_collection.is_(True),
        )
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

        db.add(
            models.UserCollection(
                user_id=str(user_id),
                chemical_id=payload.chemical_id,
            )
        )
        db.commit()
        return {"chemical_id": payload.chemical_id, "in_collection": True}

    chemical.in_collection = not bool(getattr(chemical, "in_collection", False))
    db.commit()
    db.refresh(chemical)
    return {"chemical_id": chemical.id, "in_collection": bool(chemical.in_collection)}


# ========== Organizations ==========

@app.post("/organizations", response_model=schemas.OrganizationOut)
def create_organization(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        base_slug = _slugify(payload.name)
        slug = base_slug
        n = 1
        if hasattr(models.Organization, "slug"):
            while (
                db.query(models.Organization)
                .filter(models.Organization.slug == slug)
                .first()
            ):
                n += 1
                slug = f"{base_slug}-{n}"

        org_kwargs = {
            "name": payload.name.strip(),
            "created_by": str(user_id),
        }
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


@app.get(
    "/organizations/{organization_id}/members",
    response_model=List[schemas.OrganizationMemberOut],
)
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
    )


# ========== Invites ==========

@app.post(
    "/organizations/{organization_id}/invites",
    response_model=schemas.InviteOut,
)
def invite_member(
    organization_id: str,
    payload: schemas.InviteCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    require_org_role(db, user_id, org_uuid, {"owner", "admin"})

    role = (payload.role or "member").lower()
    if role not in ("member", "admin"):
        raise HTTPException(status_code=400, detail="role must be member or admin")

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
        return existing_invite

    invite = models.OrganizationInvite(
        organization_id=org_uuid,
        email=email,
        role=role,
        invited_by=str(user_id),
        token=secrets.token_urlsafe(32),
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@app.get(
    "/organizations/{organization_id}/invites",
    response_model=List[schemas.InviteOut],
)
def list_invites(
    organization_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    org_uuid = _parse_uuid(organization_id)
    if org_uuid is None:
        raise HTTPException(status_code=400, detail="Invalid organization_id")

    require_org_role(db, user_id, org_uuid, {"owner", "admin"})
    return (
        db.query(models.OrganizationInvite)
        .filter(models.OrganizationInvite.organization_id == org_uuid)
        .order_by(models.OrganizationInvite.created_at.desc())
        .all()
    )


@app.post("/invites/accept", response_model=schemas.OrganizationOut)
def accept_invite(
    payload: schemas.AcceptInviteIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
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

    if not get_membership(db, user_id, invite.organization_id):
        db.add(
            models.OrganizationMember(
                organization_id=invite.organization_id,
                user_id=str(user_id),
                role=invite.role or "member",
            )
        )

    invite.status = "accepted"
    invite.accepted_at = datetime.now(timezone.utc)
    db.commit()

    org = (
        db.query(models.Organization)
        .filter(models.Organization.id == invite.organization_id)
        .first()
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    membership = get_membership(db, user_id, org.id)

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
    if role not in ("member", "admin", "owner"):
        raise HTTPException(status_code=400, detail="Invalid role")

    member = get_membership(db, member_user_id, org_uuid)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = role
    db.commit()
    return {"message": "Role updated", "user_id": member_user_id, "role": role}


# ========== Transactions (in-memory fallback) ==========
_TRANSACTIONS: list = []


@app.get("/transactions")
def get_transactions(user_id: str = Depends(get_current_user_id)):
    return [t for t in _TRANSACTIONS if t.get("user_id") == user_id]


@app.post("/transactions")
def create_transaction(payload: dict, user_id: str = Depends(get_current_user_id)):
    row = {
        "id": f"tx-{len(_TRANSACTIONS) + 1}",
        "user_id": user_id,
        **payload,
    }
    if "created_at" not in row:
        row["created_at"] = datetime.now(timezone.utc).isoformat()
    _TRANSACTIONS.insert(0, row)
    return row
