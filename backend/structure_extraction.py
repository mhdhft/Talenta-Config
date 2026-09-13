"""
Structure Mapper - Fase B: ekstraksi struktur organisasi/jabatan dari gambar
atau PDF bagan (lihat STRUCTURE-MAPPER-SPEC.md bagian 6, Open Item #1).

Berbeda dari flow utama (column_matching.py / value_comparison.py) yang
inputnya tabel, di sini AI membaca sebuah GAMBAR/PDF bagan: mendeteksi
kotak (job title, opsional nama orang) dan garis penghubung antar kotak,
lalu menentukan relasi parent-child (kotak yang ditarik garis ke kotak DI
ATASNYA -> kotak atas adalah parent).

Aturan inti (lihat spec untuk detail lengkap):
- Struktur diasumsikan berbentuk pohon: 1 kotak cuma boleh 1 parent lewat
  garis solid yang jelas. Dua kasus khusus dibedakan penanganannya:
    (a) garis SOLID yang menyatu di titik ambigu antara 2+ kotak di atasnya
        -> JANGAN flag manual, DUPLIKASI jadi 1 baris per kemungkinan parent
           (lihat _translate_boxes).
    (b) garis PUTUS-PUTUS (dotted-line, notasi indirect reporting) -> TETAP
        flag "perlu manual", TIDAK diduplikasi.
- Tiap kotak dikasih ID internal sementara (dibuat AI sendiri, mis. "B1")
  cuma untuk menyambungkan relasi parent-child di balik layar - tidak
  pernah ditampilkan ke user. Output akhir sudah diterjemahkan ke nama
  Job Position.
- Kalau sebagian gambar buram/gagal dibaca: bagian yang berhasil tetap
  ditampilkan, bagian yang gagal ditandai (bukan ditolak total, bukan
  ditebak).
- Nama pemegang jabatan (kolom Name) sifatnya opsional - kalau
  include_names=False, field name selalu dikosongkan biar konsisten,
  walau AI kebetulan "melihat" ada nama di gambar.
"""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from ai_provider import USE_MOCK_AI, call_ai_vision

_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

# "ok"                     - kotak terbaca yakin, parent tunggal jelas (atau root).
# "ambiguous_solid_merge"  - kasus (a): garis solid menyatu ambigu di 2+ kotak
#                            atasan. TIDAK dianggap gagal - diduplikasi jadi
#                            beberapa baris (lihat _translate_boxes).
# "dotted_line_multi_parent" - kasus (b): garis putus-putus ke 2+ kotak atasan
#                            (indirect reporting yang disengaja). Flag manual.
# "failed_unreadable"      - kasus (c): sebagian gambar buram/tidak jelas, atau
#                            box_id yang dirujuk AI tidak ditemukan. Flag manual.
BoxStatus = Literal["ok", "ambiguous_solid_merge", "dotted_line_multi_parent", "failed_unreadable"]


def guess_mime_type(filename: str) -> str:
    """Tentukan mime type dari ekstensi file. Lihat STRUCTURE-MAPPER-SPEC.md
    bagian 3.2 untuk daftar format yang didukung (PDF, JPG, JPEG, PNG)."""
    ext = Path(filename).suffix.lower()
    if ext not in _MIME_TYPES:
        supported = ", ".join(sorted(set(_MIME_TYPES.values())))
        raise ValueError(
            f"Format file tidak didukung: '{ext or '(tanpa ekstensi)'}'. "
            f"Format yang didukung: PDF, JPG, JPEG, PNG ({supported})."
        )
    return _MIME_TYPES[ext]


class ExtractedBox(BaseModel):
    """Representasi 1 kotak di bagan, sebelum ID diterjemahkan ke nama.
    box_id/parent_box_id/ambiguous_parent_box_ids bersifat internal - jangan
    pernah diekspos ke user."""

    box_id: str
    job_title: str
    name: str | None
    parent_box_id: str | None
    # Hanya diisi kalau status == "ambiguous_solid_merge": daftar box_id
    # kandidat parent, URUT VISUAL KIRI-KE-KANAN posisi kotak parent-nya.
    ambiguous_parent_box_ids: list[str] | None = None
    status: BoxStatus
    note: str | None


