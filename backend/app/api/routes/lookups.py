from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_it_user
from app.db.session import SessionLocal
from app.models.department import Department
from app.models.station import Station
from app.models.user import User
from app.schemas.lookup_schema import LookupCreateRequest, LookupResponse, LookupUpdateRequest


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_lookup_router(*, model, user_field: str, label: str) -> APIRouter:
    """Departments and stations are both simple named lookup tables that feed
    the same dropdowns, referenced by name (not FK) from User.department /
    User.station — this factory avoids writing the same CRUD twice."""
    router = APIRouter()

    @router.get("/", response_model=list[LookupResponse])
    def list_items(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
        return db.query(model).order_by(model.name).all()

    @router.post("/", response_model=LookupResponse)
    def create_item(
        payload: LookupCreateRequest,
        db: Session = Depends(get_db),
        _: User = Depends(require_it_user),
    ):
        name = payload.name.strip()
        existing = db.query(model).filter(model.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"{label} already exists")

        item = model(name=name)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @router.patch("/{item_id}", response_model=LookupResponse)
    def update_item(
        item_id: int,
        payload: LookupUpdateRequest,
        db: Session = Depends(get_db),
        _: User = Depends(require_it_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{label} not found")

        name = payload.name.strip()
        existing = db.query(model).filter(model.name == name, model.id != item_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"{label} already exists")

        old_name = item.name
        item.name = name
        # Keep existing users' records in sync so they don't end up with a
        # department/station value that no longer appears in the dropdown.
        db.query(User).filter(getattr(User, user_field) == old_name).update(
            {user_field: name}, synchronize_session=False
        )
        db.commit()
        db.refresh(item)
        return item

    @router.delete("/{item_id}")
    def delete_item(
        item_id: int,
        db: Session = Depends(get_db),
        _: User = Depends(require_it_user),
    ):
        item = db.query(model).filter(model.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"{label} not found")

        in_use = db.query(User.id).filter(getattr(User, user_field) == item.name).first() is not None
        if in_use:
            raise HTTPException(status_code=400, detail=f"Cannot delete a {label.lower()} assigned to existing users")

        db.delete(item)
        db.commit()
        return {"message": f"{label} deleted"}

    return router


departments_router = build_lookup_router(model=Department, user_field="department", label="Department")
stations_router = build_lookup_router(model=Station, user_field="station", label="Station")
