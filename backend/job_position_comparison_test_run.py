"""
Structure Mapper - Fase D: test manual perbandingan Job Position hasil
mapping (Fase B/C) vs master list Talenta (lihat STRUCTURE-MAPPER-SPEC.md
bagian 3.6, 3.7, Open Item #2).

Script ini BERDIRI SENDIRI - belum disambung ke aplikasi/backend/frontend.
Tujuannya cuma mengetes hasil perbandingan di terminal, sebelum logic ini
dipakai beneran di Fase E.

Cara pakai (dari folder backend/):
    python job_position_comparison_test_run.py <org_chart_file> <master_list.xlsx>
    python job_position_comparison_test_run.py <org_chart_file> <master_list.xlsx> --with-names
    python job_position_comparison_test_run.py <org_chart_file> <master_list.xlsx> --ignore-unsolid-line

<org_chart_file>  : gambar/PDF bagan struktur (Fase B - dipanggil ulang di
                    sini lewat structure_extraction.extract_structure()
                    supaya "Input 1" didapat dari ekstraksi asli, bukan data
                    manual/dummy).
<master_list.xlsx>: file Excel referensi, WAJIB punya sheet "List of Job
                    Position" (Job Position Id, Job Position Name, Status,
                    Job Position Code, Description) - format sama seperti
                    template_excel_for_ai.xlsx.

Mode mock (tanpa panggil Gemini asli, hemat kuota): set USE_MOCK_AI=true di
backend/.env sebelum menjalankan script ini. Kalau USE_MOCK_AI=false, script
ini memanggil Gemini asli DUA KALI jenis pemanggilan: (1) vision, untuk baca
gambar bagan (Fase B), (2) teks, untuk menilai kandidat nama yang mirip tapi
tidak identik (Fase D, lihat job_position_comparison._ai_judge_match).
"""

import argparse
from pathlib import Path

import pandas as pd

from job_position_comparison import (
    InvalidMasterListError,
    REQUIRED_MASTER_SHEET_NAME,
    build_new_positions_export_rows,
    compare_job_positions,
    read_master_job_position_names,
)
from structure_extraction import extract_structure, guess_mime_type

BASE_DIR = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(
        description="Test perbandingan Job Position hasil mapping (Fase B/C) vs master list Talenta."
    )
    parser.add_argument("org_chart_file", help="Path ke file gambar (PNG/JPG/JPEG) atau PDF bagan struktur.")
    parser.add_argument("master_list_xlsx", help="Path ke file Excel master list Talenta (sheet 'List of Job Position').")
    parser.add_argument(
        "--with-names",
        action="store_true",
        help="Aktifkan pembacaan nama pemegang jabatan saat ekstraksi (default: tidak dibaca) - tidak memengaruhi matching.",
    )
    parser.add_argument(
        "--ignore-unsolid-line",
        action="store_true",
        help="Aktifkan toggle 'Ignore Unsolid Line' saat ekstraksi (lihat structure_extraction.py).",
    )
    args = parser.parse_args()

    org_chart_path = Path(args.org_chart_file)
    if not org_chart_path.is_file():
        raise SystemExit(f"File bagan tidak ditemukan: {org_chart_path}")
    master_list_path = Path(args.master_list_xlsx)
    if not master_list_path.is_file():
        raise SystemExit(f"File master list tidak ditemukan: {master_list_path}")

    # --- Langkah 1: Input 1 - hasil mapping dari Fase B/C ---
    try:
        mime_type = guess_mime_type(org_chart_path.name)
    except ValueError as e:
        raise SystemExit(str(e))

    print("=" * 78)
    print(f"[1/3] Mengekstrak struktur dari: {org_chart_path.name} (Fase B/C)")
    print("=" * 78)
    extracted_rows = extract_structure(
        org_chart_path.read_bytes(),
        mime_type,
        include_names=args.with_names,
        source_filename=org_chart_path.name,
        ignore_unsolid_line=args.ignore_unsolid_line,
    )
    mapping_rows = [
        {"job_position": r.job_title, "parent_job_position": r.parent} for r in extracted_rows
    ]
    print(f"Total {len(mapping_rows)} Job Position hasil mapping (semua status, apa adanya).")

    # --- Langkah 2: Input 2 - master list Talenta ---
    print()
    print("=" * 78)
    print(f"[2/3] Membaca master list dari: {master_list_path.name} (sheet '{REQUIRED_MASTER_SHEET_NAME}')")
    print("=" * 78)
    try:
        master_names = read_master_job_position_names(master_list_path.read_bytes())
    except InvalidMasterListError as e:
        raise SystemExit(str(e))
    print(f"Total {len(master_names)} Job Position di master list Talenta.")

    # --- Langkah 3: perbandingan (Fase D) ---
    print()
    print("=" * 78)
    print("[3/3] Membandingkan hasil mapping vs master list (Fase D)")
    print("=" * 78)
    result = compare_job_positions(mapping_rows, master_names)

    print()
    print(f"### Sudah Ada ({len(result['sudah_ada'])}) - info saja, tidak perlu tindakan")
    if result["sudah_ada"]:
        print(pd.DataFrame(result["sudah_ada"]).to_string(index=False))
    else:
        print("(kosong)")

    print()
    print(f"### Baru ({len(result['baru'])}) - ada di mapping, tidak ada di master list Talenta")
    if result["baru"]:
        print(pd.DataFrame(result["baru"]).to_string(index=False))
    else:
        print("(kosong)")

    print()
    print(f"### Kandidat Vacant/Dihapus ({len(result['vacant_candidates'])}) - ada di master list, tidak muncul lagi di mapping")
    if result["vacant_candidates"]:
        print(pd.DataFrame(result["vacant_candidates"]).to_string(index=False))
    else:
        print("(kosong)")

    print()
    print(f"### Perlu Konfirmasi ({len(result['perlu_konfirmasi'])}) - nama mirip, AI tidak yakin sama/beda")
    if result["perlu_konfirmasi"]:
        print(pd.DataFrame(result["perlu_konfirmasi"]).to_string(index=False))
    else:
        print("(kosong)")

    # --- Export dummy kategori "Baru" (spec 3.7 poin 1) ---
    export_rows = build_new_positions_export_rows(result["baru"])
    output_xlsx = BASE_DIR / "job_position_comparison_new_positions_export.xlsx"
    if export_rows:
        df = pd.DataFrame(export_rows)
        df.to_excel(output_xlsx, index=False, sheet_name="New Job Positions")
        print()
        print(f"Export dummy kategori 'Baru' ({len(export_rows)} baris, 2 kolom) disimpan ke: {output_xlsx}")
    else:
        print()
        print("Tidak ada baris kategori 'Baru' - export dummy tidak dibuat.")

    print()
    print(
        f"Ringkasan: Sudah Ada={len(result['sudah_ada'])} | Baru={len(result['baru'])} | "
        f"Kandidat Vacant/Dihapus={len(result['vacant_candidates'])} | "
        f"Perlu Konfirmasi={len(result['perlu_konfirmasi'])}"
    )


if __name__ == "__main__":
    main()
