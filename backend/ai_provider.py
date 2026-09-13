"""
Layer pemanggilan AI. Saat ini pakai Gemini API untuk tahap testing/demo -
hemat biaya. Kalau nanti pindah ke Claude API untuk production, cukup ganti
isi call_ai() di file ini, bagian lain kode tidak perlu diubah.

Catatan model: awalnya diminta "gemini-2.5-flash", tapi model itu (dan
gemini-2.5-flash-lite) ternyata sudah tidak bisa diakses API key baru
("no longer available to new users"). Dikonfirmasi ke user, dan disepakati
pakai alias "gemini-flash-latest" (otomatis ikut versi Flash terbaru yang
tersedia untuk key ini).
"""

import os
import re
import time

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

load_dotenv()

_MODEL_NAME = "gemini-flash-latest"
_MAX_RETRIES = 5
_client: genai.Client | None = None

# Mode testing sementara (lihat CLAUDE.md) - kalau true, match_columns() dan
# bagian AI di compare_values() tidak memanggil Gemini API sama sekali, cukup
# kembalikan data dummy dengan format sama seperti response asli. Diaktifkan
# lewat USE_MOCK_AI=true di backend/.env, supaya tidak makan kuota free-tier
# untuk testing yang tidak berhubungan dengan logic AI mapping.
USE_MOCK_AI = os.getenv("USE_MOCK_AI", "false").strip().lower() == "true"


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise RuntimeError(
                "GEMINI_API_KEY belum di-set. Isi API key asli di file backend/.env "
                "(lihat backend/.env.example)."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _extract_retry_delay_seconds(error: genai_errors.ClientError) -> float | None:
    """Baca saran waktu tunggu dari error 429 (rate limit free-tier)."""
    details = getattr(error, "details", None)
    if not isinstance(details, dict):
        return None
    for item in details.get("details", []) or []:
        retry_delay = item.get("retryDelay") if isinstance(item, dict) else None
        if retry_delay:
            match = re.match(r"([\d.]+)", str(retry_delay))
            if match:
                return float(match.group(1))
    return None


def _generate_with_retry(contents, config: dict):
    """
    Inti pemanggilan Gemini yang dipakai bersama oleh call_ai() (teks) dan
    call_ai_vision() (teks + gambar/PDF) - supaya retry/rate-limit handling
    tidak dobel ditulis di dua tempat.
    """
    client = _get_client()
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return client.models.generate_content(
                model=_MODEL_NAME,
                contents=contents,
                config=config,
            )
        except genai_errors.ClientError as e:
            if e.code == 429 and attempt < _MAX_RETRIES:
                wait_seconds = (_extract_retry_delay_seconds(e) or 15) + 1
                time.sleep(wait_seconds)
                continue
            raise


def call_ai(prompt: str, response_schema=None):
    """
    Panggil AI dengan sebuah prompt teks.

    - Kalau response_schema diisi (pydantic model / list[pydantic model]), AI
      dipaksa mengembalikan JSON sesuai schema tsb, dan fungsi ini langsung
      mengembalikan object Python yang sudah ter-parse (bukan string JSON mentah).
    - Kalau response_schema None, fungsi ini mengembalikan teks jawaban biasa.
    - Kalau kena rate limit (429, umum di free-tier), otomatis menunggu lalu
      coba lagi (sampai _MAX_RETRIES kali) alih-alih langsung gagal.
    """
    config: dict = {}
    if response_schema is not None:
        config["response_mime_type"] = "application/json"
        config["response_schema"] = response_schema

    response = _generate_with_retry(prompt, config)
    if response_schema is not None:
        return response.parsed
    return response.text


def call_ai_vision(prompt: str, file_bytes: bytes, mime_type: str, response_schema=None):
    """
    Sama seperti call_ai(), tapi request-nya multimodal: satu file gambar/PDF
    dikirim bersama prompt teks. Dipakai Structure Mapper (lihat
    STRUCTURE-MAPPER-SPEC.md) untuk membaca bagan struktur organisasi/jabatan
    dari gambar/PDF - AI perlu "melihat" filenya, bukan cuma baca teks.

    mime_type: "image/png", "image/jpeg", atau "application/pdf". Gemini
    menerima gambar/PDF langsung sebagai inline data (tidak perlu dikonversi
    dulu di kode kita), selama ukurannya wajar (di bawah ~20MB).
    """
    config: dict = {}
    if response_schema is not None:
        config["response_mime_type"] = "application/json"
        config["response_schema"] = response_schema

    file_part = genai_types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
    response = _generate_with_retry([file_part, prompt], config)
    if response_schema is not None:
        return response.parsed
    return response.text
