from datetime import date

from pydantic import BaseModel

TRANSFER_TYPE_OPTIONS = [
    "Promotion",
    "Demotion",
    "Extend Contract",
    "Mutation",
    "Rotation",
    "Other",
]


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CreateRunRequest(BaseModel):
    cid: str
    company_name: str
    effective_date: date | None = None
    transfer_type: str | None = None


class CreateRunResponse(BaseModel):
    analysis_run_id: int
    cid: str
    company_name: str
    effective_date: date | None = None
    transfer_type: str | None = None


class ColumnMatchOut(BaseModel):
    kolom_new_document: str
    field_standar_terdeteksi: str | None
    confidence: str
    alasan: str


class MatchColumnsResponse(BaseModel):
    analysis_run_id: int
    matches: list[ColumnMatchOut]
    standard_fields: list[str]


class CompareRequest(BaseModel):
    analysis_run_id: int
    column_mapping: dict[str, str]
    selected_fields: list[str]


class ResultRow(BaseModel):
    employee_id: str
    employee_name: str | None = None
    field: str
    nilai_lama: str | None = None
    nilai_baru: str | None = None
    status: str
    note: str | None = None
    source: str


class CompareResponse(BaseModel):
    analysis_run_id: int
    rows: list[ResultRow]
    ids_only_in_new: list[str]
    ids_only_in_reference: list[str]


class ReportRequest(BaseModel):
    analysis_run_id: int
    include_unidentified: bool = False
    include_new_employees: bool = False


class ReportResponse(BaseModel):
    download_url: str


class StructureMapperRowOut(BaseModel):
    id: int
    job_position: str
    parent_job_position: str | None
    name: str | None
    status: str  # "ok" | "duplicated" | "needs_manual"
    note: str | None


class StructureMapperUploadResponse(BaseModel):
    session_id: int
    cid: str
    company_name: str
    source_filename: str
    rows: list[StructureMapperRowOut]


# ---- Structure Your Excel (dulu "Organization") - Fase F2, lihat
# STRUCTURE-MAPPER-SPEC.md bagian 10.3. Independen dari schema di atas
# (Excel Your Structure) - tidak ada field yang di-share. ----


class OrgTreeNodeOut(BaseModel):
    """Node diagram - cuma Job Position Name yang ditampilkan (Job Position
    Id dipakai untuk matching internal di backend, tidak pernah keluar lewat
    schema ini - lihat spec bagian 10.3)."""

    id: str
    name: str
    children: list["OrgTreeNodeOut"] = []


OrgTreeNodeOut.model_rebuild()


class OrganizationUploadResponse(BaseModel):
    cid: str
    company_name: str
    source_filename: str
    # List, bukan 1 tree tunggal - kalau file punya lebih dari 1 root, tiap
    # root jadi 1 tree terpisah (forest, lihat spec bagian 10.3 - BUKAN error).
    trees: list[OrgTreeNodeOut]
    # Peringatan non-fatal (mis. Parent Job Position Id yang tidak ditemukan,
    # atau referensi melingkar) - ditampilkan ke user, tidak menggagalkan upload.
    warnings: list[str]


# ---- Excel Your Structure - Fase E: perbandingan Job Position hasil mapping
# vs master list Talenta (lihat STRUCTURE-MAPPER-SPEC.md bagian 3.6-3.7,
# job_position_comparison.py Fase D). ----


class JobPositionComparisonRowOut(BaseModel):
    id: int
    category: str  # "sudah_ada" | "baru" | "vacant_candidate" | "perlu_konfirmasi"
    job_position: str
    parent_job_position: str | None
    master_job_position: str | None
    alasan: str | None


class JobPositionComparisonResponse(BaseModel):
    comparison_session_id: int
    structure_mapper_session_id: int
    reference_filename: str
    rows: list[JobPositionComparisonRowOut]


# Revisi 2026-08-11 (spec 3.7b, Step 5 - Vacant & Perlu Konfirmasi digabung):
# keputusan radio "Tetap Vacant/Set Inactive/Anggap Sama" sengaja TIDAK
# disimpan ke DB (state frontend saja), jadi daftar nama yang mau didownload
# dikirim dari browser tiap kali tombol download diklik - lihat
# routers/structure_mapper.py export_comparison_list().
class ExportComparisonListRequest(BaseModel):
    job_positions: list[str]
