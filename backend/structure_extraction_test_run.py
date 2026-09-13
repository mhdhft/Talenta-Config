"""
Structure Mapper - Fase B: test manual ekstraksi struktur dari 1 file
gambar/PDF bagan organisasi/jabatan (lihat STRUCTURE-MAPPER-SPEC.md bagian 6,
Open Item #1).

Script ini BERDIRI SENDIRI - belum disambung ke aplikasi/backend/frontend.
Tujuannya cuma untuk mengetes hasil ekstraksi AI di terminal, sebelum logic
ini dipakai beneran di Fase C.

Cara pakai (dari folder backend/):
    python structure_extraction_test_run.py <path_ke_file>
    python structure_extraction_test_run.py <path_ke_file> --with-names

Contoh:
    python structure_extraction_test_run.py contoh_bagan.png
    python structure_extraction_test_run.py contoh_bagan.pdf --with-names

Default: nama pemegang jabatan TIDAK dibaca (--with-names untuk mengaktifkan).

Mode mock (tanpa panggil Gemini asli, hemat kuota): set USE_MOCK_AI=true di
backend/.env sebelum menjalankan script ini.
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from structure_extraction import extract_structure, guess_mime_type

BASE_DIR = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(
        description="Test ekstraksi struktur job position dari gambar/PDF bagan."
    )
    parser.add_argument(
        "file_path", help="Path ke file gambar (PNG/JPG/JPEG) atau PDF bagan struktur."
    )
    parser.add_argument(
        "--with-names",
        action="store_true",
        help="Aktifkan pembacaan nama pemegang jabatan (default: tidak dibaca).",
    )
    parser.add_argument(
        "--ignore-unsolid-line",
        action="store_true",
        help="Aktifkan toggle 'Ignore Unsolid Line' (default: tidak aktif, garis putus-putus tetap di-flag manual).",
    )
    args = parser.parse_args()

    file_path = Path(args.file_path)
    if not file_path.is_file():
        raise SystemExit(f"File tidak ditemukan: {file_path}")

    try:
        mime_type = guess_mime_type(file_path.name)
    except ValueError as e:
        raise SystemExit(str(e))
    file_bytes = file_path.read_bytes()

    print("=" * 70)
    print(f"Mengekstrak struktur dari: {file_path.name}")
    print(
        f"Mime type: {mime_type} | Baca nama: {'ya' if args.with_names else 'tidak'} | "
        f"Ignore Unsolid Line: {'ya' if args.ignore_unsolid_line else 'tidak'}"
    )
    print("=" * 70)

    rows = extract_structure(
        file_bytes,
        mime_type,
        include_names=args.with_names,
        source_filename=file_path.name,
        ignore_unsolid_line=args.ignore_unsolid_line,
    )

    # source_box_id_internal sengaja TIDAK ditampilkan di tabel - itu cuma
    # untuk penelusuran internal baris hasil duplikasi kasus (a), bukan
    # bagian dari output yang dilihat user (lihat docstring StructureRow).
    display_columns = ["job_title", "parent", "name", "status", "note"]
    table = pd.DataFrame([r.model_dump() for r in rows])[display_columns]
    print(table.to_string(index=False))

    ok_count = sum(1 for r in rows if r.status == "ok")
    duplicated_count = sum(1 for r in rows if r.status == "ambiguous_solid_merge")
    manual_count = sum(1 for r in rows if r.status in ("dotted_line_multi_parent", "failed_unreadable"))
    print()
    print(
        f"Total baris hasil: {len(rows)} | Berhasil: {ok_count} | "
        f"Duplikat (solid-line ambigu): {duplicated_count} | Perlu dicek manual: {manual_count}"
    )
    if duplicated_count:
        print()
        print("Baris berikut hasil duplikasi otomatis (kasus solid-line ambigu):")
        for row in rows:
            if row.status == "ambiguous_solid_merge":
                print(f"  - \"{row.job_title}\" (parent: {row.parent}) [asal box internal: {row.source_box_id_internal}]")
                print(f"    Catatan: {row.note}")
    if manual_count:
        print()
        print("Baris berikut ditandai perlu dicek manual:")
        for row in rows:
            if row.status in ("dotted_line_multi_parent", "failed_unreadable"):
                print(f"  - \"{row.job_title}\" [{row.status}]: {row.note}")

    output_json = BASE_DIR / "structure_extraction_result.json"
    output_json.write_text(
        json.dumps([r.model_dump() for r in rows], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print()
    print(f"Hasil lengkap (JSON) disimpan ke: {output_json}")


if __name__ == "__main__":
    main()
