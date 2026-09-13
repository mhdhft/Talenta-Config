from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import AnalysisRun, User

router = APIRouter(tags=["history"])


@router.get("/history")
def get_history(
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AnalysisRun).filter(
        AnalysisRun.user_id == current_user.id,
        AnalysisRun.deleted_at.is_(None),
    )

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AnalysisRun.cid.ilike(like), AnalysisRun.company_name.ilike(like)))

    runs = query.order_by(AnalysisRun.created_at.desc()).all()
    return [
        {
            "id": run.id,
            "date": run.created_at.strftime("%Y-%m-%d"),
            "cid": run.cid,
            "companyName": run.company_name,
            "newFileName": run.new_document_filename,
            "referenceFileName": run.reference_document_filename,
            "status": run.status,
            "fileAvailable": bool(run.report_path) and run.file_available,
        }
        for run in runs
    ]


@router.delete("/history/{analysis_run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history_entry(
    analysis_run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.get(AnalysisRun, analysis_run_id)
    if run is None or run.user_id != current_user.id or run.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proses analisis tidak ditemukan.")

    run.deleted_at = datetime.now(timezone.utc)
    db.commit()
