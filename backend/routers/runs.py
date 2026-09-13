from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import AnalysisRun, User
from schemas import TRANSFER_TYPE_OPTIONS, CreateRunRequest, CreateRunResponse

router = APIRouter(prefix="/analysis-runs", tags=["analysis-runs"])


@router.post("", response_model=CreateRunResponse)
def create_run(
    payload: CreateRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = payload.cid.strip()
    company_name = payload.company_name.strip()
    if not cid or not company_name:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Company ID dan Company Name wajib diisi.",
        )

    if payload.transfer_type is not None and payload.transfer_type not in TRANSFER_TYPE_OPTIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Transfer Type harus salah satu dari: {', '.join(TRANSFER_TYPE_OPTIONS)}.",
        )

    run = AnalysisRun(
        user_id=current_user.id,
        cid=cid,
        company_name=company_name,
        effective_date=payload.effective_date,
        transfer_type=payload.transfer_type,
        status="Diproses",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return CreateRunResponse(
        analysis_run_id=run.id,
        cid=run.cid,
        company_name=run.company_name,
        effective_date=run.effective_date,
        transfer_type=run.transfer_type,
    )
