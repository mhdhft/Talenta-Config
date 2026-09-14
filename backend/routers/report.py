import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import nulls_last
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import AnalysisResult, AnalysisRun, User
from schemas import ReportRequest, ReportResponse

router = APIRouter(tags=["report"])

# Retensi report GLOBAL (lihat CLAUDE.md bagian 4a/6a) - bukan per user/CID,
# jumlah total file report yang disimpan di server dibatasi segini.
MAX_STORED_REPORTS = 2

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = BASE_DIR.parent / "templates" / "template_B.xlsx"
REPORTS_DIR = Path("/tmp/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Field standar Template A -> pasangan kolom (from, to) di sheet "Employee
# Transfer" Template B. Lihat CLAUDE.md bagian 6.
FIELD_TO_TEMPLATE_B = {
    "Branch Name": ("Branch from", "Branch to"),
    "Employment Status": ("Employment Status From", "Employment Status To"),
    "Employment Status End Date": ("End Status Date from", "End Status Date To"),
    "Job Position": ("Job Position from", "Job Position to"),
    "Organization Name": ("Organization from", "Organization to"),
    "Job Level": ("Job Level from", "Job Level to"),
    "Grade": ("Grade from", "Grade to"),
    "Class": ("Class from", "Class to"),
}

# Diisi langsung dari New Document (satu value, bukan before/after).
DIRECT_TO_TEMPLATE_B = {
    "Cost Center": "Cost Center",
    "Approval Line": "Approval Line",
    "Manager": "Manager",
}


_INVALID_FILENAME_CHARS = re.compile(r'[/\\:*?"<>|\s]+')


def _report_filename(run: AnalysisRun) -> str:
    safe_company = _INVALID_FILENAME_CHARS.sub("_", run.company_name.strip())
    safe_cid = _INVALID_FILENAME_CHARS.sub("_", run.cid.strip())
    return f"{safe_cid}-{safe_company}.xlsx"


def _get_run(db: Session, analysis_run_id: int, user: User) -> AnalysisRun:
    run = db.get(AnalysisRun, analysis_run_id)
    if run is None or run.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proses analisis tidak ditemukan.")
    return run


def _employee_name(directory: dict, eid: str) -> str:
    entry = directory.get(eid, {}) if directory else {}
    first = entry.get("First Name") or ""
    last = entry.get("Last Name") or ""
    return f"{first} {last}".strip()


@router.post("/report/generate", response_model=ReportResponse)
def generate_report(
    payload: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = _get_run(db, payload.analysis_run_id, current_user)
    results = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.analysis_run_id == run.id)
        .all()
    )
    if not results:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Belum ada hasil analisis untuk proses ini. Selesaikan step Analysis "
            "terlebih dahulu.",
        )

    allowed_sources = {"matched"}
    if payload.include_unidentified:
        allowed_sources.add("unidentified_employee")
    if payload.include_new_employees:
        allowed_sources.add("new_employee")

    directory = run.employee_directory or {}

    rows_by_employee: dict[str, dict] = {}
    for r in results:
        if r.source not in allowed_sources:
            continue
        row = rows_by_employee.setdefault(
            r.employee_id,
            {
                "Employee ID": r.employee_id,
                "Employee Name": _employee_name(directory, r.employee_id),
            },
        )
        if r.field in FIELD_TO_TEMPLATE_B:
            from_col, to_col = FIELD_TO_TEMPLATE_B[r.field]
            row[from_col] = r.nilai_lama
            row[to_col] = r.nilai_baru

    for eid in list(rows_by_employee.keys()):
        entry = directory.get(eid, {})
        row = rows_by_employee[eid]
        for field, template_col in DIRECT_TO_TEMPLATE_B.items():
            if field in entry:
                row[template_col] = entry[field]
        # Diisi kalau user mengaktifkan & mengisi di step Input Company Info
        # (CLAUDE.md bagian 4 poin 0). Kalau tidak diisi, biarkan kosong
        # seperti sebelumnya (diisi manual nanti).
        if run.effective_date is not None:
            row["Effective Date"] = run.effective_date.strftime("%Y-%m-%d")
        if run.transfer_type is not None:
            row["Transfer Type"] = run.transfer_type

    wb = openpyxl.load_workbook(TEMPLATE_PATH)
    ws = wb["Employee Transfer"]
    headers = [cell.value for cell in ws[1]]

    for row_data in rows_by_employee.values():
        ws.append([row_data.get(h) for h in headers])

    filename = f"Report_Employee_Transfer_{run.id}_{uuid.uuid4().hex[:8]}.xlsx"
    dest = REPORTS_DIR / filename
    wb.save(dest)

    run.report_path = str(dest)
    run.status = "Selesai"
    run.file_available = True
    run.report_generated_at = datetime.now(timezone.utc)
    db.commit()

    _enforce_global_report_retention(db)

    return ReportResponse(download_url=f"/report/download/{run.id}")


def _enforce_global_report_retention(db: Session) -> None:
    """Server hanya menyimpan MAX_STORED_REPORTS file report terbaru secara
    GLOBAL - bukan per user/CID (CLAUDE.md bagian 4a/6a). Kalau melebihi,
    hapus file fisik report paling lama dan tandai file_available=False;
    row History-nya tetap ada, tidak ikut dihapus."""
    available_runs = (
        db.query(AnalysisRun)
        .filter(
            AnalysisRun.file_available.is_(True),
            AnalysisRun.report_path.isnot(None),
        )
        .order_by(nulls_last(AnalysisRun.report_generated_at.desc()))
        .all()
    )

    for old_run in available_runs[MAX_STORED_REPORTS:]:
        if old_run.report_path:
            Path(old_run.report_path).unlink(missing_ok=True)
        old_run.file_available = False

    if len(available_runs) > MAX_STORED_REPORTS:
        db.commit()


@router.get("/report/download/{analysis_run_id}")
def download_report(
    analysis_run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = _get_run(db, analysis_run_id, current_user)
    if not run.report_path or not run.file_available or not Path(run.report_path).exists():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "File report sudah tidak tersedia di server (lewat batas retensi) atau belum di-generate.",
        )
    return FileResponse(
        run.report_path,
        filename=_report_filename(run),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
