"""
Test end-to-end Fase 2: baca dummy_new_document.xlsx & dummy_reference.xlsx,
jalankan match_columns() (Tahap 1), lalu compare_values() (Tahap 2), dan
tampilkan hasilnya di terminal + simpan ke CSV.
"""

from pathlib import Path

import pandas as pd

from column_matching import match_columns
from value_comparison import compare_values

BASE_DIR = Path(__file__).resolve().parent
DUMMY_DIR = BASE_DIR / "dummy_data"


def main():
    new_df = pd.read_excel(DUMMY_DIR / "dummy_new_document.xlsx")
    reference_df = pd.read_excel(DUMMY_DIR / "dummy_reference.xlsx")

    new_columns = [c for c in new_df.columns if c != "Employee ID"]
    # Field standar diambil dari header Reference Document yang dipakai,
    # bukan konstanta tetap (lihat CLAUDE.md bagian 5 & 6).
    standard_fields = [c for c in reference_df.columns if c != "Employee ID"]

    print("=" * 70)
    print("TAHAP 1 - Column Header Matching")
    print("=" * 70)
    matches = match_columns(new_columns, standard_fields)

    mapping_table = pd.DataFrame([m.model_dump() for m in matches])
    print(mapping_table.to_string(index=False))

    column_mapping = {
        m.kolom_new_document: m.field_standar_terdeteksi
        for m in matches
        if m.field_standar_terdeteksi is not None
    }

    print()
    print("=" * 70)
    print("TAHAP 2 - Value Comparison")
    print("=" * 70)
    # Untuk test end-to-end ini, semua field yang berhasil ter-mapping
    # dianggap "dicentang" user di step 3b.
    selected_fields = list(column_mapping.values())
    result = compare_values(new_df, reference_df, column_mapping, selected_fields)

    result_table = pd.DataFrame(result["rows"])
    print(result_table.to_string(index=False))

    if result["ids_only_in_new"]:
        print()
        print(f"[INFO] Employee ID hanya ada di New Document: {result['ids_only_in_new']}")
    if result["ids_only_in_reference"]:
        print()
        print(f"[INFO] Employee ID hanya ada di Reference Document: {result['ids_only_in_reference']}")

    output_csv = BASE_DIR / "test_run_result.csv"
    result_table.to_csv(output_csv, index=False)
    print()
    print(f"Hasil lengkap disimpan ke: {output_csv}")

    mapping_csv = BASE_DIR / "test_run_column_mapping.csv"
    mapping_table.to_csv(mapping_csv, index=False)
    print(f"Hasil mapping kolom disimpan ke: {mapping_csv}")


if __name__ == "__main__":
    main()
