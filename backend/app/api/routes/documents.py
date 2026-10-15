from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.document import Document
from app.models.user import User
from app.models.voucher import Voucher
from app.schemas.document_schema import (
    DocumentApprovalRequest,
    DocumentCreateRequest,
    DocumentLinkRequest,
    DocumentResponse,
    DocumentSignRequest,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _build_document_ref(db: Session) -> str:
    year = datetime.utcnow().year
    total = db.query(func.count(Document.id)).scalar() or 0
    return f"RAB/TECH/{year}/{total + 1:03d}"


@router.post("/", response_model=DocumentResponse)
def create_document(payload: DocumentCreateRequest, db: Session = Depends(get_db)):
    if payload.document_type == "returning" and not (payload.nature_of_problem or "").strip():
        raise HTTPException(status_code=422, detail="nature_of_problem is required for returning documents")

    normalized_nature = (payload.nature_of_problem or "").strip()
    if payload.document_type == "receiving" and not normalized_nature:
        normalized_nature = "Receiving document record"

    signature_status = "not_required"
    if payload.document_type == "receiving":
        if not (payload.recipient_email or "").strip():
            raise HTTPException(status_code=422, detail="recipient_email is required for receiving documents")
        signature_status = "pending_user_signature"

    submitted_by_id = None
    if payload.submitted_by_email:
        user = db.query(User).filter(User.email == payload.submitted_by_email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Submitting user not found")
        submitted_by_id = user.id

    document = Document(
        document_ref=_build_document_ref(db),
        date=payload.date,
        document_type=payload.document_type,
        name_of_staff=payload.name_of_staff,
        position=payload.position,
        division=payload.division,
        device_model=payload.device_model,
        device_serial_number=payload.device_serial_number,
        rab_asset_code=payload.rab_asset_code,
        recipient_email=payload.recipient_email,
        source_of_computer=payload.source_of_computer,
        acquisition_details=payload.acquisition_details,
        receiving_comment=payload.receiving_comment,
        user_signature=None,
        user_signed_at=None,
        signature_status=signature_status,
        nature_of_problem=normalized_nature,
        observation=payload.observation,
        key_recommendation=payload.key_recommendation,
        priority=payload.priority,
        asset_status=payload.asset_status,
        approval_status="pending",
        submitted_by_id=submitted_by_id,
        voucher_id=payload.voucher_id,
        disposal_id=payload.disposal_id,
    )

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.patch("/{document_id}/link", response_model=DocumentResponse)
def link_document_to_voucher(document_id: int, payload: DocumentLinkRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.voucher_id is not None:
        voucher = db.query(Voucher).filter(Voucher.id == payload.voucher_id).first()
        if not voucher:
            raise HTTPException(status_code=404, detail="Voucher not found")

    document.voucher_id = payload.voucher_id
    db.commit()
    db.refresh(document)
    return document


@router.patch("/{document_id}/approve", response_model=DocumentResponse)
def approve_document(document_id: int, payload: DocumentApprovalRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    approver = None
    if payload.approved_by_email:
        approver = db.query(User).filter(User.email == payload.approved_by_email).first()
        if not approver:
            raise HTTPException(status_code=404, detail="Approving user not found")

        if (approver.role or "").upper() != "IT":
            raise HTTPException(status_code=403, detail="Only IT personnel can approve or reject documents")

    document.approval_status = payload.decision
    document.approved_by_id = approver.id if approver else None
    document.approved_at = datetime.utcnow()
    document.approval_note = payload.approval_note

    if payload.decision == "approved":
        document.status = "approved"
    elif payload.decision == "rejected":
        document.status = "rejected"
    else:
        document.status = "submitted"

    db.commit()
    db.refresh(document)
    return document


@router.patch("/{document_id}/sign", response_model=DocumentResponse)
def sign_receiving_document(document_id: int, payload: DocumentSignRequest, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.document_type != "receiving":
        raise HTTPException(status_code=400, detail="Only receiving documents can be signed by end users")

    if document.signature_status == "signed":
        raise HTTPException(status_code=400, detail="This receiving document has already been signed")

    if not document.recipient_email:
        raise HTTPException(status_code=400, detail="Receiving document has no assigned recipient")

    if document.recipient_email.strip().lower() != payload.signer_email.strip().lower():
        raise HTTPException(status_code=403, detail="Only the assigned recipient can sign this document")

    document.user_signature = payload.signature_text.strip()
    document.user_signed_at = datetime.utcnow()
    document.signature_status = "signed"
    document.status = "returned_to_it"

    db.commit()
    db.refresh(document)
    return document