class StructureRow(BaseModel):
    """Baris hasil akhir setelah box_id diterjemahkan ke nama Job Position -
    ini yang ditampilkan/diexport ke user (lihat spec: kolom Job Position,
    Parent Job Position, Name).

    source_box_id_internal: HANYA terisi untuk baris hasil duplikasi kasus
    (a) - dipakai untuk penelusuran/merge manual internal, TIDAK dimaksudkan
    tampil di UI/Excel akhir (lihat test_run.py, kolom ini sengaja disembunyikan
    dari tabel yang dicetak ke user).
    """

    job_title: str
    parent: str | None
    name: str | None
    status: BoxStatus
    note: str | None
    source_box_id_internal: str | None = None


def _build_prompt(include_names: bool) -> str:
    name_instruction = (
        "Kalau di bawah/di dalam sebuah kotak ada nama orang (pemegang jabatan "
        "tsb), baca juga dan isi ke field \"name\". Kalau tidak ada nama yang "
        "terlihat, isi \"name\" dengan null."
        if include_names
        else 'Field "name" SELALU diisi null - jangan baca nama orang sama sekali, '
        "cukup fokus ke job title dan relasi antar kotak."
    )

    return f"""Kamu adalah asisten yang membaca bagan struktur organisasi/jabatan dari
gambar atau PDF yang diberikan.

Tugas kamu:
1. Deteksi SETIAP kotak (box) di bagan yang berisi job title / nama jabatan.
2. Beri tiap kotak ID internal unik buatanmu sendiri (contoh: "B1", "B2", dst)
   - ID ini cuma dipakai untuk menyambungkan relasi parent-child di jawabanmu,
   BUKAN bagian dari isi bagan.
3. SEBELUM menentukan parent, periksa dulu GAYA GARIS setiap penghubung
   dengan teliti - ini langkah PALING PENTING dan paling sering salah kalau
   diburu-buru:
   - **Garis SOLID**: garis lurus menerus, TIDAK terputus sama sekali dari
     satu kotak ke kotak lain.
   - **Garis PUTUS-PUTUS / dashed/dotted**: garis yang terdiri dari
     serangkaian segmen pendek dengan celah/gap di antaranya (kadang cuma
     berupa titik-titik kecil). Ini bisa saja HANYA ADA SATU garis
     putus-putus per kotak (bukan berarti harus nyambung ke banyak kotak
     sekaligus untuk dianggap "dotted") - satu garis putus-putus saja SUDAH
     CUKUP untuk masuk kasus (b) di bawah, jangan disamakan dengan garis
     solid biasa hanya karena cuma ada satu garis.
   - Cermati baik-baik terutama di bagian bawah/pinggir bagan yang kadang
     garisnya lebih tipis atau kualitas gambarnya kurang tajam - jangan
     buru-buru simpulkan garis itu solid kalau kamu belum yakin benar-benar
     tidak ada celah/putus di sepanjang garisnya.
4. Kalau garisnya SOLID dan jelas menyambung ke SATU kotak lain yang
   posisinya DI ATASNYA (tidak ambigu - lihat kasus (a) di bawah kalau
   ambigu), maka kotak di atas itu adalah PARENT dari kotak tsb. Isi
   "parent_box_id" dengan box_id milik parent itu, status "ok". Kalau sebuah
   kotak tidak punya garis ke atas sama sekali (paling atas/root bagan), isi
   "parent_box_id" dengan null dan status "ok".
5. KASUS KHUSUS (a) - garis SOLID menyatu di titik AMBIGU antara 2 atau lebih
   kotak di atasnya (contoh: kotak digambar di tengah, garis vertikalnya
   nyambung ke titik pertemuan garis horizontal yang menghubungkan 2+ kotak
   berbeda di atasnya, sehingga tidak jelas parent-nya persis yang mana):
   - JANGAN menebak salah satu sebagai parent.
   - Isi "parent_box_id" dengan null, status "ambiguous_solid_merge".
   - Isi "ambiguous_parent_box_ids" dengan daftar box_id SEMUA kandidat
     parent yang mungkin, URUTKAN sesuai posisi visual KIRI KE KANAN kotak
     parent tsb di gambar (bukan urutan bebas).
   - Jelaskan di "note" kotak mana saja (sebut job title-nya) yang
     kemungkinan jadi parent dan kenapa terlihat ambigu.
6. KASUS KHUSUS (b) - kotak yang terhubung lewat garis PUTUS-PUTUS (dotted/
   dashed-line) ke salah satu/beberapa kotak di atasnya (notasi indirect
   reporting yang DISENGAJA, beda dari kasus (a) yang murni ambiguitas garis
   solid). PENTING: ini berlaku SAMA PERSIS baik kotak itu terhubung
   putus-putus ke HANYA SATU kotak di atasnya, MAUPUN ke 2+ kotak sekaligus -
   jumlah kotak yang terhubung TIDAK MENENTUKAN apakah kasus ini berlaku,
   yang menentukan adalah GAYA GARISNYA (putus-putus, bukan solid):
   - JANGAN menebak parent-nya, dan JANGAN diduplikasi (beda dengan kasus a).
   - Isi "parent_box_id" dengan null, status "dotted_line_multi_parent".
   - "ambiguous_parent_box_ids" dibiarkan null untuk kasus ini (tidak dipakai).
   - Jelaskan di "note" kotak mana saja (sebut job title-nya) yang terhubung
     lewat garis putus-putus tsb, meskipun cuma satu kotak.
7. KASUS KHUSUS (c) - sebagian gambar buram/tidak jelas sehingga sebuah kotak
   tidak bisa dibaca dengan yakin (job title tidak jelas, atau kamu benar-benar
   tidak bisa memastikan gaya garisnya solid atau putus-putus meski sudah
   diperhatikan baik-baik, dan ini BUKAN kasus (a)/(b) di atas): TETAP
   masukkan kotak itu di hasil (jangan dihilangkan), isi job_title dengan
   teks terbaik yang bisa kamu baca (atau "(tidak terbaca)" kalau
   benar-benar tidak terbaca), status "failed_unreadable", parent_box_id
   null, dan jelaskan masalahnya di "note".
8. Kalau sebuah kotak berhasil dibaca dengan yakin dan relasi parent-nya
   jelas (termasuk kotak paling atas/root), isi status "ok" dan note null.
9. {name_instruction}

Kembalikan HASIL untuk SETIAP kotak yang terdeteksi di bagan, jangan ada
yang dilewat, jangan menambah kotak yang tidak ada di gambar."""


