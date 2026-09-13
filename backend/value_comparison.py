"""
Tahap 2 - Value Comparison (lihat CLAUDE.md bagian 5).

Langkah deterministic (normalisasi spasi, cek karakter khusus) dilakukan di
sini dengan regex/string cleaning biasa - bukan lewat AI. AI (Gemini) hanya
dipakai untuk kasus fuzzy/typo detection yang butuh judgment (misalnya "Sales
Manager" vs "Sales Manger").
"""

import difflib
import re

from pydantic import BaseModel

from ai_provider import USE_MOCK_AI, call_ai

# Izinkan tanda baca umum yang wajar muncul di value HR (titik, koma, strip,
# garis miring, ampersand, kurung). Simbol di luar itu dianggap "tidak wajar".
_ALLOWED_PUNCTUATION = r".,\-/&()"
_SPECIAL_CHAR_PATTERN = re.compile(rf"[^\w\s{_ALLOWED_PUNCTUATION}]")

# Karakter invisible unicode yang umum menyebabkan Employee ID gagal match
# padahal terlihat identik secara visual (zero-width space, non-breaking space).
_INVISIBLE_CHARS_PATTERN = re.compile(r"[​ ]")

# Field yang mismatch-nya HARUS selalu Need Confirmation, apapun jenis
# perbedaannya (bukan cuma typo/spasi seperti field lain) - lihat CLAUDE.md
# bagian 5 Tahap 2 poin 2.
_NAME_FIELDS = {"First Name", "Last Name"}
_NAME_MISMATCH_NOTE = (
    "Nama berbeda untuk Employee ID yang sama — perlu verifikasi manual, "
    "kemungkinan typo atau kesalahan Employee ID."
)


