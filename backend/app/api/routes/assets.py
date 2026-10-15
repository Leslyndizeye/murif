from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.asset import Asset
from app.schemas.asset_schema import AssetCreateRequest, AssetResponse, AssetUpdateRequest

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=AssetResponse)
def create_asset(payload: AssetCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(Asset).filter(Asset.serial_number == payload.serial_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="An asset with this serial number already exists")

    asset = Asset(
        name=payload.name,
        category=payload.category,
        serial_number=payload.serial_number,
        status="Available",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/", response_model=list[AssetResponse])
def list_assets(db: Session = Depends(get_db)):
    return db.query(Asset).order_by(Asset.created_at.desc()).all()


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: int, payload: AssetUpdateRequest, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status == "Assigned":
        raise HTTPException(status_code=400, detail="Cannot delete an asset that is currently assigned")

    db.delete(asset)
    db.commit()
    return {"message": "Asset deleted"}