def _mock_extract_boxes(include_names: bool, source_filename: str | None) -> list[ExtractedBox]:
    """Mode testing tanpa panggil Gemini (lihat USE_MOCK_AI di ai_provider.py).

    Mock mode TIDAK membaca isi file sama sekali (lihat extract_structure) -
    supaya tetap bisa didemokan lewat CLI test_run.py dengan nama file yang
    relevan, skenario dipilih berdasarkan NAMA file yang diberikan:
      - "org-chart-1*"  -> skenario kasus (a) solid-line ambigu
      - "org-chart-2*"  -> skenario kasus (b) dotted-line
      - nama lain       -> skenario umum lama (CEO/CFO/CHRO/dst)
    """
    stem = Path(source_filename).stem.lower() if source_filename else ""

    if "org-chart-1" in stem:
        return _mock_scenario_solid_ambiguous(include_names)
    if "org-chart-2" in stem:
        return _mock_scenario_dotted_line(include_names)
    return _mock_scenario_default(include_names)


def _mock_scenario_solid_ambiguous(include_names: bool) -> list[ExtractedBox]:
    """Meniru contoh bagan: Direktur Operasional & Marketing -> (Direktur BBM,
    Pelumas & Kimia | Direktur LPG) -> Business Unit Manager, di mana garis
    solid dari Business Unit Manager menyatu tepat di titik pertemuan garis
    horizontal antara kedua Direktur di atasnya (kasus (a))."""
    return [
        ExtractedBox(
            box_id="B1",
            job_title="Direktur Operasional & Marketing",
            name=None,
            parent_box_id=None,
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B2",
            job_title="Direktur BBM, Pelumas & Kimia",
            name=None,
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B3",
            job_title="Direktur LPG",
            name=None,
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B4",
            job_title="Business Unit Manager",
            name=None,
            parent_box_id=None,
            ambiguous_parent_box_ids=["B2", "B3"],  # kiri ke kanan: BBM dulu, baru LPG
            status="ambiguous_solid_merge",
            note=(
                "[MOCK] Garis solid dari kotak ini menyatu tepat di titik pertemuan "
                "garis horizontal antara \"Direktur BBM, Pelumas & Kimia\" (kiri) dan "
                "\"Direktur LPG\" (kanan) - tidak bisa dipastikan parent tunggalnya."
            ),
        ),
    ]


