"""
Tahap 1 - Column Header Matching (lihat CLAUDE.md bagian 5).

Kolom A New Document selalu "Employee ID" (tidak perlu di-matching, dipakai
langsung sebagai key). Fungsi di sini mencocokkan kolom B dst di New Document
(nama/urutan bisa acak) terhadap daftar field standar.

Field standar TIDAK boleh berupa daftar tetap/konstanta - field standar harus
selalu diambil dari header row Reference Document yang diupload user pada
proses analisis yang bersangkutan (lihat CLAUDE.md bagian 6: Template A cuma
acuan struktur baku untuk Reference Document, bukan sumber field standar yang
dibaca langsung dari file template saat runtime).
"""

import difflib

from pydantic import BaseModel

from ai_provider import USE_MOCK_AI, call_ai


class ColumnMatch(BaseModel):
    kolom_new_document: str
    field_standar_terdeteksi: str | None
    confidence: str  # "high" | "medium" | "low"
    alasan: str


def _mock_match_columns(
    new_columns: list[str], standard_fields: list[str]
) -> list[ColumnMatch]:
    """Mode testing tanpa panggil Gemini (lihat USE_MOCK_AI di ai_provider.py).
    Pencocokan berbasis kemiripan teks sederhana, bukan pemahaman semantik AI
    asli - hanya supaya alur selanjutnya tetap bisa dites."""
    results = []
    for col in new_columns:
        col_norm = col.strip().lower()
        best_field = None
        best_ratio = 0.0
        for field in standard_fields:
            ratio = difflib.SequenceMatcher(None, col_norm, field.lower()).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_field = field

        if best_ratio >= 0.85:
            confidence = "high"
        elif best_ratio >= 0.5:
            confidence = "medium"
        else:
            confidence = "low"
            best_field = None

        results.append(
            ColumnMatch(
                kolom_new_document=col,
                field_standar_terdeteksi=best_field,
                confidence=confidence,
                alasan=(
                    "[MOCK] Dicocokkan otomatis berdasarkan kemiripan teks "
                    "(USE_MOCK_AI=true, tidak memanggil Gemini)."
                ),
            )
        )
    return results


def match_columns(
    new_columns: list[str], standard_fields: list[str]
) -> list[ColumnMatch]:
    """
    new_columns: nama-nama kolom New Document SELAIN "Employee ID" (kolom A).
    standard_fields: daftar field standar, diambil dari header row Reference
        Document yang diupload user pada proses analisis ini (bukan
        konstanta tetap - lihat CLAUDE.md bagian 5 & 6).

    Return: list ColumnMatch, urut sesuai urutan new_columns.
    """
    if USE_MOCK_AI:
        return _mock_match_columns(new_columns, standard_fields)

    prompt = f"""Kamu adalah asisten HR yang mencocokkan nama kolom spreadsheet dengan daftar field standar.

Daftar field standar yang tersedia:
{chr(10).join(f"- {f}" for f in standard_fields)}

Kolom-kolom berikut berasal dari dokumen Excel yang di-upload user. Nama kolom
bisa disingkat, berbahasa Indonesia, atau berbeda urutan dari field standar:
{chr(10).join(f"- {c}" for c in new_columns)}

Untuk SETIAP kolom input di atas, tentukan field standar yang paling cocok
secara makna (bukan hanya kemiripan huruf/karakter).

Aturan confidence:
- "high": nama sangat jelas/identik secara makna dengan field standar.
- "medium": cukup masuk akal tapi ada sedikit ambiguitas.
- "low": ambigu, tidak yakin, atau kurang jelas padanannya.

Kalau benar-benar tidak ada field standar yang cocok, isi
field_standar_terdeteksi dengan null dan confidence "low".

Kembalikan hasil untuk SETIAP kolom input, urut persis sesuai urutan input di
atas (jangan ada yang terlewat, jangan menambah baris baru)."""

    return call_ai(prompt, response_schema=list[ColumnMatch])
