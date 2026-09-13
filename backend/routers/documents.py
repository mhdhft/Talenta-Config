import shutil
import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import AnalysisRun, User

router = APIRouter(prefix="/documents", tags=["documents"])

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".xlsx", ".csv"}


def _validate_extension(filename: str | None) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Format file '{ext or 'tidak dikenali'}' tidak didukung. "
            "Harap upload file .xlsx atau .csv.",
        )
    return ext


def _read_dataframe(path: Path, ext: str) -> pd.DataFrame:
    if ext == ".csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


def _save_upload(file: UploadFile, ext: str) -> Path:
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return dest


@router.post("/upload-new")
def upload_new(
    analysis_run_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.get(AnalysisRun, analysis_run_id)
    if run is None or run.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Proses analisis tidak ditemukan. Isi Company Info terlebih dahulu.",
        )

    ext = _validate_extension(file.filename)
    dest = _save_upload(file, ext)

    try:
        df = _read_dataframe(dest, ext)
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "File tidak bisa dibaca. Pastikan file tidak rusak dan formatnya benar.",
        )

    if len(df.columns) == 0 or str(df.columns[0]).strip() != "Employee ID":
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Kolom pertama (kolom A) harus bernama 'Employee ID'. "
            "Periksa kembali file yang diupload.",
        )

    run.new_document_filename = file.filename
    run.new_document_path = str(dest)
    db.commit()

    return {
        "analysis_run_id": run.id,
        "filename": file.filename,
        "columns": [str(c) for c in df.columns if c != "Employee ID"],
    }


@router.post("/upload-reference")
def upload_reference(
    analysis_run_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.get(AnalysisRun, analysis_run_id)
    if run is None or run.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proses analisis tidak ditemukan.")

    ext = _validate_extension(file.filename)
    dest = _save_upload(file, ext)

    try:
        df = _read_dataframe(dest, ext)
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "File tidak bisa dibaca. Pastikan file tidak rusak dan formatnya benar.",
        )

    if "Employee ID" not in df.columns:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Reference Document harus mengikuti struktur Template A dan wajib "
            "memiliki kolom 'Employee ID'.",
        )

    run.reference_document_filename = file.filename
    run.reference_document_path = str(dest)
    db.commit()

    return {
        "analysis_run_id": run.id,
        "filename": file.filename,
        "columns": [str(c) for c in df.columns if c != "Employee ID"],
    }