def _mock_scenario_dotted_line(include_names: bool) -> list[ExtractedBox]:
    """Meniru contoh bagan: HRS & LGA Supervisor -> (HR & Legal Officer | HSE
    & GA Officer | Maintenance Officer), lalu garis PUTUS-PUTUS menghubungkan
    baris di bawahnya (Courier, OB/OG, Security) - kasus (b)."""
    return [
        ExtractedBox(
            box_id="B1",
            job_title="HRS & LGA Supervisor",
            name=None,
            parent_box_id=None,
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B2",
            job_title="HR & Legal Officer",
            name=None,
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B3",
            job_title="HSE & GA Officer",
            name=None,
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B4",
            job_title="Maintenance Officer",
            name=None,
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B5",
            job_title="Courier",
            name=None,
            parent_box_id=None,
            status="dotted_line_multi_parent",
            note=(
                "[MOCK] Kotak ini terhubung lewat garis putus-putus (indirect "
                "reporting) di bawah baris \"HR & Legal Officer\" / \"HSE & GA "
                "Officer\" / \"Maintenance Officer\" - notasi disengaja, bukan "
                "ambiguitas visual, tidak ditebak/diduplikasi, perlu dicek manual."
            ),
        ),
        ExtractedBox(
            box_id="B6",
            job_title="OB/OG",
            name=None,
            parent_box_id=None,
            status="dotted_line_multi_parent",
            note=(
                "[MOCK] Sama seperti \"Courier\" - terhubung garis putus-putus, "
                "perlu dicek manual."
            ),
        ),
        ExtractedBox(
            box_id="B7",
            job_title="Security",
            name=None,
            parent_box_id=None,
            status="dotted_line_multi_parent",
            note=(
                "[MOCK] Sama seperti \"Courier\" - terhubung garis putus-putus, "
                "perlu dicek manual."
            ),
        ),
    ]


def _mock_scenario_default(include_names: bool) -> list[ExtractedBox]:
    """Skenario umum lama (dipakai kalau nama file tidak cocok org-chart-1/2) -
    CEO -> (CFO, CHRO) -> Finance/HR Manager, plus 1 contoh dotted-line."""
    names = {
        "B1": "Andi Wijaya",
        "B2": "Budi Santoso",
        "B3": "Citra Dewi",
        "B4": "Dedi Kurniawan",
        "B5": "Eka Putri",
    }

    def dummy_name(box_id: str) -> str | None:
        return names[box_id] if include_names else None

    return [
        ExtractedBox(
            box_id="B1",
            job_title="Chief Executive Officer",
            name=dummy_name("B1"),
            parent_box_id=None,
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B2",
            job_title="Chief Financial Officer",
            name=dummy_name("B2"),
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B3",
            job_title="Chief Human Resources Officer",
            name=dummy_name("B3"),
            parent_box_id="B1",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B4",
            job_title="Finance Manager",
            name=dummy_name("B4"),
            parent_box_id="B2",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B5",
            job_title="HR Manager",
            name=dummy_name("B5"),
            parent_box_id="B3",
            status="ok",
            note=None,
        ),
        ExtractedBox(
            box_id="B6",
            job_title="Business Partner",
            name=None,
            parent_box_id=None,
            status="dotted_line_multi_parent",
            note=(
                "[MOCK] Contoh kasus dotted-line: kotak ini terdeteksi punya garis "
                "putus-putus ke 2 kotak di atasnya (Chief Financial Officer dan Chief "
                "Human Resources Officer) - tidak ditebak, perlu dicek manual."
            ),
        ),
    ]


