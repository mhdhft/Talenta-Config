from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from column_matching import match_columns
from deps import get_current_user, get_db
from models import AnalysisResult, AnalysisRun, User
from schemas import CompareRequest, CompareResponse, MatchColumnsResponse
from utils import clean_str
from value_comparison import compare_values

router = APIRouter(prefix="/analysis", tags=["analysis"])

# Field yang diambil langsung (bukan hasil compare) untuk keperluan Report:
# First/Last Name -> Employee Name, Cost Center/Approval Line/Manager -> nilai
# tunggal dari New Document (lihat CLAUDE.md bagian 6).
DIRECT_FIELDS = ["First Name", "Last Name", "Cost Center", "Approval Line", "Manager"]


def _read_df(path: str) -> pd.DataFrame:
    p = Path(path)
    if p.suffix.lower() == ".csv":
        return pd.read_csv(p)
    return pd.read_excel(p)


def _get_run(db: Session, analysis_run_id: int, user: User) -> AnalysisRun:
    run = db.get(AnalysisRun, analysis_run_id)
    if run is None or run.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proses analisis tidak ditemukan.")
    return run


@router.post("/match-columns", response_model=MatchColumnsResponse)
def match_columns_endpoint(
    analysis_run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = _get_run(db, analysis_run_id, current_user)
    if not run.new_document_path:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload New Document terlebih dahulu.")
    if not run.reference_document_path:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload Reference Document terlebih dahulu.")

    new_df = _read_df(run.new_document_path)
    new_columns = [str(c) for c in new_df.columns if c != "Employee ID"]

    # Field standar diambil dari header row Reference Document yang diupload
    # user pada proses ini (bukan konstanta tetap) - lihat CLAUDE.md bagian 5
    # & 6.
    ref_df = _read_df(run.reference_document_path)
    standard_fields = [str(c) for c in ref_df.columns if c != "Employee ID"]

    matches = match_columns(new_columns, standard_fields)

    return MatchColumnsResponse(
        analysis_run_id=run.id,
        matches=[m.model_dump() for m in matches],
        standard_fields=standard_fields,
    )


def _build_employee_directory(new_df, ref_df, column_mapping: dict) -> dict:
    field_to_new_col = {v: k for k, v in column_mapping.items() if v is not None}
    directory: dict[str, dict] = {}

    new_indexed = new_df.set_index("Employee ID")
    for eid in new_indexed.index:
        row = new_indexed.loc[eid]
        entry = directory.setdefault(str(eid), {})
        for field in DIRECT_FIELDS:
            col = field_to_new_col.get(field)
            if col is not None and col in row.index:
                value = clean_str(row.get(col))
                if value is not None:
                    entry[field] = value

    ref_indexed = ref_df.set_index("Employee ID")
    for eid in ref_indexed.index:
        row = ref_indexed.loc[eid]
        entry = directory.setdefault(str(eid), {})
        for field in ("First Name", "Last Name"):
            if field not in entry and field in row.index:
                value = clean_str(row.get(field))
                if value is not None:
                    entry[field] = value

    return directory


def _employee_name(directory: dict, eid: str) -> str | None:
    entry = directory.get(eid, {})
    first = entry.get("First Name") or ""
    last = entry.get("Last Name") or ""
    name = f"{first} {last}".strip()
    return name or None


@router.post("/compare", response_model=CompareResponse)
def compare_endpoint(
    payload: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = _get_run(db, payload.analysis_run_id, current_user)
    if not run.new_document_path or not run.reference_document_path:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Upload New Document dan Reference Document terlebih dahulu.",
        )

    new_df = _read_df(run.new_document_path)
    ref_df = _read_df(run.reference_document_path)

    result = compare_values(new_df, ref_df, payload.column_mapping, payload.selected_fields)
    employee_directory = _build_employee_directory(new_df, ref_df, payload.column_mapping)

    run.column_mapping = payload.column_mapping
    run.selected_fields = payload.selected_fields
    run.employee_directory = employee_directory

    db.query(AnalysisResult).filter(AnalysisResult.analysis_run_id == run.id).delete()

    rows_out = []
    for row in result["rows"]:
        eid = str(row["employee_id"])
        nilai_lama = clean_str(row["nilai_lama"])
        nilai_baru = clean_str(row["nilai_baru"])

        db.add(
            AnalysisResult(
                analysis_run_id=run.id,
                employee_id=eid,
                field=row["field"],
                nilai_lama=nilai_lama,
                nilai_baru=nilai_baru,
                status=row["status"],
                note=row["note"],
                source=row["source"],
            )
        )
        rows_out.append(
            {
                "employee_id": eid,
                "employee_name": _employee_name(employee_directory, eid),
                "field": row["field"],
                "nilai_lama": nilai_lama,
                "nilai_baru": nilai_baru,
                "status": row["status"],
                "note": row["note"],
                "source": row["source"],
            }
        )

    db.commit()

    return CompareResponse(
        analysis_run_id=run.id,
        rows=rows_out,
        ids_only_in_new=[str(x) for x in result["ids_only_in_new"]],
        ids_only_in_reference=[str(x) for x in result["ids_only_in_reference"]],
    )
