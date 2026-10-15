from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.asset import Asset
from app.models.asset_voucher import AssetVoucher
from app.schemas.asset_voucher_schema import (
    AssetVoucherCreateRequest,
    AssetVoucherResponse,
    AssetVoucherStatus,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _build_voucher_number(db: Session) -> str:
    date_part = datetime.utcnow().strftime("%Y%m%d")
    total = db.query(func.count(AssetVoucher.id)).scalar() or 0
    return f"VCH-{date_part}-{total + 1:04d}"


def _to_response(voucher: AssetVoucher, asset: Asset) -> AssetVoucherResponse:
    return AssetVoucherResponse(
        id=voucher.id,
        voucher_number=voucher.voucher_number,
        asset_id=voucher.asset_id,
        asset_name=asset.name,
        asset_category=asset.category,
        serial_number=asset.serial_number,
        issued_to=voucher.issued_to,
        issued_by=voucher.issued_by,
        date_issued=voucher.date_issued,
        date_returned=voucher.date_returned,
        status=voucher.status,
    )


@router.post("/", response_model=AssetVoucherResponse)
def create_asset_voucher(payload: AssetVoucherCreateRequest, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "Available":
        raise HTTPException(status_code=400, detail="Asset is not available for issuance")

    voucher = AssetVoucher(
        voucher_number=_build_voucher_number(db),
        asset_id=asset.id,
        issued_to=payload.issued_to,
        issued_by=payload.issued_by,
        date_issued=datetime.utcnow(),
        status="Issued",
    )
    asset.status = "Assigned"

    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    db.refresh(asset)
    return _to_response(voucher, asset)


@router.get("/", response_model=list[AssetVoucherResponse])
def list_asset_vouchers(
    status: AssetVoucherStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(AssetVoucher, Asset).join(Asset, AssetVoucher.asset_id == Asset.id)

    if status:
        query = query.filter(AssetVoucher.status == status)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                AssetVoucher.voucher_number.ilike(pattern),
                AssetVoucher.issued_to.ilike(pattern),
                Asset.name.ilike(pattern),
                Asset.serial_number.ilike(pattern),
            )
        )

    rows = query.order_by(AssetVoucher.created_at.desc()).all()
    return [_to_response(voucher, asset) for voucher, asset in rows]


@router.get("/{voucher_id}", response_model=AssetVoucherResponse)
def get_asset_voucher(voucher_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(AssetVoucher, Asset)
        .join(Asset, AssetVoucher.asset_id == Asset.id)
        .filter(AssetVoucher.id == voucher_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Voucher not found")

    voucher, asset = row
    return _to_response(voucher, asset)


@router.patch("/{voucher_id}/return", response_model=AssetVoucherResponse)
def return_asset_voucher(voucher_id: int, db: Session = Depends(get_db)):
    voucher = db.query(AssetVoucher).filter(AssetVoucher.id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status == "Returned":
        raise HTTPException(status_code=400, detail="Voucher is already marked as returned")

    asset = db.query(Asset).filter(Asset.id == voucher.asset_id).first()

    voucher.status = "Returned"
    voucher.date_returned = datetime.utcnow()
    if asset:
        asset.status = "Available"

    db.commit()
    db.refresh(voucher)
    if asset:
        db.refresh(asset)
    return _to_response(voucher, asset)