def _translate_boxes(
    boxes: list[ExtractedBox], include_names: bool, ignore_unsolid_line: bool = False
) -> list[StructureRow]:
    """Terjemahkan parent_box_id (ID internal) jadi nama Job Position parent-nya.
    box_id/parent_box_id/ambiguous_parent_box_ids tidak pernah muncul di hasil
    akhir ini (kecuali source_box_id_internal, khusus baris duplikat kasus (a),
    yang memang tidak dimaksudkan tampil ke user - lihat docstring StructureRow).

    ignore_unsolid_line: toggle "Ignore Unsolid Line" (lihat spec bagian 6,
    Open Item #1). Kalau True, box berstatus "dotted_line_multi_parent"
    (kasus b) TIDAK di-flag manual lagi - dianggap "ok" tanpa catatan. Karena
    kasus (b) di prompt SELALU mengisi parent_box_id=null (apa pun jumlah
    garis putus-putusnya - lihat _build_prompt poin 6), box jenis ini memang
    tidak pernah punya parent solid tercatat, jadi hasilnya PASTI "tidak
    punya parent sama sekali" begitu garis putus-putusnya diabaikan -> diisi
    literal "Unmapped" (bukan None/"-", supaya beda dari root asli yang sah).
    Kasus (a) solid-ambigu dan (c) buram TIDAK terpengaruh toggle ini sama
    sekali.
    """
    title_by_id = {box.box_id: box.job_title for box in boxes}

    rows: list[StructureRow] = []
    for box in boxes:
        name = box.name if include_names else None

        # Kasus (a): garis solid ambigu -> DUPLIKASI, bukan flag manual.
        if box.status == "ambiguous_solid_merge":
            parent_ids = box.ambiguous_parent_box_ids or []
            parent_titles = [title_by_id.get(pid) for pid in parent_ids]

            if len(parent_ids) < 2 or any(t is None for t in parent_titles):
                # Data AI tidak konsisten (kandidat parent < 2, atau ada box_id
                # yang tidak ditemukan) - jangan dipaksakan diduplikasi, aman-kan
                # jadi flag manual biasa.
                rows.append(
                    StructureRow(
                        job_title=box.job_title,
                        parent=None,
                        name=name,
                        status="failed_unreadable",
                        note=(
                            (box.note + " " if box.note else "")
                            + "[Kandidat parent ambigu tidak valid/tidak lengkap - "
                            "perlu dicek manual.]"
                        ),
                    )
                )
                continue

            notice = (
                f'Posisi "{box.job_title}" terdeteksi ambigu - garis solid menyatu '
                f"di antara {len(parent_titles)} kotak atasan "
                f'({", ".join(parent_titles)}). Sistem otomatis membuat '
                f"{len(parent_titles)} baris terpisah di bawah ini (satu per "
                "kemungkinan parent). Mohon cek dan gabungkan/hapus salah satu "
                "manual kalau ternyata cuma 1 yang benar."
            )
            for i, parent_title in enumerate(parent_titles, start=1):
                rows.append(
                    StructureRow(
                        job_title=f"{box.job_title} {i}",
                        parent=parent_title,
                        name=name,
                        status="ambiguous_solid_merge",
                        note=notice,
                        source_box_id_internal=box.box_id,
                    )
                )
            continue

        # Kasus (b) dengan toggle "Ignore Unsolid Line" aktif: batalkan flag
        # manual, jadi "ok" tanpa catatan. Parent selalu "Unmapped" (lihat
        # docstring di atas - box kasus ini tidak pernah punya parent solid).
        if box.status == "dotted_line_multi_parent" and ignore_unsolid_line:
            rows.append(
                StructureRow(
                    job_title=box.job_title,
                    parent="Unmapped",
                    name=name,
                    status="ok",
                    note=None,
                )
            )
            continue

        # Kasus (b)/(c) dan kasus normal.
        parent_title = None
        status = box.status
        note = box.note

        if box.parent_box_id is not None:
            parent_title = title_by_id.get(box.parent_box_id)
            if parent_title is None:
                # AI menyebut box_id parent yang tidak ada di hasil - jangan
                # ditebak, tandai perlu dicek manual (lihat aturan fallback).
                status = "failed_unreadable"
                note = (
                    f"{note} " if note else ""
                ) + "[Parent yang dirujuk AI tidak ditemukan di hasil - perlu dicek manual.]"

        rows.append(
            StructureRow(
                job_title=box.job_title,
                parent=parent_title,
                name=name,
                status=status,
                note=note,
            )
        )
    return rows


def extract_structure(
    file_bytes: bytes,
    mime_type: str,
    include_names: bool = False,
    source_filename: str | None = None,
    ignore_unsolid_line: bool = False,
) -> list[StructureRow]:
    """
    Ekstrak struktur job position dari 1 file gambar/PDF bagan.

    include_names: kalau True, AI juga coba baca nama pemegang jabatan (kalau
    ada di gambar). Default False - hanya Job Position & relasi parent yang
    dibaca (lihat toggle "Name" di spec, bagian 6 Open Item #1).

    source_filename: HANYA dipakai untuk memilih skenario mock (lihat
    _mock_extract_boxes) saat USE_MOCK_AI=true - tidak berpengaruh sama
    sekali ke pemanggilan Gemini asli (yang murni baca file_bytes).

    ignore_unsolid_line: toggle "Ignore Unsolid Line" (default False = tidak
    ada perubahan perilaku). Lihat docstring _translate_boxes untuk detail.
    """
    if USE_MOCK_AI:
        boxes = _mock_extract_boxes(include_names, source_filename)
    else:
        prompt = _build_prompt(include_names)
        boxes = call_ai_vision(
            prompt, file_bytes, mime_type, response_schema=list[ExtractedBox]
        )

    return _translate_boxes(boxes, include_names, ignore_unsolid_line)