def normalize_whitespace(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def normalize_employee_id(value) -> str:
    """Normalisasi Employee ID sebelum dibandingkan/dijadikan key matching
    (lihat CLAUDE.md bagian 5 Tahap 2 poin 1): hilangkan spasi di awal/akhir,
    karakter invisible unicode yang umum menyebabkan mismatch visual, dan
    perbedaan besar/kecil huruf."""
    if value is None:
        return ""
    raw = str(value)
    cleaned = _INVISIBLE_CHARS_PATTERN.sub("", raw)
    return cleaned.strip().lower()


def has_special_character(value) -> bool:
    if value is None:
        return False
    return bool(_SPECIAL_CHAR_PATTERN.search(str(value)))


class TypoJudgement(BaseModel):
    is_typo: bool
    alasan: str


def _mock_judge_typo(field: str, old_value: str, new_value: str) -> TypoJudgement:
    """Mode testing tanpa panggil Gemini (lihat USE_MOCK_AI di ai_provider.py).
    Pakai kemiripan teks sederhana sebagai pengganti judgment AI asli."""
    ratio = difflib.SequenceMatcher(None, old_value.lower(), new_value.lower()).ratio()
    is_typo = ratio >= 0.6
    return TypoJudgement(
        is_typo=is_typo,
        alasan=(
            f"[MOCK] Kemiripan teks {ratio:.0%} antara nilai lama & baru "
            "(USE_MOCK_AI=true, tidak memanggil Gemini)."
        ),
    )


def _ai_judge_typo(field: str, old_value: str, new_value: str) -> TypoJudgement:
    if USE_MOCK_AI:
        return _mock_judge_typo(field, old_value, new_value)

    prompt = f"""Kamu menilai dua nilai data karyawan untuk field "{field}":

Nilai lama: "{old_value}"
Nilai baru: "{new_value}"

Tentukan apakah perbedaan ini kemungkinan besar:
(a) salah ketik/typo dari value yang sama (is_typo=true), atau
(b) memang perubahan data yang valid/disengaja, misalnya pindah
    jabatan/organisasi/level yang sebenarnya (is_typo=false).

Kalau dua value merujuk ke hal yang jelas berbeda maknanya (bukan sekadar
variasi ejaan/pengetikan), maka is_typo=false."""

    return call_ai(prompt, response_schema=TypoJudgement)


def compare_field(field: str, old_value, new_value) -> dict:
    """
    Bandingkan satu nilai field antara Reference (old) dan New (new).
    Return: {"status": "Unchanged"|"Changed"|"Need Confirmation", "note": str|None}
    """
    raw_old = "" if old_value is None else str(old_value)
    raw_new = "" if new_value is None else str(new_value)

    if raw_old == raw_new:
        return {"status": "Unchanged", "note": None}

    if field in _NAME_FIELDS:
        return {"status": "Need Confirmation", "note": _NAME_MISMATCH_NOTE}

    norm_old = normalize_whitespace(raw_old)
    norm_new = normalize_whitespace(raw_new)

    if norm_old == norm_new:
        return {
            "status": "Need Confirmation",
            "note": "Ada spasi tambahan (leading/trailing/ganda), makna value sebenarnya sama.",
        }

    if has_special_character(raw_old) or has_special_character(raw_new):
        return {
            "status": "Need Confirmation",
            "note": "Ada simbol/karakter yang tidak wajar pada value.",
        }

    judgement = _ai_judge_typo(field, raw_old, raw_new)
    if judgement.is_typo:
        return {
            "status": "Need Confirmation",
            "note": f"Kemungkinan typo: {judgement.alasan}",
        }
    return {"status": "Changed", "note": None}


def compare_values(new_df, reference_df, column_mapping: dict, selected_fields: list[str]) -> dict:
    """
    new_df, reference_df: pandas DataFrame, masing-masing punya kolom
        "Employee ID".
    column_mapping: dict {kolom_new_document: field_standar}, hasil
        match_columns() yang SUDAH dikoreksi user di step 3a.
    selected_fields: field standar yang dicentang user di step 3b.

    Return: {
        "rows": [ {employee_id, field, nilai_lama, nilai_baru, status, note, source}, ... ],
        "ids_only_in_new": [...],
        "ids_only_in_reference": [...],
    }

    Untuk Employee ID yang cuma ada di salah satu dokumen (CLAUDE.md bagian 5
    poin 3, keputusan final): baris hasil tetap dibuat per field (konsisten
    dengan baris Changed/Unchanged/Need Confirmation lain), tapi status-nya
    "Not Found" dan salah satu sisi (nilai_lama atau nilai_baru) dikosongkan.
    Kolom "source" menandai kasusnya supaya gampang difilter di step Report:
    - "matched": Employee ID ada di kedua dokumen (perbandingan normal).
    - "unidentified_employee": ID ada di Reference, tidak ada di New Document.
    - "new_employee": ID ada di New Document, tidak ada di Reference.
    """
    field_to_new_col = {v: k for k, v in column_mapping.items() if v is not None}

    new_indexed = new_df.set_index("Employee ID")
    ref_indexed = reference_df.set_index("Employee ID")

    # Matching Employee ID dilakukan lewat versi ternormalisasi (CLAUDE.md
    # bagian 5 Tahap 2 poin 1) - supaya ID yang identik secara visual tapi
    # beda whitespace/karakter invisible/huruf besar-kecil tidak salah
    # dianggap Not Found. raw id asli tetap dipakai untuk ditampilkan ke user.
    new_norm_to_raw: dict[str, object] = {}
    for raw_id in new_indexed.index:
        new_norm_to_raw.setdefault(normalize_employee_id(raw_id), raw_id)
    ref_norm_to_raw: dict[str, object] = {}
    for raw_id in ref_indexed.index:
        ref_norm_to_raw.setdefault(normalize_employee_id(raw_id), raw_id)

    common_norms = [n for n in new_norm_to_raw if n in ref_norm_to_raw]
    only_new_norms = [n for n in new_norm_to_raw if n not in ref_norm_to_raw]
    only_ref_norms = [n for n in ref_norm_to_raw if n not in new_norm_to_raw]

    # Debug: tampilkan repr() Employee ID yang BENAR-BENAR gagal match setelah
    # normalisasi, supaya kalau masih ada karakter aneh yang belum kecover
    # oleh normalize_employee_id(), langsung kelihatan persis apa isinya.
    for norm in only_new_norms:
        raw_id = new_norm_to_raw[norm]
        print(
            f"[DEBUG Employee ID gagal match] hanya ada di New Document - "
            f"raw={raw_id!r} normalized={norm!r}",
            flush=True,
        )
    for norm in only_ref_norms:
        raw_id = ref_norm_to_raw[norm]
        print(
            f"[DEBUG Employee ID gagal match] hanya ada di Reference Document - "
            f"raw={raw_id!r} normalized={norm!r}",
            flush=True,
        )

    ids_only_in_new = [new_norm_to_raw[n] for n in only_new_norms]
    ids_only_in_reference = [ref_norm_to_raw[n] for n in only_ref_norms]

    rows = []
    for norm in common_norms:
        new_raw_id = new_norm_to_raw[norm]
        ref_raw_id = ref_norm_to_raw[norm]
        eid = new_raw_id
        new_row = new_indexed.loc[new_raw_id]
        ref_row = ref_indexed.loc[ref_raw_id]
        for field in selected_fields:
            new_col = field_to_new_col.get(field)
            if new_col is None or new_col not in new_row.index or field not in ref_row.index:
                continue
            old_value = ref_row.get(field)
            new_value = new_row.get(new_col)
            outcome = compare_field(field, old_value, new_value)
            rows.append(
                {
                    "employee_id": eid,
                    "field": field,
                    "nilai_lama": old_value,
                    "nilai_baru": new_value,
                    "status": outcome["status"],
                    "note": outcome["note"],
                    "source": "matched",
                }
            )

    for eid in ids_only_in_reference:
        ref_row = ref_indexed.loc[eid]
        for field in selected_fields:
            if field not in ref_row.index:
                continue
            rows.append(
                {
                    "employee_id": eid,
                    "field": field,
                    "nilai_lama": ref_row.get(field),
                    "nilai_baru": None,
                    "status": "Not Found",
                    "note": "Employee ID ada di Reference Document tapi tidak ditemukan di New Document.",
                    "source": "unidentified_employee",
                }
            )

    for eid in ids_only_in_new:
        new_row = new_indexed.loc[eid]
        for field in selected_fields:
            new_col = field_to_new_col.get(field)
            if new_col is None or new_col not in new_row.index:
                continue
            rows.append(
                {
                    "employee_id": eid,
                    "field": field,
                    "nilai_lama": None,
                    "nilai_baru": new_row.get(new_col),
                    "status": "Not Found",
                    "note": "Employee ID ada di New Document tapi belum ada di Reference Document (kemungkinan karyawan baru).",
                    "source": "new_employee",
                }
            )

    return {
        "rows": rows,
        "ids_only_in_new": ids_only_in_new,
        "ids_only_in_reference": ids_only_in_reference,
    }
