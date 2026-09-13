"""
Skema database (lihat CLAUDE.md bagian Fase 3): users, analysis_runs,
analysis_results. analysis_results strukturnya sama persis dengan output
compare_values() di value_comparison.py (Fase 2), tinggal disimpan ke tabel.
"""

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Diisi user di step "Input Company Info" (lihat CLAUDE.md bagian 4).
    # 1 user bisa memproses beberapa perusahaan klien berbeda.
    cid: Mapped[str] = mapped_column(String(100))
    company_name: Mapped[str] = mapped_column(String(255))
    # Opsional - diaktifkan lewat checkbox di step Input Company Info. Kalau
    # kosong, kolom terkait di report Excel dibiarkan kosong (diisi manual).
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    transfer_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    new_document_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    new_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference_document_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reference_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Hasil koreksi user di step 3a: {kolom_new_document: field_standar}
    column_mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Field yang dicentang user di step 3b
    selected_fields: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # {employee_id: {"First Name":..., "Last Name":..., "Cost Center":..., ...}}
    # dipakai step Report untuk Employee Name & field yang diambil langsung
    # dari New Document (Cost Center, Approval Line, Manager).
    employee_directory: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    report_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Diproses")

    # Retensi global 2 file report terbaru (lihat CLAUDE.md bagian 4a/6a):
    # kalau file fisiknya sudah dihapus otomatis karena kalah baru, flag ini
    # jadi False tapi row & report_path tetap disimpan (bukan dihapus).
    file_available: Mapped[bool] = mapped_column(Boolean, default=True)
    report_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    # Soft delete - baris tidak pernah dihapus beneran dari database, cuma
    # disembunyikan dari daftar History (lihat routers/history.py).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    results: Mapped[list["AnalysisResult"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"))

    employee_id: Mapped[str] = mapped_column(String(100))
    field: Mapped[str] = mapped_column(String(255))
    nilai_lama: Mapped[str | None] = mapped_column(Text, nullable=True)
    nilai_baru: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "matched" | "unidentified_employee" | "new_employee" - lihat value_comparison.py
    source: Mapped[str] = mapped_column(String(50))

    run: Mapped["AnalysisRun"] = relationship(back_populates="results")


class StructureMapperSession(Base):
    """1 sesi = 1 kali submit popup upload Structure Mapper (lihat
    STRUCTURE-MAPPER-SPEC.md bagian 3.2-3.4). Tiap submit baru SELALU bikin
    row baru di sini (bukan overwrite) - histori tetap ada di DB walau
    tampilan frontend sudah "reset" ke data terbaru (lihat Section 3.8)."""

    __tablename__ = "structure_mapper_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # "job_position" untuk sekarang - "organization" disiapkan untuk Fase F
    # (lihat spec bagian 6 Open Item #3), belum dipakai.
    type: Mapped[str] = mapped_column(String(50), default="job_position")

    cid: Mapped[str] = mapped_column(String(100))
    company_name: Mapped[str] = mapped_column(String(255))
    source_filename: Mapped[str] = mapped_column(String(255))
    source_file_path: Mapped[str] = mapped_column(String(500))
    # Selalu True untuk sekarang (lihat PROGRESS-MAIN.md Fase C) - belum ada
    # UI untuk user mematikan pembacaan nama.
    include_names: Mapped[bool] = mapped_column(Boolean, default=True)
    # Toggle "Ignore Unsolid Line" (lihat STRUCTURE-MAPPER-SPEC.md bagian 6
    # Open Item #1) - disimpan per sesi untuk keperluan audit histori,
    # default False (perilaku lama: garis putus-putus tetap di-flag manual).
    ignore_unsolid_line: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    rows: Mapped[list["StructureMapperRow"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class StructureMapperRow(Base):
    """1 baris hasil mapping struktur (Job Position/Parent/Name) untuk 1
    StructureMapperSession. status: "ok" | "duplicated" (fallback a - lihat
    spec Open Item #1) | "needs_manual" (fallback b/c)."""

    __tablename__ = "structure_mapper_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("structure_mapper_sessions.id"))

    job_position: Mapped[str] = mapped_column(String(255))
    parent_job_position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Token pengelompokan internal (BUKAN foreign key ke row lain) - baris
    # duplikat yang berasal dari 1 kotak ambigu yang sama (fallback a) berbagi
    # nilai yang sama di sini. Diisi dari box_id internal Fase B
    # (structure_extraction.py). Tidak pernah ditampilkan ke user.
    source_box_id_internal: Mapped[str | None] = mapped_column(String(100), nullable=True)

    session: Mapped["StructureMapperSession"] = relationship(back_populates="rows")


class JobPositionComparisonSession(Base):
    """1 sesi = 1 kali submit upload Referensi Talenta di step 3.6 (Fase E,
    lihat STRUCTURE-MAPPER-SPEC.md bagian 3.6-3.7 & PROGRESS-MAIN.md Fase E).
    Selalu bikin row baru per submit (bukan overwrite) - sama seperti pola
    StructureMapperSession, supaya histori & test konsistensi (jalankan
    proses yang sama berkali-kali) tetap terekam apa adanya."""

    __tablename__ = "job_position_comparison_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    structure_mapper_session_id: Mapped[int] = mapped_column(
        ForeignKey("structure_mapper_sessions.id")
    )

    reference_filename: Mapped[str] = mapped_column(String(255))
    reference_file_path: Mapped[str] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    rows: Mapped[list["JobPositionComparisonRow"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class JobPositionComparisonRow(Base):
    """1 baris hasil kategorisasi compare_job_positions() (Fase D, lihat
    job_position_comparison.py) untuk 1 JobPositionComparisonSession.

    category: "sudah_ada" | "baru" | "vacant_candidate" | "perlu_konfirmasi"
    - job_position: nama utama yang ditampilkan - dari hasil mapping untuk
      sudah_ada/baru/perlu_konfirmasi, dari master list Talenta untuk
      vacant_candidate (lihat compare_job_positions()).
    - parent_job_position: HANYA terisi untuk kategori "baru" (dipakai buat
      export 2 kolom, spec 3.7 poin 1) - null untuk kategori lain.
    - master_job_position: HANYA terisi untuk "perlu_konfirmasi" - nama versi
      master list yang dianggap mirip (pasangannya job_position) - null utk
      kategori lain.
    - alasan: alasan AI (atau mock) kenapa dianggap "perlu_konfirmasi" - null
      untuk kategori lain.

    Keputusan manual user (checklist "tetap vacant/hapus" utk vacant_candidate,
    "anggap sama/beda" utk perlu_konfirmasi) SENGAJA TIDAK disimpan di sini -
    murni state frontend per sesi (sama seperti pola dummy `used` di Fase A),
    lihat PROGRESS-MAIN.md Fase E untuk detail keputusan ini.
    """

    __tablename__ = "job_position_comparison_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    comparison_session_id: Mapped[int] = mapped_column(
        ForeignKey("job_position_comparison_sessions.id")
    )

    category: Mapped[str] = mapped_column(String(50))
    job_position: Mapped[str] = mapped_column(String(255))
    parent_job_position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    master_job_position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    alasan: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["JobPositionComparisonSession"] = relationship(back_populates="rows")
