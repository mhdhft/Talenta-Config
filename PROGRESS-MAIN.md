# Progress Log — Talenta Position Mapping

Dokumen ini mencatat riwayat revisi per sesi kerja. Tulis entry baru di paling
bawah file, jangan menimpa/menghapus entry lama. Ini catatan progres, bukan
pengganti CLAUDE.md — kalau ada aturan produk yang berubah, tetap harus
dikonfirmasi dan dicatat di CLAUDE.md secara terpisah.

---

## 2026-07-28

### 1. Revisi yang selesai di sesi ini

**Mode testing tanpa Gemini API**
- Tambah saklar `USE_MOCK_AI` (di file `.env`) supaya proses Analyze bisa
  ditest tanpa memanggil Gemini beneran — hemat kuota selama testing.
- File: `backend/ai_provider.py`, `backend/column_matching.py`,
  `backend/value_comparison.py`, `backend/.env`, `backend/.env.example`.

**Field opsional Effective Date & Transfer Type**
- Ditambahkan di step "Input Company Info", masing-masing lewat checkbox.
- Kalau diisi, otomatis masuk ke report Excel; kalau tidak, tetap kosong
  seperti sebelumnya (diisi manual).
- File: `backend/models.py`, `backend/schemas.py`, `backend/routers/runs.py`,
  `backend/routers/report.py`, `src/context/stage-context.tsx`,
  `src/components/stage/step-company-info.tsx`.

**Download ulang report + retensi file**
- Tombol Download per baris di halaman History.
- Server hanya menyimpan 2 file report TERBARU secara global (bukan per
  user/CID) — file lebih lama otomatis terhapus, tapi baris History-nya tetap
  ada dengan status "File sudah tidak tersedia".
- File: `backend/routers/report.py`, `backend/routers/history.py`,
  `src/lib/api.ts`, `src/components/stage/step-report.tsx`,
  `src/app/(app)/history/page.tsx`.

**Bug fix: Employee ID salah dianggap "Not Found"**
- Employee ID sekarang dibersihkan dulu (spasi, karakter tersembunyi, besar
  kecil huruf) sebelum dicocokkan antar dokumen.
- File: `backend/value_comparison.py`.

**Aturan baru: First Name / Last Name beda selalu perlu dicek manual**
- Kalau Employee ID sama tapi nama beda (apapun jenis bedanya), status selalu
  "Need Confirmation", tidak pernah "Changed" biasa.
- File: `backend/value_comparison.py`.

**Bug fix: daftar field standar mengikuti Reference Document yang diupload**
- Sebelumnya daftar "field standar" itu-itu saja (konstanta tetap di kode),
  tidak peduli isi Reference Document yang diupload user.
- Sekarang daftar field standar selalu dibaca ulang dari header kolom
  Reference Document yang diupload di proses analisis tersebut.
- File: `backend/column_matching.py`, `backend/routers/analysis.py`,
  `backend/routers/documents.py`, `backend/test_run.py`.

**Bug fix: checklist step 3b menampilkan data basi (stale) saat Reference Document diganti**
- Kalau user kembali ke step Upload Reference dan upload file lain (tanpa
  mulai proses baru dari Main Page), sebelumnya checklist field masih
  menampilkan sisa hasil pencocokan dari file yang lama.
- Sekarang setiap upload ulang New Document / Reference Document otomatis
  membersihkan hasil pencocokan lama, supaya step Analysis selalu mengambil
  data segar.
- File: `src/context/stage-context.tsx`.

### 2. Keputusan teknis penting

- **Field standar TIDAK BOLEH lagi berupa daftar tetap/hardcoded.** Sumber
  kebenarannya adalah header kolom Reference Document yang diupload user saat
  itu, dibaca ulang setiap proses baru. `template_A.xlsx` tetap ada di folder
  project untuk dokumentasi/dummy data, tapi kode saat runtime tidak boleh
  membaca file itu langsung.
- Perubahan skema database (`effective_date`, `transfer_type`,
  `file_available`, `report_generated_at` di tabel `analysis_runs`) dilakukan
  dengan `ALTER TABLE` manual (bukan lewat Alembic), sifatnya non-destruktif —
  data lama tidak hilang.
- Retensi file report bersifat GLOBAL (seluruh sistem, bukan per user/CID) —
  ini keputusan yang sudah dikonfirmasi sebelumnya di CLAUDE.md bagian 4a.
- Lapisan abstraksi pemanggilan AI (`call_ai()` di `ai_provider.py`) tetap
  dipertahankan apa adanya — mode mock hanya menyisipkan cabang kondisi
  sebelum prompt asli, bukan menghapus/mengubah kode Gemini yang sudah ada.
  Ini penting untuk rencana pindah ke Claude API nanti.

### 3. Status saat ini

- Semua revisi di atas sudah ditest manual (lewat API dan langsung di
  browser), pakai `USE_MOCK_AI=true` — tidak ada panggilan Gemini asli selama
  testing.
- Skenario yang sudah dibuktikan jalan: Employee ID dengan karakter
  tersembunyi sekarang match dengan benar; baris nama berbeda muncul "Need
  Confirmation"; field standar ikut berubah sesuai Reference Document yang
  diupload (termasuk kasus kolom tambahan dan kolom yang hilang); checklist
  step 3b tidak lagi basi saat Reference Document diganti ulang.
- Semua akun/data uji coba yang dibuat selama testing sudah dibersihkan.
- **Catatan yang perlu diperhatikan:** di lingkungan development ini, server
  backend (`uvicorn --reload`) kadang tidak benar-benar memuat kode terbaru
  walau log-nya bilang "Reloading" — kalau hasil test terasa aneh/tidak sesuai
  perubahan kode, matikan total proses backend dan nyalakan ulang dari nol
  sebelum curiga ada bug di kode.

### 4. Yang perlu diwaspadai untuk fitur baru "Structure Mapper"

- **Jangan bikin daftar field standar versi baru yang hardcoded lagi.**
  Kalau Structure Mapper juga butuh konsep "field standar/field mapping",
  sebaiknya menyambung ke sumber yang sama (header Reference Document yang
  diupload), bukan bikin daftar sendiri terpisah — supaya tidak ada dua
  sumber kebenaran yang beda untuk hal yang sama.
- **Fungsi `match_columns()` di `backend/column_matching.py` sekarang
  mewajibkan daftar field standar dikirim secara eksplisit** (tidak ada lagi
  nilai default tersembunyi). Kalau Structure Mapper mau memanggil fungsi ini
  atau fungsi sejenis, ikuti pola yang sama — jangan taruh daftar field
  sebagai konstanta default lagi.
- **Kalau Structure Mapper menambah langkah/upload baru di alur Stage**, ingat
  pola yang baru diperbaiki: setiap kali sebuah dokumen upload diganti, semua
  data hasil olahan sebelumnya yang tergantung ke dokumen itu (mapping,
  field standar, dll) harus ikut dikosongkan di `stage-context.tsx`. Supaya
  tidak muncul bug "data basi" yang serupa dengan yang baru diperbaiki.
- **Pola folder/endpoint yang konsisten dipakai:** endpoint backend baru
  ditaruh sebagai router terpisah di `backend/routers/<nama>.py`, lalu
  didaftarkan di `main.py`. Sebaiknya Structure Mapper mengikuti pola yang
  sama supaya konsisten dengan endpoint yang sudah ada (`documents`,
  `analysis`, `report`, `history`).
- Perubahan skema database sejauh ini dilakukan manual lewat `ALTER TABLE`
  (bukan Alembic). Kalau Structure Mapper butuh tabel/kolom baru, ikuti cara
  yang sama (non-destruktif, tidak menghapus data lama) — atau kalau mau
  mulai pakai Alembic, itu perubahan tooling yang harus dikonfirmasi ke user
  dulu.

---

## 2026-07-28 (lanjutan) — Structure Mapper Fase A (UI, data dummy)

### 1. Yang dikerjakan

Membangun UI/UX flow Structure Mapper (khusus Job Position; tombol
Organization tampil tapi belum difungsikan) memakai data dummy sepenuhnya —
belum ada panggilan AI atau backend beneran, sesuai STRUCTURE-MAPPER-SPEC.md
bagian 8 (Fase A).

**File baru dibuat:**
- `src/context/structure-mapper-context.tsx` — context terpisah dari
  `stage-context.tsx`, menyimpan step (`select-type`, `mapping-preview`,
  `upload-template`, `comparison-report`) beserta data dummy per step.
- `src/components/structure-mapper/step-select-type.tsx` — 2 tombol bulat
  (Organization dinonaktifkan dengan label "Segera Hadir"; Job Position
  membuka popup).
- `src/components/structure-mapper/job-position-upload-sheet.tsx` — popup
  form (CID, Company Name, upload PDF/JPG/JPEG/PNG) pakai `Sheet` primitive
  dari `src/components/ui/sheet.tsx` — ini pemakaian pertama komponen Sheet
  di project ini.
- `src/components/structure-mapper/step-mapping-preview.tsx` — tabel
  preview hasil mapping dummy + tombol export (dummy/disabled) + Done/Analyze.
- `src/components/structure-mapper/step-upload-template.tsx` — upload
  template pembanding (dummy).
- `src/components/structure-mapper/step-comparison-report.tsx` — checklist
  dipakai/tidak dipakai per Job Position (pola checkbox grid dari
  `step-analysis.tsx`), user bisa override manual, lalu tombol Selesai.
- `src/app/(app)/structure-mapper/page.tsx` — route baru, render step secara
  kondisional (pola sama seperti `src/app/(app)/stage/page.tsx`).

**File yang diubah:**
- `src/components/layout/sidebar.tsx` — tambah 1 entry nav "Structure
  Mapper" di antara Dashboard dan Stage.
- `src/app/layout.tsx` — tambah `StructureMapperProvider` (dibungkus di
  dalam `StageProvider` yang sudah ada, tidak menggantikan).
- `.claude/launch.json` — tambah 1 konfigurasi dev server tambahan di port
  3001 (`talenta-mapping-dev-alt`) untuk kebutuhan testing di sesi ini saat
  port 3000 sedang dipakai sesi lain. Tidak mengubah konfigurasi port 3000
  yang sudah ada.

**Flow yang sudah bisa dites (data dummy):**
Klik Structure Mapper → 2 tombol bulat → Job Position → isi CID/Company
Name/upload dokumen → tabel preview dummy (8 Job Position contoh) → Done
(reset ke awal) atau Analyze → upload template pembanding (dummy) →
laporan perbandingan dengan checklist dipakai/tidak dipakai → Selesai
(reset ke awal).

### 2. Konfirmasi: flow utama (Stage) tidak tersentuh

Tidak ada file di `src/components/stage/`, `src/context/stage-context.tsx`,
`src/app/(app)/stage/`, atau backend yang diubah. `CLAUDE.md` juga tidak
diedit.

### 3. Keputusan/pola yang diikuti

- Reset data lama sebelum data baru ditampilkan: `submitJobPositionUpload()`
  dan `submitComparisonTemplate()` di `structure-mapper-context.tsx` selalu
  meng-overwrite total `mappingRows`/`comparisonRows` (bukan menambah),
  meniru pola yang sama seperti fix "data basi" di `stage-context.tsx`. Sudah
  ditest manual: upload ulang dengan CID/file berbeda menampilkan data yang
  sepenuhnya baru, tanpa sisa data lama.
- TODO eksplisit ditulis di `structure-mapper-context.tsx` (bagian atas
  file): dialog konfirmasi "keluar dari flow" saat user pindah ke menu lain
  di tengah proses belum dibuat — sengaja ditunda ke Fase C sesuai arahan.

### 4. Status testing

- `npm run lint` dan `npm run build` sukses tanpa error.
- Flow lengkap (2 tombol bulat → popup → tabel preview → analyze → upload
  template → laporan perbandingan → selesai) sudah dites end-to-end di
  browser, termasuk skenario upload ulang dengan CID/file berbeda (data
  lama tidak nyangkut) dan toggle checkbox manual di laporan perbandingan.
- **Catatan keterbatasan environment:** screenshot visual tidak bisa
  diambil di sesi ini karena tab browser yang dipakai berjalan dalam
  keadaan "hidden/background" (`document.hidden === true`) — perilaku
  standar browser yang menahan animasi (`requestAnimationFrame`) di tab
  yang tidak aktif tampil. Ini terlihat jelas menghambat animasi keluar
  (exit transition) dari komponen Sheet, tapi bukan bug di kode — hanya
  membuat screenshot & pengecekan animasi tidak bisa 100% divisualkan di
  sesi ini. Semua verifikasi fungsional (buka/tutup popup, isi form,
  submit, validasi, reset data) sudah dicek lewat pembacaan struktur
  halaman dan pengecekan state langsung, bukan cuma lewat visual. User
  disarankan buka halaman `/structure-mapper` sendiri sebentar untuk
  konfirmasi visual popup Sheet terlihat dan animasinya halus.

---

## 2026-07-28 (lanjutan 2) — Structure Mapper Fase B (script terpisah, BELUM final)

### 1. Status: menunggu konfirmasi user

Fase B **belum ditandai selesai**. Script ekstraksi struktur sudah dibuat dan
lolos test dengan data dummy (mode `USE_MOCK_AI=true`), tapi **belum pernah
dites dengan gambar/PDF bagan struktur asli**. Menunggu user menjalankan
sendiri dengan 2-3 contoh bagan asli sebelum fase ini dianggap tuntas.

### 2. Yang dikerjakan

Implementasi logic AI ekstraksi struktur dari gambar/PDF (jawaban Open Item
#1 di STRUCTURE-MAPPER-SPEC.md bagian 6), sebagai **script berdiri sendiri**
- belum disambung ke endpoint/UI apapun (itu bagian Fase C).

**File diubah:**
- `backend/ai_provider.py` — retry-loop internal direfactor jadi 1 helper
  `_generate_with_retry()` supaya dipakai bersama oleh `call_ai()` (teks,
  sudah ada) dan fungsi baru `call_ai_vision()` (teks + gambar/PDF,
  multimodal). `call_ai()` tidak berubah perilakunya - dites ulang lewat
  `test_run.py` (flow utama) dan hasil Tahap 1 (Column Matching) identik
  seperti sebelumnya. Tidak ada setup API/client baru dibuat - client Gemini
  dan flag `USE_MOCK_AI` yang sudah ada di-reuse sepenuhnya.

**File baru:**
- `backend/structure_extraction.py` — logic inti: baca gambar/PDF, AI
  mendeteksi kotak (job title + opsional nama) dan garis penghubung,
  tentukan parent-child (kotak yang ditarik garis ke atas = parent), pakai
  ID internal sementara (dibuat AI sendiri, tidak pernah diekspos) untuk
  menyambungkan relasi, lalu diterjemahkan jadi nama Job Title di kolom
  `parent` hasil akhir. Kotak dengan 2+ garis ke atas (multi-parent/
  dotted-line) DAN kotak yang tidak terbaca dengan yakin ditandai status
  `failed_multi_parent` / `failed_unreadable` (bukan ditebak, bukan
  dibuang). Toggle nama (`include_names`) memaksa field `name` selalu
  kosong kalau dimatikan, apapun yang "terlihat" oleh AI di gambar.
  Termasuk mode mock (`_mock_extract_boxes`) yang mengikuti pola
  `[MOCK] ...` yang sudah dipakai di `column_matching.py`, dengan 1 contoh
  kasus multi-parent supaya alur "perlu manual" ikut kelihatan saat test
  tanpa Gemini asli.
- `backend/structure_extraction_test_run.py` — script CLI (`argparse`):
  `python structure_extraction_test_run.py <file> [--with-names]`. Cetak
  tabel hasil ke terminal (pola sama seperti `test_run.py`) + simpan JSON
  ke `backend/structure_extraction_result.json`.

**Tidak disentuh:** flow Stage utama, UI Structure Mapper Fase A, database,
endpoint/router manapun, `CLAUDE.md`.

### 3. Testing yang sudah dilakukan (mode mock saja)

- `USE_MOCK_AI=true`, dijalankan dengan file PNG placeholder (bukan gambar
  bagan asli - cuma untuk memastikan alur kode jalan tanpa error): hasil
  tabel tampil benar dengan/tanpa `--with-names`, baris multi-parent
  tertandai `failed_multi_parent` dengan note yang jelas, file JSON hasil
  tersimpan.
- Error handling: format file tak didukung (`.txt`) dan file tidak
  ditemukan menghasilkan pesan error bersih (bukan traceback panjang).
- Sanity check flow utama: `test_run.py` (existing) dijalankan ulang
  setelah refactor `ai_provider.py` - Tahap 1 (Column Matching) identik
  seperti sebelumnya. Tahap 2 gagal print karena `UnicodeEncodeError` di
  terminal Windows (karakter zero-width-space di data dummy testing yang
  memang sudah ada sebelumnya untuk kasus normalisasi Employee ID) - ini
  masalah encoding console, bukan regresi dari perubahan Fase B ini.

### 4. Yang BELUM dites (menunggu user)

- Belum pernah memanggil Gemini asli (`USE_MOCK_AI=false`) dengan gambar/PDF
  bagan struktur organisasi/jabatan sungguhan. Akurasi pembacaan kotak,
  garis, dan deteksi kasus multi-parent/buram baru bisa dikonfirmasi setelah
  user mencoba dengan 2-3 contoh bagan asli.

---

## 2026-07-28 (lanjutan 3) — Structure Mapper Fase A: revisi kolom report + progress bar navigasi

Revisi ini menindaklanjuti STRUCTURE-MAPPER-SPEC.md bagian 3.8 (navigasi
antar-step) dan pembaruan Open Item #1 (nama kolom `Job Position` /
`Parent Job Position` / `Name`, menggantikan draft awal yang salah pakai
`Job Title`/Department/Level).

### 1. Perbaikan kolom Report Mapping

- `JobPositionMappingRow` di `structure-mapper-context.tsx`: field
  `department`/`level` dihapus, diganti `parentJobPosition: string | null`
  dan `name: string | null`.
- Data dummy (`DUMMY_MAPPING_ROWS`) ditulis ulang jadi hierarki eksplisit:
  CEO (parent null) → CFO & CHRO (parent CEO) → Finance/HR Manager (parent
  CFO/CHRO) → Finance/HR Staff (parent manager masing-masing), plus IT
  Manager langsung di bawah CEO.
- `step-mapping-preview.tsx`: tabel sekarang kolom Job Position / Parent
  Job Position / Name, dengan checkbox "Tampilkan kolom Name" (state lokal
  komponen, default aktif) untuk sembunyikan/tampilkan kolom Name saja -
  tidak memengaruhi data yang tersimpan di context.
- `step-comparison-report.tsx`: subtitle di bawah nama posisi diganti dari
  `department` jadi `Parent: {parentJobPosition}`.

### 2. Progress bar navigasi antar-step

- File baru `src/components/structure-mapper/stepper.tsx` -
  `StructureMapperStepper`, meniru persis styling/pola
  `src/components/stage/stepper.tsx` (lingkaran bernomor, centang untuk
  step selesai, garis penghubung, disabled untuk step yang belum
  terjangkau).
- Context (`structure-mapper-context.tsx`) dapat tambahan:
  `STRUCTURE_MAPPER_STEPS` (daftar step + label), `maxStepReached: number`,
  dan fungsi `goToStep(nomor)` (hanya berhasil kalau
  `nomor <= maxStepReached`, pola identik `stage-context.tsx`).
- `structure-mapper/page.tsx` sekarang selalu menampilkan heading + stepper
  di semua step (termasuk "Pilih Tipe"), meniru pola halaman Stage.
  `step-select-type.tsx` disederhanakan (heading duplikat "Structure
  Mapper" dihapus karena sudah ada di level halaman).
- Fungsi `backToSelectType` (sudah tidak dipakai di manapun sejak Fase A)
  dihapus, digantikan `goToStep`.

### 3. Aturan reset saat mundur+ubah input

- `submitJobPositionUpload()` - selain mengosongkan `templateFileName` dan
  `comparisonRows` seperti sebelumnya (pola Fase A) - sekarang juga
  menurunkan `maxStepReached` balik ke `2`. Jadi kalau user klik progress
  bar mundur ke "Pilih Tipe", ganti CID/Company Name/file, lalu submit
  ulang: data Report Mapping berganti total (bukan nyangkut), dan step
  "Upload Template"/"Report Perbandingan" di progress bar kembali
  ter-kunci (tidak bisa diklik langsung) sampai user mengulang step
  tersebut dari awal. ini perluasan langsung dari fungsi reset yang sudah
  ada, bukan logic terpisah.

### 4. Testing yang sudah dilakukan

- `npm run lint` dan `npm run build` sukses tanpa error.
- Manual end-to-end di browser: isi Job Position → tabel Report Mapping
  tampil dengan kolom baru & hierarki dummy yang benar → toggle "Tampilkan
  kolom Name" bekerja (kolom hilang/muncul) → Analyze → upload template →
  Report Perbandingan tampil dengan "Parent: ..." yang benar.
- Skenario reset (skenario yang diminta user secara eksplisit): dari
  Report Perbandingan (step 4, `maxStepReached=4`, semua step bisa
  diklik), klik progress bar mundur ke step 1, submit ulang popup Job
  Position dengan CID/Company Name/file BERBEDA → dikonfirmasi lewat
  pengecekan state langsung: tabel Report Mapping terisi data baru
  (CID-002-GANTI / PT Kedua Berbeda / struktur-v2-baru.png), dan tombol
  step 3 & 4 di progress bar kembali `disabled=true` (step 1 & 2 tetap
  bisa diklik). Reset & retract bekerja seperti yang diminta.

### 5. Catatan keterbatasan environment (masih sama seperti sesi Fase A)

- Screenshot visual tetap tidak bisa diambil di sesi ini - tab browser
  yang dipakai masih berjalan dalam keadaan hidden/background
  (`document.hidden === true`), sama seperti kendala di sesi Fase A
  sebelumnya. Semua verifikasi di atas dilakukan lewat pembacaan struktur
  halaman (`get_page_text`) dan pengecekan properti DOM langsung
  (`disabled`, dsb), bukan lewat visual. User disarankan buka
  `/structure-mapper` sendiri untuk konfirmasi visual progress bar &
  tabel kolom baru.

**Tidak disentuh:** flow Stage utama, `CLAUDE.md`, backend/database.

---

## 2026-08-04 — Fase B revisi: pisahkan kasus solid-line ambigu vs dotted-line

Update ke `backend/structure_extraction.py` (script standalone, masih
belum disambung ke aplikasi) mengikuti keputusan baru di
`STRUCTURE-MAPPER-SPEC.md` bagian 6 Open Item #1, fallback (a) dan (b):
sebelumnya kedua kasus ini digabung jadi satu status
(`failed_multi_parent`, selalu flag manual). Sekarang dipisah jadi dua
penanganan berbeda.

### 1. Perubahan logic

- `BoxStatus` sekarang: `"ok"`, `"ambiguous_solid_merge"` (baru),
  `"dotted_line_multi_parent"` (rename dari `failed_multi_parent`),
  `"failed_unreadable"`.
- **Kasus (a) - garis solid menyatu ambigu antara 2+ kotak atasan:**
  `ExtractedBox` dapat field baru `ambiguous_parent_box_ids` (list box_id
  kandidat parent, urut visual kiri-ke-kanan). Di `_translate_boxes()`,
  kasus ini TIDAK di-flag manual - malah diduplikasi jadi N baris (N =
  jumlah kandidat parent), masing-masing diberi akhiran angka urut
  ("Business Unit Manager 1", "Business Unit Manager 2", dst mengikuti
  urutan kiri-ke-kanan parent-nya). Name yang sama dipakai di semua
  duplikat. Tiap baris duplikat dapat catatan (`note`) yang menjelaskan
  ambiguitas & auto-duplikasi, supaya user aware dan bisa gabung/koreksi
  manual. Referensi ke box_id asli disimpan di field
  `source_box_id_internal` pada `StructureRow` - field ini SENGAJA
  disembunyikan dari tabel yang dicetak ke user di `test_run.py` (masih
  ada di JSON debug penuh), sesuai instruksi "tidak perlu ditampilkan ke
  user".
  - Ada fallback aman: kalau AI cuma kasih < 2 kandidat parent, atau ada
    box_id yang tidak ditemukan, baris TIDAK dipaksakan diduplikasi -
    balik ke flag manual biasa (`failed_unreadable`) supaya tidak salah
    duplikasi dari data yang tidak konsisten.
- **Kasus (b) - garis putus-putus (dotted-line):** tetap flag manual
  seperti sebelumnya, cuma ganti nama status jadi
  `dotted_line_multi_parent` supaya jelas beda dari kasus (a). Perilaku
  tidak berubah (tidak diduplikasi).
- `_build_prompt()` ditulis ulang supaya AI (Gemini asli, bukan mock)
  membedakan instruksi kedua kasus ini secara eksplisit, termasuk
  instruksi urutan kiri-ke-kanan untuk `ambiguous_parent_box_ids`.

### 2. Testing yang sudah dilakukan (mode mock - USE_MOCK_AI=true)

**Kendala:** user memberi 2 contoh gambar bagan asli lewat chat (bukan
file di disk), sehingga tidak bisa disimpan/dibaca sebagai file oleh
Claude Code untuk dikirim ke Gemini API asli. Sebagai gantinya, dibuat 2
skenario mock yang meniru PERSIS kedua gambar tsb (posisi kotak & garis
sama), dipilih otomatis berdasarkan nama file yang diberikan ke
`structure_extraction_test_run.py` (`org-chart-1*` → skenario (a),
`org-chart-2*` → skenario (b)) - murni untuk keperluan demo logic,
BUKAN hasil bacaan AI asli terhadap gambar tsb.

- **org-chart-1.png (kasus a - solid-line ambigu, meniru bagan Direktur
  Operasional & Marketing → Direktur BBM,Pelumas&Kimia / Direktur LPG →
  Business Unit Manager):** hasil 5 baris - 3 baris "ok" normal, lalu
  "Business Unit Manager" otomatis terpecah jadi:
  - **"Business Unit Manager 1"** - parent: "Direktur BBM, Pelumas &
    Kimia" (kotak kiri)
  - **"Business Unit Manager 2"** - parent: "Direktur LPG" (kotak kanan)
  - Keduanya dapat catatan yang sama, isinya:
    *"Posisi "Business Unit Manager" terdeteksi ambigu - garis solid
    menyatu di antara 2 kotak atasan (Direktur BBM, Pelumas & Kimia,
    Direktur LPG). Sistem otomatis membuat 2 baris terpisah di bawah ini
    (satu per kemungkinan parent). Mohon cek dan gabungkan/hapus salah
    satu manual kalau ternyata cuma 1 yang benar."*
  - Status kedua baris: `ambiguous_solid_merge` (bukan "gagal") - Total:
    Berhasil 3, Duplikat 2, Perlu dicek manual 0.
- **org-chart-2.png (kasus b - dotted-line, meniru bagan HRS & LGA
  Supervisor → HR & Legal/HSE & GA/Maintenance Officer → garis
  putus-putus ke Courier/OB-OG/Security):** hasil 7 baris - 4 baris "ok"
  normal (Supervisor + 3 Officer), lalu Courier/OB-OG/Security masing-masing
  ditandai `dotted_line_multi_parent` (BUKAN diduplikasi), dengan catatan
  contoh: *"Kotak ini terhubung lewat garis putus-putus (indirect
  reporting) di bawah baris "HR & Legal Officer" / "HSE & GA Officer" /
  "Maintenance Officer" - notasi disengaja, bukan ambiguitas visual,
  tidak ditebak/diduplikasi, perlu dicek manual."* - Total: Berhasil 4,
  Duplikat 0, Perlu dicek manual 3.
- Skenario umum lama (nama file lain, mis. `contoh_bagan_lain.png`) dites
  ulang untuk pastikan tidak rusak - masih menghasilkan 6 baris seperti
  sebelumnya (CEO/CFO/CHRO/Finance Manager/HR Manager + 1 baris dotted-line
  "Business Partner").
- `python -m py_compile` pada kedua file sukses (tidak ada syntax error).
- File placeholder gambar & JSON hasil test sudah dihapus lagi setelah
  verifikasi (tidak disisakan sampah di repo).

**Tidak disentuh:** flow Stage utama, UI Structure Mapper Fase A,
`CLAUDE.md`, backend/database, endpoint aplikasi (script ini masih
standalone, belum disambung ke Fase C).

---

## 2026-08-04 — Fase B: testing dengan Gemini API asli (bukan mock)

User memberikan file gambar bagan asli (`backend/test-assets/org-chart-1.png`,
1006x513 PNG - kasus solid-line ambigu; `org-chart-2.png`, 399x434 PNG -
kasus dotted-line). Dites langsung ke Gemini asli (`USE_MOCK_AI=false`,
tanpa mengubah `.env` - dioverride lewat env var sesaat), masing-masing
2x untuk cek konsistensi (bukan cuma sekali jalan, mengingat sifat AI yang
bisa bervariasi antar panggilan). Waktu respons real (~15-25 detik per
panggilan) dikonfirmasi bukan hasil mode mock (mock instan/<1 detik).

### 1. Percobaan pertama (prompt versi awal Fase B revisi) - hasil campuran

- **org-chart-1 (solid-line ambigu): ✅ BENAR, konsisten 2x.** "Business Unit
  Manager" terpecah otomatis jadi "Business Unit Manager 1" (parent:
  Direktur BBM, Pelumas & Kimia - kiri) dan "Business Unit Manager 2"
  (parent: Direktur LPG - kanan). Urutan kiri-ke-kanan tepat sesuai posisi
  visual di gambar asli.
- **org-chart-2 (dotted-line): ❌ SALAH, konsisten 2x (bukan kebetulan).**
  Gemini tidak mendeteksi garis putus-putus sama sekali - Courier, OB/OG,
  Security semua dianggap tersambung garis SOLID langsung ke "HRS & LGA
  Supervisor" (bahkan melompati level Officer di tengah). Status semua
  "ok", parent terisi (harusnya null + flag manual).

### 2. Dugaan akar masalah & perbaikan prompt

Dugaan: instruksi kasus (b) di prompt versi awal cuma dijelaskan untuk
skenario "garis putus-putus ke 2+ kotak sekaligus" (mengikuti bahasa di
spec awal, "lapor ke 2+ atasan"). Di gambar asli, kemungkinan tiap kotak
(Courier/OB-OG/Security) cuma punya SATU garis putus-putus ke atas - jadi
tidak match kriteria yang ditulis, dan Gemini jatuh ke default/tebakan
salah karena tidak ada instruksi lain yang cocok.

Perbaikan di `_build_prompt()` (`backend/structure_extraction.py`):
- Ditambah langkah eksplisit "periksa GAYA GARIS dulu sebelum menentukan
  parent" sebagai instruksi terpisah, dengan penjelasan konkret ciri
  garis solid vs putus-putus/dashed, dan reminder untuk teliti di bagian
  gambar yang kualitasnya kurang tajam.
- Kasus (b) ditulis ulang: berlaku SAMA PERSIS baik terhubung dotted ke
  SATU kotak maupun 2+ kotak - jumlah kotak tidak menentukan, gaya garis
  (putus-putus vs solid) yang menentukan. Ini mengoreksi kesalahan framing
  "2+ kotak" di versi sebelumnya.

### 3. Percobaan kedua (setelah prompt diperkuat) - hasil

- **org-chart-2 (dotted-line): ✅ BENAR, konsisten 2x setelah perbaikan.**
  Courier, OB/OG, Security semua benar ditandai `dotted_line_multi_parent`,
  parent null, tidak diduplikasi, dengan note yang menyebut garis
  putus-putus terdeteksi (detail kotak mana persis yang disebut di note
  sedikit bervariasi antar 2x jalan - contoh run 1: "...ke HR & Legal
  Officer", run 2: "...ke HSE & GA Officer dan garis solid ke HRS & LGA
  Supervisor" - wajar untuk output teks bebas AI, yang penting STATUS &
  PARENT-nya konsisten benar di kedua run).
- **org-chart-1 (solid-line ambigu): ✅ Tetap benar,** tidak regresi akibat
  perubahan prompt (dites ulang, hasil identik dengan percobaan pertama).

### 4. Kesimpulan & catatan untuk Fase C nanti

- Fase B - Open Item #1 (kasus a & b) **dikonfirmasi bekerja dengan Gemini
  API asli**, bukan cuma mode mock, untuk kedua contoh gambar yang
  diberikan user.
- File gambar asli (`test-assets/org-chart-1.png`, `org-chart-2.png`) dan
  file hasil JSON tetap disimpan di `backend/test-assets/` (yang JSON debug
  dihapus lagi tiap selesai run, sesuai kebiasaan sebelumnya) - kalau perlu
  dites ulang di kemudian hari.
- **Catatan risiko untuk dibawa ke Fase C:** karena LLM punya variasi
  antar panggilan (terlihat dari detail note yang sedikit berbeda antar
  run walau kesimpulan akhirnya sama), sebaiknya nanti dipertimbangkan
  apakah perlu semacam "double-check pass" otomatis untuk kasus-kasus
  yang statusnya bukan "ok" sebelum ditampilkan final ke user, atau cukup
  mengandalkan review manual user di halaman Resume/Report seperti yang
  sudah didesain. Belum diputuskan - didiskusikan lagi kalau relevan.

**Tidak disentuh:** flow Stage utama, UI Structure Mapper Fase A,
`CLAUDE.md`, backend/database, endpoint aplikasi (script ini masih
standalone, belum disambung ke Fase C).

---

## 2026-08-04 — Fase C: Backend integrasi Structure Mapper (step 3.2-3.4 saja)

Step 3.2 (upload) sampai 3.4 (report mapping) sekarang **REAL** - disambung
ke backend & database sungguhan. Step 3.5 ke bawah (Done/Analyze, upload
template pembanding, report perbandingan) **TETAP DUMMY**, belum disentuh -
menunggu Fase D/E (Open Item #2 di STRUCTURE-MAPPER-SPEC.md belum terjawab).

### 1. Database (tabel baru, bukan ALTER TABLE)

Karena ini tabel BARU (bukan nambah kolom ke tabel lama), otomatis dibuat
lewat `Base.metadata.create_all()` yang sudah ada di `main.py` - non-destruktif
secara alami, tidak perlu ALTER TABLE manual (beda dari perubahan skema
`analysis_runs` sebelumnya).

- `structure_mapper_sessions` - id, user_id (FK), type ("job_position"),
  cid, company_name, source_filename, source_file_path, include_names,
  created_at.
- `structure_mapper_rows` - id, session_id (FK), job_position,
  parent_job_position (nullable), name (nullable), status ("ok" |
  "duplicated" | "needs_manual"), note (nullable), source_box_id_internal
  (nullable - token pengelompokan baris duplikat, BUKAN foreign key,
  lihat poin 3 di bawah).
- **Tiap submit popup upload = SESI BARU** (row baru, bukan overwrite) -
  histori tetap ada di DB walau tampilan frontend "reset" ke data terbaru.
  Dikonfirmasi lewat testing (lihat bagian 4).

### 2. Endpoint baru (`backend/routers/structure_mapper.py`)

- `POST /structure-mapper/job-position/upload` - terima CID, Company Name,
  file (Form multipart). Validasi format PDF/JPG/JPEG/PNG pakai ulang
  `guess_mime_type()` dari `structure_extraction.py` (Fase B) - TIDAK
  menyentuh validator `.xlsx/.csv` di `routers/documents.py`. Memanggil
  `extract_structure()` dari Fase B apa adanya (tidak ditulis ulang),
  simpan sesi + baris ke DB, kembalikan hasil.
- `GET /structure-mapper/job-position/{session_id}/export` - generate Excel
  on-the-fly (di memori pakai `io.BytesIO`, langsung di-stream lewat
  `StreamingResponse` - TIDAK disimpan permanen di server, TIDAK pakai
  aturan retensi "2 file terbaru" seperti `routers/report.py`, karena itu
  aturan khusus flow utama yang tidak diminta di sini). Kolom: Job
  Position, Parent Job Position, Name, Status, Note.
- Terjemahan status: 4 status internal Fase B (`ok`,
  `ambiguous_solid_merge`, `dotted_line_multi_parent`,
  `failed_unreadable`) disederhanakan jadi 3 status DB/API/UI (`ok`,
  `duplicated`, `needs_manual`) - lihat `_STATUS_MAP` di router ini.
- `main.py` diupdate: import & `app.include_router(structure_mapper.router)`.
- `schemas.py` ditambah `StructureMapperRowOut`, `StructureMapperUploadResponse`.

### 3. Tiga keputusan desain yang tidak eksplisit di spec (dikonfirmasi ke user sebelum coding)

1. **Kolom Name**: backend SELALU kirim `include_names=True` ke AI (belum
   ada UI baru di popup upload untuk mematikan ini) - toggle "Tampilkan
   kolom Name" di frontend murni show/hide tampilan atas data yang sudah
   kembali dari API, bukan penentu apakah AI baca nama atau tidak.
2. **Export Excel**: on-the-fly, tidak ada penyimpanan permanen/retensi di
   server (beda dari flow utama) - "cukup functional dulu" sesuai arahan.
3. **Referensi baris duplikat**: disimpan sebagai token pengelompokan
   string (`source_box_id_internal`, sama persis dengan box_id internal
   Fase B) - BUKAN foreign key formal ke "1 baris asli", karena kotak
   ambigu aslinya tidak pernah jadi 1 baris tunggal (langsung pecah jadi
   2+ baris begitu terdeteksi ambigu).

### 4. Frontend yang disambungkan

- `src/lib/api.ts` - fungsi baru `uploadJobPositionStructure()` (POST
  multipart) dan `downloadJobPositionExport()` (GET blob, pola sama
  seperti `downloadReport()` di flow utama).
- `src/context/structure-mapper-context.tsx` - `submitJobPositionUpload()`
  (yang generate dummy) diganti jadi `applyJobPositionUploadResult()` (cuma
  menerapkan hasil API ke state - fetch/loading/error-nya ditangani di
  komponen, bukan di context). State baru `sessionId` ditambahkan (dipakai
  tombol Export). Fungsi dummy `buildDummyMappingRows()` dihapus, diganti
  `mapUploadResponseToRows()`.
- `job-position-upload-sheet.tsx` - submit sekarang manggil
  `uploadJobPositionStructure()` beneran. Loading state: sheet TIDAK
  langsung tertutup seperti versi dummy - tetap terbuka dengan spinner +
  teks "Menganalisa dokumen dengan AI, mohon tunggu..." selama proses
  (bisa ~15-30 detik untuk Gemini asli), field & tombol disabled, sheet
  tidak bisa ditutup lewat Escape/klik-luar selagi loading. Error dari API
  ditampilkan sebagai teks merah di dalam sheet (tidak silent fail, sheet
  tetap terbuka supaya user bisa coba lagi).
- `step-mapping-preview.tsx` - kolom tabel dapat tambahan "Status": badge
  "Terduplikasi Otomatis" (variant `secondary`) untuk status `duplicated`,
  badge "Perlu Dicek Manual" (variant `destructive`) untuk `needs_manual`,
  plus teks catatan (`note`) ditampilkan di bawah badge. Tombol Export
  Excel (sebelumnya disabled dummy) disambungkan ke
  `downloadJobPositionExport()` beneran, dengan loading spinner + error
  message kalau gagal.

### 5. Testing yang sudah dilakukan (SEMUA pakai Gemini API asli, USE_MOCK_AI=false sementara - atas permintaan eksplisit user "pakai API Gemini aja")

- `npm run lint` dan `npm run build` sukses tanpa error.
- **End-to-end lewat halaman asli** (login beneran dapat token, navigasi ke
  `/structure-mapper`, isi popup, submit, tunggu AI, lihat hasil) - untuk
  KEDUA gambar contoh (`org-chart-1.png`, `org-chart-2.png` dari
  `backend/test-assets/`, diakses browser lewat folder `public/` sementara
  yang dihapus lagi setelah testing selesai):
  - **org-chart-1 (solid-line ambigu):** tampil benar - "Business Unit
    Manager 1"/"2" dengan badge "Terduplikasi Otomatis" dan catatan yang
    sesuai.
  - **org-chart-2 (dotted-line):** tampil benar - Courier/OB-OG/Security
    dengan badge "Perlu Dicek Manual" dan catatan yang sesuai (TIDAK
    diduplikasi).
- **Verifikasi langsung ke database** (`docker exec ... psql`): sesi
  org-chart-1 (id=1) punya 3 baris "ok" + 2 baris "duplicated" (keduanya
  share `source_box_id_internal="B4"` - dikonfirmasi token pengelompokan
  bekerja); sesi org-chart-2 (id=2) punya 4 baris "ok" + 3 baris
  "needs_manual".
- **Test reset**: dari Report Mapping org-chart-1, klik progress bar
  mundur ke step 1, submit ulang dengan CID/Company Name/file BERBEDA
  (org-chart-2) - dikonfirmasi: (a) tampilan berganti total ke data
  org-chart-2, (b) tombol step 3 & 4 di progress bar kembali `disabled`,
  (c) **sesi org-chart-1 TETAP ada di database** (query di atas
  menunjukkan 2 sesi, bukan 1) - sesuai klarifikasi "reset = tampilan
  saja, bukan hapus data DB".
- **Test download Excel**: tombol Export diklik dari UI (network request
  dikonfirmasi 200 OK), lalu file diambil ulang langsung lewat `curl` +
  dibuka dengan `openpyxl` untuk verifikasi isi - kolom benar (Job
  Position, Parent Job Position, Name, Status, Note), data & catatan
  duplikasi tampil lengkap di file.
- **Flow Stage dipastikan tidak terganggu**: halaman `/stage` dicek
  langsung (render normal, step "Input Company Info" tampil seperti
  biasa), endpoint `/history` dites tetap mengembalikan 200 OK.
- Setelah testing selesai, backend dikembalikan ke mode mock
  (`USE_MOCK_AI=true`, sesuai `.env` default) untuk pemakaian normal
  selanjutnya - supaya tidak boros kuota Gemini di luar sesi testing ini.

### 6. Belum dikerjakan (sesuai batasan scope eksplisit)

- Step 3.5-3.7 (Analyze/Done, upload template pembanding, report
  perbandingan) tetap dummy - menunggu Open Item #2 & Fase D/E.
- Belum ada UI untuk mematikan pembacaan nama (`include_names`) - lihat
  keputusan #1 di atas.
- Belum ada History khusus Structure Mapper di halaman History (yang ada
  cuma tabel DB-nya) - kalau nanti user mau lihat/download ulang sesi lama
  dari History, itu kerjaan tambahan terpisah.

**Tidak disentuh:** flow Stage utama, `CLAUDE.md`, validator upload
`.xlsx/.csv` di flow utama.

---

## 2026-08-04 (lanjutan) — Structure Mapper: toggle "Ignore Unsolid Line"

Tambahan kecil di atas Fase C yang sudah ada (lihat entry Fase C di atas
untuk konteks lengkap). Lihat juga `STRUCTURE-MAPPER-SPEC.md` bagian 6 Open
Item #1 untuk spesifikasi lengkap toggle ini.

### 1. Yang dibuat

- Checkbox baru **"Ignore Unsolid Line"** di popup upload Job Position
  (`job-position-upload-sheet.tsx`), di bawah kotak upload file. Default
  **tidak dicentang**. Ada teks penjelas singkat di bawahnya untuk user
  non-teknis.
- `structure_extraction.py`: `extract_structure()` dan `_translate_boxes()`
  dapat parameter baru `ignore_unsolid_line`. Kalau `True`, box yang
  sebelumnya kena flag "perlu dicek manual" karena garis putus-putus (kasus
  b) berubah jadi status "ok" tanpa catatan, dan kolom Parent-nya diisi
  literal **"Unmapped"** (bukan kosong/"-") supaya tidak tertukar dengan
  posisi root asli yang memang sah tidak punya atasan. Kasus (a) solid-line
  ambigu dan kasus (c) gambar buram **tidak disentuh sama sekali** oleh
  toggle ini.
- `backend/models.py`: kolom baru `ignore_unsolid_line` (boolean, default
  `False`) di tabel `structure_mapper_sessions`, ditambah lewat
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... DEFAULT FALSE` manual (non-
  destruktif - data sesi lama otomatis dapat nilai `False`).
- Router (`routers/structure_mapper.py`) dan `api.ts` diteruskan supaya
  status toggle ini ikut terkirim dari form upload sampai ke logic AI &
  tersimpan di database per sesi.
- `structure_extraction_test_run.py` (CLI test tool Fase B) dapat flag baru
  `--ignore-unsolid-line` untuk memudahkan testing manual ke depannya.

### 2. Hasil testing (dilaporkan apa adanya)

- **CLI, Gemini API asli (bukan mock), `org-chart-2.png`** (contoh kasus
  dotted-line dari user):
  - Toggle **mati** (default): Courier, OB/OG, Security tetap muncul
    sebagai "perlu dicek manual" - **persis sama** seperti hasil testing
    sebelumnya, tidak ada perubahan/regresi.
  - Toggle **aktif**: ketiga posisi tsb berubah jadi status "ok", kolom
    Parent Job Position terisi **"Unmapped"**, tanpa catatan tambahan -
    sesuai yang diminta.
- **Non-regresi kasus (a)**: `org-chart-1.png` (kasus solid-line ambigu,
  "Business Unit Manager") ditest juga dengan toggle **aktif** - hasilnya
  tetap sama seperti sebelumnya (tetap diduplikasi jadi "Business Unit
  Manager 1"/"2" dengan catatan seperti biasa). Dikonfirmasi toggle ini
  memang tidak memengaruhi kasus (a).
- **Full alur lewat endpoint asli** (`POST
  /structure-mapper/job-position/upload`) - dites pakai mode mock
  (`USE_MOCK_AI=true`) untuk bagian ini karena kebenaran logic AI-nya
  sendiri sudah dibuktikan lewat testing Gemini asli di atas, jadi bagian
  ini fokus mengetes "sambungan pipa"-nya saja (form -> backend -> database
  -> hasil balik ke frontend), bukan uji ulang AI-nya:
  - Upload dengan toggle mati & toggle aktif masing-masing menghasilkan
    respons API yang sesuai.
  - Dicek langsung ke database (`docker exec ... psql`): kolom
    `ignore_unsolid_line` tersimpan benar sesuai toggle yang dipilih saat
    itu (`false`/`true`) per sesi.
  - File Excel hasil download dibuka ulang dengan `openpyxl` - teks
    "Unmapped" muncul persis seperti yang diharapkan, beda dari sel kosong
    untuk posisi root yang memang sah tidak punya atasan.
- **Lewat browser (UI beneran, bukan cuma API)**: popup upload dibuka,
  checkbox dikonfirmasi tampil default tidak tercentang dengan label & teks
  penjelas yang benar. Upload dengan checkbox dicentang (via klik asli di
  DOM, disesuaikan dengan keterbatasan lingkungan testing tab background -
  lihat catatan teknis di bawah) menghasilkan tabel Report Mapping yang
  menampilkan Courier/OB-OG/Security dengan Parent = "Unmapped" tanpa badge
  status apapun (karena statusnya sudah "ok") - sesuai harapan.
- Semua akun, sesi, dan file uji coba yang dibuat selama testing ini sudah
  dibersihkan dari database & folder `public/`.

### 3. Catatan teknis

- **Percobaan pertama uji-UI sempat "gagal" secara palsu**: saat toggle
  diklik lewat `checkbox.checked = true` + event `change` biasa lewat
  JavaScript, submit tetap menghasilkan hasil seolah toggle mati (Courier
  dkk tetap "perlu dicek manual"). Ini BUKAN bug di kode - ini keterbatasan
  cara testing di lingkungan ini: React tidak menganggap perubahan itu
  "asli" kalau properti `checked` di-set langsung tanpa lewat native
  property-descriptor setter (sama seperti masalah serupa yang sudah
  ditemukan sebelumnya untuk input teks). Setelah pakai trik setter yang
  sama seperti dipakai untuk input teks (tapi untuk properti `checked`),
  percobaan kedua berhasil dan menunjukkan hasil yang benar.
- Ditemukan juga beberapa proses backend lama yang masih menyala dari sesi
  sebelumnya (salah satunya sempat dipaksa jalan dengan
  `USE_MOCK_AI=false` sebagai environment variable saat proses itu
  pertama kali dinyalakan) - proses-proses lama ini dimatikan dan diganti
  satu proses baru yang bersih, supaya testing benar-benar mencerminkan isi
  `.env` terkini, bukan sisa environment dari testing sebelumnya.

### 4. Status

Sudah diimplementasikan dan ditest end-to-end (CLI dengan Gemini asli,
endpoint API, database, dan UI browser). **Belum dianggap selesai sampai
user mengkonfirmasi hasil testing ini.**

---

## 2026-08-04 (lanjutan) — Rebranding nama tampilan aplikasi

Ganti nama yang tampil ke user dari "Talenta Mapping" / "Talenta Position
Mapping" jadi **"Talenta Sync Config AI"** — murni ganti teks tampilan,
tidak ada logic/fungsi yang diubah.

### 1. File yang disentuh

- `CLAUDE.md` — judul dokumen (baris 1) dan baris "Nama produk (sementara)"
  di bagian Ringkasan Proyek.
- `src/app/layout.tsx` — `metadata.title` (judul tab browser).
- `src/app/login/page.tsx` — judul di kartu halaman login.
- `src/app/(app)/page.tsx` — judul besar di halaman Dashboard/Main Page.
- `src/components/layout/sidebar.tsx` — dua tempat:
  - Teks logo di bagian atas sidebar -> "Talenta Sync Config AI".
  - Teks kecil di bagian bawah sidebar (sebelumnya "Talenta Position
    Mapping") -> diganti **"Developed by RTRI Team"** sesuai instruksi
    khusus. **Catatan:** teks ini posisinya di bagian **bawah sidebar kiri**
    (bukan pojok kanan bawah layar) - ini satu-satunya teks kecil bergaya
    footer yang ditemukan di seluruh aplikasi setelah pencarian menyeluruh,
    jadi diasumsikan ini yang dimaksud. Tolong dicek ulang di browser -
    kalau ternyata yang dimaksud teks lain, kabari untuk diperbaiki.
- `backend/main.py` — judul FastAPI (`app = FastAPI(title=...)`), yang
  muncul di tab browser kalau ada yang buka halaman dokumentasi API
  (`/docs`) - bukan bagian dari tampilan produk utama, tapi ikut diganti
  untuk konsistensi.

### 2. Yang SENGAJA tidak diubah (sesuai batasan eksplisit)

- Nama folder project, nama file, `package.json`, nama repository, dan
  identifier teknis lain (variable/function/table name, dst) - semua
  dibiarkan seperti sekarang.
- Isi historis Progress Log ini (entry-entry tanggal sebelumnya) tidak
  ditulis ulang - nama lama yang muncul di catatan lama dibiarkan sebagai
  arsip apa adanya.

### 3. Verifikasi

- `npm run lint` - lolos tanpa error.
- `npm run build` (production build) - lolos tanpa error, semua halaman
  (`/`, `/login`, `/history`, `/settings`, `/stage`, `/structure-mapper`)
  ter-generate normal.
- Python syntax check `backend/main.py` - valid.
- Dicek langsung lewat browser (`get_page_text` + query DOM, screenshot
  visual tidak bisa diambil karena tab berjalan background di lingkungan
  testing ini - lihat keterbatasan yang sama di entry-entry sebelumnya):
  - Judul tab browser: "Talenta Sync Config AI" (dikonfirmasi lewat
    `document.title`).
  - Teks logo sidebar: "Talenta Sync Config AI".
  - Teks kecil bawah sidebar: "Developed by RTRI Team".
  - Judul besar di halaman Dashboard: "Talenta Sync Config AI".
- Pencarian grep menyeluruh ke seluruh folder `src/`, `backend/`, dan
  `CLAUDE.md` (di luar `.next/` yang cuma hasil build lama) memastikan
  tidak ada sisa teks "Talenta Mapping"/"Talenta Position Mapping" lain
  yang terlewat.

### 4. Status

Sudah selesai & ditest (lint, build, verifikasi teks lewat browser).
Disarankan user cek langsung di `http://localhost:3000` untuk konfirmasi
visual (terutama posisi teks "Developed by RTRI Team" - lihat catatan di
atas), karena screenshot tidak bisa diambil dari sisi saya kali ini.

---

## 2026-08-05 (lanjutan) — Structure Mapper: Fase F1 "Structure Your Excel"
(dulu "Organization") — UI dengan data dummy

Lihat `STRUCTURE-MAPPER-SPEC.md` bagian 3.1 & 10 (seluruh sub-bagian) untuk
spesifikasi lengkap fitur ini.

### 1. Langkah 1 — Rename tombol

- `step-select-type.tsx`: tombol "Organization" -> label **"Structure Your
  Excel"**, diaktifkan (sebelumnya disabled/"Segera Hadir"). Tombol "Job
  Position" -> label **"Excel Your Structure"**. Ini murni ganti teks
  tampilan - `onClick`/routing punya "Excel Your Structure" (flow yang
  sudah ada) **tidak disentuh sama sekali**, dikonfirmasi lewat testing
  non-regresi (lihat bagian 3).

### 2. Langkah 2 — UI baru "Structure Your Excel" (data dummy)

- **File baru:**
  - `src/components/structure-mapper/organization-upload-sheet.tsx` -
    popup form (CID, Company Name, upload file Excel), style `Sheet` sama
    seperti popup Excel Your Structure. Validasi ekstensi file
    (`.xlsx`/`.xls`) dilakukan di sisi tampilan saja - belum ada
    pengecekan isi file (itu Fase F2).
  - `src/components/structure-mapper/step-org-diagram.tsx` - halaman
    tunggal yang menampilkan diagram struktur (tanpa tahap
    Analyze/Done, sesuai spec bagian 10.2).
- **File diubah:**
  - `src/context/structure-mapper-context.tsx` - tambah step baru
    `"org-diagram"` (dipisah dari daftar 4-step yang dipakai flow Excel
    Your Structure, bukan ditambahkan ke daftar itu), field state baru
    (`orgCid`, `orgCompanyName`, `orgSourceFileName`, `orgTree`), type
    `OrgTreeNode`, fungsi dummy `buildDummyOrgTree()`, action
    `applyOrganizationUpload()` & `backToSelectType()`.
  - `src/app/(app)/structure-mapper/page.tsx` - progress bar 4-step
    (punya Excel Your Structure) disembunyikan total kalau step aktif
    `"org-diagram"`, supaya tidak muncul label step yang tidak relevan
    untuk flow yang cuma 1 langkah ini.
  - `package.json` - tambah dependency baru **`react-organizational-chart`**
    (v2.2.1, cuma 1 dependency turunan: `@emotion/css`).

### 2. Keputusan teknis

- **Library diagram:** setelah dicek, dipilih `react-organizational-chart`
  ketimbang bikin custom dari nol - render box+garis lurus antar-parent
  murni pakai CSS, layout hierarki (root di atas, cabang di bawah)
  otomatis mengikuti struktur data, dan TIDAK punya fitur collapse/expand
  bawaan yang harus "dimatikan" (memang tidak dibutuhkan di spec ini) -
  dikonfirmasi ke user sebelum instalasi.
- **Data dummy** dibentuk meniru struktur company contoh yang diberikan
  user (screenshot referensi visual + file `template excel for ai.xlsx`):
  CEO di root, 6 manager langsung di bawahnya (Human Resources Manager,
  Legal Manager, FAT Manager, Purchase Manager, HR External Manager, SPV
  General Affairs), sebagian dengan staff/SPV di bawahnya lagi (13 posisi
  total). **Dikonfirmasi** struktur sheet "Export or Import File" pada
  file contoh tsb cocok 100% dengan asumsi kolom yang sudah ditulis di
  spec bagian 10.3 (`Job Position Id*`, `Job Position Name*`, `Parent
  Job Position Id`, `Parent Job Position Name`, `Job Position Code`,
  `Description`) - tidak ada penyesuaian spec yang diperlukan untuk Fase
  F2 nanti.
- Box diagram cuma menampilkan nama posisi (tanpa badge headcount, ikon
  menu "...", atau ikon collapse/expand) sesuai batasan eksplisit di
  instruksi.
- Ditambahkan 1 tombol kecil "Kembali" di halaman diagram (tidak diminta
  eksplisit di spec, tapi diperlukan supaya user tidak "kejebak" di
  halaman ini tanpa cara balik ke pilihan tipe) - sudah disebutkan ke user
  sebelum dikerjakan, belum ada keberatan.

### 3. Hasil testing

- `npm run lint` dan `npm run build` (production build) - keduanya lolos
  tanpa error.
- **Testing lewat browser asli** (klik tombol lewat native DOM `.click()`
  karena keterbatasan lingkungan testing tab background yang sudah dicatat
  di entry-entry sebelumnya - `computer` click biasa tidak selalu
  ke-trigger di tab background):
  - Klik "Structure Your Excel" -> popup terbuka, field CID/Company
    Name/upload Excel terisi & submit berhasil.
  - Setelah submit: diagram tampil dengan seluruh 13 node dummy sesuai
    struktur yang direncanakan, progress bar 4-step terkonfirmasi HILANG
    total di halaman ini (dicek lewat teks halaman - label "1 Pilih
    Tipe/2 Report Mapping/dst" tidak muncul lagi setelah submit).
  - Tombol "Kembali" berfungsi (balik ke halaman pilih tipe).
  - **Non-regresi Excel Your Structure dikonfirmasi**: setelah kembali ke
    pilih tipe, tombol "Excel Your Structure" dites - popup yang terbuka
    masih sama persis seperti sebelumnya (field CID/Company Name, upload
    khusus PDF/JPG/JPEG/PNG, toggle "Ignore Unsolid Line" dari Fase C
    sebelumnya) - tidak ada yang berubah/rusak.
  - Screenshot visual **tidak bisa diambil** (tab berjalan background di
    lingkungan testing ini - keterbatasan yang sama seperti sesi
    sebelumnya) - sebagai gantinya, struktur DOM hasil render dicek lewat
    JavaScript (box punya border & background, ada 5 elemen `<ul>` yang
    merupakan bagian dari mekanisme garis penghubung `react-organizational-
    chart`) untuk memastikan diagram benar-benar ter-render dengan benar,
    bukan cuma data kosong/error diam-diam.

### 4. Belum dikerjakan (sesuai batasan scope eksplisit)

- Parsing file Excel asli (baca sheet "Export or Import File" beneran,
  validasi kolom wajib, deteksi forest/multi-root, error untuk Parent Id
  yang tidak ditemukan) - itu Fase F2, belum dikerjakan sama sekali di
  fase ini.
- Belum ada penyimpanan histori upload untuk flow ini ke database (lihat
  spec bagian 10.5 - opsional untuk versi pertama, keputusan menyusul).

**Tidak disentuh:** flow Excel Your Structure (kecuali rename label),
flow Stage utama, `CLAUDE.md`.

### 5. Status

Sudah diimplementasikan & ditest (lint, build, testing fungsional lewat
browser). **Belum dianggap selesai sampai user mengkonfirmasi hasil
review-nya**, sesuai instruksi eksplisit.

---

## 2026-08-05 (lanjutan 2) — Structure Mapper: Fase F2 "Structure Your Excel" (parsing Excel asli)

> **Belum dianggap selesai** — sesuai instruksi eksplisit user, fase ini
> baru final setelah user sendiri mengkonfirmasi hasil testing di bawah.

### 1. Ganti tombol Export dari PDF ke Image (revisi F1)

- Sebelum F2 dimulai, ditemukan `STRUCTURE-MAPPER-SPEC.md` mengklaim F1
  "PDF export berhasil" padahal kode masih berisi beberapa percobaan
  html2canvas/jsPDF yang gagal (komentar debug masih tertinggal di file).
  Hal ini dilaporkan ke user sebelum lanjut - user menyetujui: ganti jadi
  **Export to Image (PNG)**, bukan PDF, "supaya lebih mudah".
- Sempat dicoba 3 pendekatan berbeda untuk generate gambar dari diagram:
  1. `html2canvas` - gagal karena dua masalah terpisah: (a) warna tema
     Tailwind v4 pakai fungsi `oklch()`/`lab()` yang tidak dikenali parser
     warna internal library ini, dan (b) garis penghubung
     `react-organizational-chart` digambar lewat CSS pseudo-element
     `content: ""` (string kosong) - html2canvas SENGAJA melewati elemen
     semacam ini (bug internal library, bukan bug kode kita), dan override
     lewat `onclone` maupun override sementara di halaman asli terbukti
     tidak memperbaikinya.
  2. `html-to-image` - secara teori seharusnya menghindari kedua masalah
     di atas (tidak pakai parser warna custom), tapi ternyata membuat tab
     browser hang total (60+ detik tidak respon) karena me-inline
     RATUSAN css variable tema Tailwind v4 ke tiap node yang di-clone.
  3. **Solusi final (dipakai):** generator SVG custom yang dibuat dari
     nol, baca langsung dari data tree (`orgTrees`), hitung layout kotak +
     garis siku sendiri (algoritma tree-layout klasik), render sebagai
     `<rect>`+`<text>`+`<line>` SVG memakai warna hex literal (bukan CSS
     variable), lalu dikonversi ke PNG lewat `<canvas>`. Tidak bergantung
     sama sekali ke computed style/CSS pseudo-element, jadi kebal dari
     kedua bug di atas. **Diverifikasi dengan melihat file PNG hasil
     export langsung** (bukan cuma cek "tidak ada error") - hasil kotak +
     garis siku sesuai hierarki data, cocok di percobaan pertama.
- File utama yang berubah untuk ini: `src/components/structure-mapper/
  step-org-diagram.tsx` (fungsi `handleExportImage`, `layoutTree`,
  `collectBoxesAndEdges`). `package.json`: `html2canvas`, `jspdf`,
  `html-to-image` semua sempat diinstall lalu di-uninstall lagi -
  **hasil akhir tidak ada satupun dari 3 library ini** yang jadi
  dependency (`react-organizational-chart` tetap dipakai, tapi hanya
  untuk render on-screen, bukan untuk export).

### 2. Endpoint backend baru: parsing Excel asli (TANPA AI)

- **File baru:** `backend/routers/structure_mapper_organization.py` -
  ikut pola router terpisah yang sudah ada (`structure_mapper.py`),
  didaftarkan di `backend/main.py`. Endpoint: `POST /structure-mapper/
  organization/upload` (terima `cid`, `company_name`, `file` - bentuk
  form-data, sama seperti endpoint upload lain di project).
- **Sengaja TIDAK ada panggilan AI/LLM sama sekali** - karena format file
  fixed/tetap (lihat spec 10.3), parsing murni deterministik pakai
  `openpyxl` (baca kolom, cocokkan Id, bangun tree).
- **Validasi wajib sebelum parsing** (sesuai spec 10.3):
  - Sheet harus bernama persis "Export or Import File" - kalau tidak ada,
    dikembalikan error 400 jelas.
  - Header kolom A-D harus cocok `Job Position Id`, `Job Position Name`,
    `Parent Job Position Id`, `Parent Job Position Name` - toleran
    terhadap tanda `*` di akhir header (file asli menulis `Job Position
    Id*`/`Job Position Name*` untuk menandai kolom wajib), tapi tetap
    strict soal nama kolomnya.
  - Kolom E (`Job Position Code`) & F (`Description`) dibaca sama sekali
    tidak dipakai - sesuai spec, diabaikan total.
  - Kolom A/C (Id) dipakai HANYA untuk matching relasi tree secara
    internal, tidak pernah dikembalikan/ditampilkan ke user - yang
    ditampilkan cuma kolom B/D (Name).
- **Penanganan referensi rusak** (Parent Job Position Id yang tidak
  ditemukan di daftar Id manapun): tidak bikin sistem crash - baris
  tersebut ditampilkan sebagai root/pohon terpisah, plus warning yang
  MENYEBUT NAMA baris bermasalah (bukan Id-nya, karena Id memang tidak
  pernah ditampilkan ke user).
- **Multi-root (forest):** kalau ada >1 baris tanpa parent, masing-masing
  jadi root pohon terpisah - ditampilkan sebagai forest, bukan error.
- **Proteksi tambahan (di luar yang diminta eksplisit, ditambahkan
  proaktif):** deteksi referensi melingkar (circular reference, mis. A
  punya parent B, B punya parent A) - dihentikan dengan warning, bukan
  infinite loop/crash. Termasuk kasus grup melingkar yang SAMA SEKALI
  tidak terhubung ke root manapun (mis. A<->B yang keduanya bukan anak
  siapapun) - awalnya kasus ini punya bug (baris tersebut hilang total
  dari hasil TANPA warning, melanggar prinsip "jangan silent-fail" yang
  jadi pegangan di spec ini) - sudah diperbaiki dengan menambahkan
  pelacakan node yang benar-benar "terkunjungi" lewat root manapun;
  sisanya otomatis dijadikan root tambahan + warning tersendiri.
- **File schema baru:** `backend/schemas.py` - tambah `OrgTreeNodeOut`
  (model rekursif untuk node tree) dan `OrganizationUploadResponse`
  (`cid`, `company_name`, `source_filename`, `trees` (list, mendukung
  forest), `warnings`). Murni penambahan, tidak mengubah schema flow
  Excel Your Structure yang sudah ada.

### 3. Sambungan ke frontend (ganti dummy jadi data asli)

- **File diubah:**
  - `src/lib/api.ts` - tambah tipe `OrgTreeNodeOut`/
    `OrganizationUploadResponse` dan fungsi `uploadOrganizationStructure()`
    yang memanggil endpoint asli di atas (murni penambahan).
  - `src/context/structure-mapper-context.tsx` - state `orgTree` (tunggal)
    diganti jadi `orgTrees` (array, untuk mendukung forest/multi-root),
    tambah state `orgWarnings`. Fungsi dummy `buildDummyOrgTree()`
    dihapus, diganti `mapOrgTreeNodes()` (pass-through dari response API
    asli) dan action `applyOrganizationUpload()` (dummy) diganti
    `applyOrganizationUploadResult(result)` yang menerima response asli
    dari backend.
  - `src/components/structure-mapper/organization-upload-sheet.tsx` -
    ditulis ulang mengikuti pola async `job-position-upload-sheet.tsx`
    (state `submitting`/`error`, field & sheet non-aktif selagi proses
    berjalan, submit ke endpoint asli lewat `uploadOrganizationStructure()`
    lalu `applyOrganizationUploadResult()`).
  - `src/components/structure-mapper/step-org-diagram.tsx` - render
    diagram sekarang loop tiap tree di `orgTrees` (forest, bisa lebih
    dari satu pohon berdampingan), tambah banner warning (ikon segitiga
    kuning) yang tampil kalau `orgWarnings` tidak kosong - warning TIDAK
    disembunyikan/silent, selalu terlihat jelas ke user. Komponen diagram
    yang sama dari Fase F1 tetap dipakai (tidak dibuat ulang), begitu
    juga tombol Export (sudah jadi "Export to Image", lihat bagian 1).

### 4. Hasil testing

- **Parsing dengan file asli** (`backend/test-assets/
  template_excel_for_ai.xlsx`, hierarki 1 root CEO -> 6 manager -> dst,
  13 posisi total): hasil cocok PERSIS - 13 node, 1 root (CEO), struktur
  cabang sama seperti yang dijelaskan user, **0 warning** (sesuai
  ekspektasi user untuk data "bersih" ini).
- **Testing validasi (file sintetis dibuat khusus untuk ini):**
  - Sheet salah nama -> error 400 jelas ("format file tidak sesuai
    template - sheet ... tidak ditemukan").
  - Referensi Parent Id rusak (menunjuk Id yang tidak ada) -> tidak
    crash, baris ybs muncul sebagai root terpisah + warning yang
    menyebutkan NAMA posisi bermasalah.
  - Referensi melingkar (2 baris saling menunjuk satu sama lain, tidak
    terhubung ke root manapun) -> awalnya BUG (hilang tanpa warning),
    sudah diperbaiki (lihat bagian 2) - setelah fix, muncul sebagai pohon
    kecil terpisah + 2 warning (referensi rusak awal + grup melingkar
    terisolasi).
- **Testing UI end-to-end lewat browser asli:** upload file asli lewat
  popup -> diagram tampil sesuai hierarki CEO yang diharapkan -> Export
  to Image menghasilkan file PNG yang benar (diverifikasi visual langsung
  dari file PNG-nya, bukan cuma "tidak ada error") -> banner warning
  dites terpisah dengan data sintetis yang memang mengandung warning,
  tampil dengan jelas.
  - **Non-regresi dikonfirmasi:** flow "Excel Your Structure" (CID/
    Company Name, upload PDF/JPG/JPEG/PNG, toggle "Ignore Unsolid Line")
    dicek ulang setelah semua perubahan di atas - tidak ada yang berubah/
    rusak.
- `npm run lint` dan `npm run build` (production) - keduanya lolos tanpa
  error, sebagai state akhir setelah semua perubahan (termasuk setelah
   3x ganti-ganti library export & bug fix circular reference).

### 5. Keputusan teknis tambahan

- Deteksi circular reference (proteksi infinite-loop + grup terisolasi)
  ditambahkan proaktif oleh saya (tidak diminta eksplisit di spec), demi
  konsistensi dengan prinsip "jangan pernah silent-fail" yang dipegang di
  seluruh spec ini - dilaporkan ke user, bukan diam-diam ditambahkan.
- Sesuai instruksi, **tidak ada penyimpanan ke database** untuk versi
  ini - hasil upload murni session-only (hilang kalau halaman di-refresh/
  upload baru), sesuai spec bagian 10.5.

**Tidak disentuh:** flow Excel Your Structure, flow Stage utama,
`CLAUDE.md`.

### 6. Status

Sudah diimplementasikan & ditest (backend parsing dengan file asli &
edge case, frontend end-to-end lewat browser, lint, build). **Belum
dianggap selesai sampai user mengkonfirmasi hasil testingnya sendiri**,
sesuai instruksi eksplisit: "Jangan anggap Fase F2 selesai sebelum aku
konfirmasi hasil testingnya."

---

## 2026-08-06 — Excel Your Structure: Fase D (script terpisah, BELUM final)

> **Belum dianggap selesai** - sesuai instruksi eksplisit user, fase ini
> baru final setelah user sendiri mengkonfirmasi hasil testing di bawah.
> Script ini BERDIRI SENDIRI, belum disambung ke aplikasi/backend/UI
> (itu Fase E) - tidak menyentuh Stage, UI Structure Mapper yang sudah
> ada, atau flow Structure Your Excel sama sekali.

### 1. File baru

- `backend/job_position_comparison.py` - logic inti: bandingkan Job
  Position hasil mapping (Fase B/C) vs master list Talenta (sheet "List
  of Job Position"), hasilkan 3 kategori (`Baru`, `Kandidat
  Vacant/Dihapus`, `Perlu Konfirmasi`) + info `Sudah Ada`. Juga berisi
  `build_new_positions_export_rows()` untuk siapkan data export 2 kolom
  kategori "Baru".
- `backend/job_position_comparison_test_run.py` - CLI test manual.
  Menerima path file bagan (gambar/PDF) + path Excel master list,
  internal memanggil `structure_extraction.extract_structure()` (Fase B,
  di-reuse langsung - tidak menduplikasi logic ekstraksi), lalu jalankan
  perbandingan, cetak tabel per kategori ke terminal, dan tulis file
  Excel dummy `job_position_comparison_new_positions_export.xlsx` untuk
  kategori "Baru".

### 2. Algoritma matching (3 langkah, hemat panggilan AI)

1. **Exact match** (huruf besar/kecil & spasi disamakan dulu) -> langsung
   `Sudah Ada`, TIDAK panggil AI sama sekali.
2. Untuk nama yang tidak exact match: cari 1 kandidat **paling mirip**
   di sisa master list pakai kemiripan teks (`difflib`) sebagai penyaring
   awal (ambang `_FUZZY_CUTOFF = 0.6`). Kalau tidak ada kandidat yang
   cukup mirip -> langsung `Baru`, TIDAK panggil AI (jelas beda, hemat
   kuota).
3. Kalau ada kandidat cukup mirip -> baru di titik ini AI (`Gemini`,
   lewat `ai_provider.call_ai()` yang sudah ada, DI-REUSE bukan dibuat
   baru) ditanya untuk memutuskan salah satu dari 3 verdict: **same**
   (variasi penulisan/typo, dianggap `Sudah Ada`), **different** (memang
   dua posisi berbeda, mapping-nya masuk `Baru`, kandidat master TIDAK
   dikonsumsi - masih bisa dicek kandidat lain atau berakhir jadi
   vacant), **unsure** (AI tidak yakin - TIDAK ditebak, masuk `Perlu
   Konfirmasi`, sesuai instruksi eksplisit).
4. Sisa nama master yang di akhir proses tidak terpakai sama sekali ->
   `Kandidat Vacant/Dihapus`.
- Mode `USE_MOCK_AI` (flag yang sudah ada di `.env`, DI-REUSE) tetap
  didukung - versi mock pakai kemiripan teks sederhana sebagai pengganti
  judgment AI, pola sama persis seperti `_mock_judge_typo` di
  `value_comparison.py`.

### 3. Keputusan desain (disetujui user sebelum coding)

- Kolom `Status`/`Job Position Code`/`Description` di master list TIDAK
  dipakai untuk matching - murni berdasarkan `Job Position Name`, sesuai
  spec.
- Kalau 1 nama mapping punya 2+ kandidat mirip di master list, dipakai
  kandidat **paling mirip saja** (bukan tanya AI untuk semua kandidat) -
  penyederhanaan untuk versi pertama ini.
- Input mapping mengambil **SEMUA baris** hasil ekstraksi Fase B/C apa
  adanya (termasuk baris yang masih ditandai "perlu dicek manual" dari
  Fase B) - konsisten dengan laporan mapping 3.4 yang juga menampilkan
  semua baris itu ke user.

### 4. Hasil testing

**Verifikasi logic terisolasi** (data buatan, bukan file asli) untuk
memastikan ke-4 jalur algoritma berjalan benar sebelum test dengan data
sungguhan:
- Exact match (termasuk versi ber-spasi ekstra) -> `Sudah Ada`, tanpa AI.
- Tidak ada kandidat mirip sama sekali (rasio di bawah ambang) ->
  langsung `Baru`/tetap `Vacant`, tanpa AI.
- Kandidat mirip + AI (mode mock, `USE_MOCK_AI=true`) menilai **tidak
  yakin** ("Purchase Spv" vs "SPV Purchase") -> `Perlu Konfirmasi`,
  tidak ditebak. Jalur ini belum sempat digenuine-test pakai Gemini asli
  (lihat catatan kuota di bawah), tapi kode judgment-nya SAMA PERSIS baik
  mock maupun real (cuma sumber `TypoJudgement`/`JobPositionMatchJudgement`
  yang beda), jadi risikonya rendah.

**Verifikasi dengan Gemini API asli** (bukan mock) untuk memastikan
pemanggilan AI + parsing hasilnya benar-benar berfungsi, bukan cuma logic
di kode:
- Kandidat mirip + Gemini asli menilai **typo** ("Sales Manger" vs
  "Sales Manager") -> `Sudah Ada`, alasan AI masuk akal.
- Kandidat mirip + Gemini asli menilai **beda level/posisi**
  ("SPV Purchase Logistic" vs "Purchase Logistic Staff") -> `Baru`,
  alasan AI membedakan level Supervisor vs Staff dengan tepat.
- Kandidat mirip + Gemini asli menilai **beda fungsi** ("SPV HR" vs "SPV
  HRGA") -> `Baru`, alasan AI menjelaskan HRGA mencakup General Affairs
  yang lebih luas dari HR saja - masuk akal.
- **Kuota API harian habis** di percobaan berikutnya (`SPV HR` vs
  `SPV HRGA` adalah panggilan TERAKHIR yang berhasil sebelum kena limit):
  error `429 RESOURCE_EXHAUSTED` - `GenerateRequestsPerDayPerProjectPerModel-FreeTier`,
  limit 20 request/hari untuk API key free-tier ini. Ini BUKAN bug kode
  (retry logic di `ai_provider.py` sudah benar mencoba ulang, tapi ini
  limit HARIAN bukan per-menit, jadi tidak akan berhasil sampai kuota
  reset besok atau upgrade plan).
- **Percobaan susulan #1** (2026-08-07, setelah user info "API sudah
  diganti" lalu "sudah reset hari"): dicek dulu - `backend/.env` ternyata
  TIDAK berubah sama sekali sejak 4 Agustus (mtime sama), jadi key yang
  dipakai masih key yang sama, bukan key baru. Kuota harian kelihatannya
  memang sudah sebagian reset (dapat 2 panggilan baru yang berhasil):
  "SPV HR" vs "SPV HRGA" -> **different** lagi (alasan sama, HRGA lebih
  luas), "Finance Manager" vs "SPV Finance" -> **different** (alasan:
  beda level Manager vs Supervisor, masuk akal) - lalu kena `429` lagi di
  percobaan ke-3.
- **Percobaan susulan #2** (2026-08-07, setelah user benar-benar mengganti
  `GEMINI_API_KEY` di `backend/.env` DAN `.env` root ke key lain - dicek
  & dikonfirmasi mtime file berubah + suffix key berbeda dari sebelumnya):
  dengan key baru ini TIDAK ada masalah kuota sama sekali - berhasil
  menjalankan 8 panggilan judgment tambahan berturut-turut tanpa kena
  limit:
  - "GA Staff" vs "Staff General Affairs" -> **same** (GA = singkatan
    General Affairs, level & fungsi sama) - jalur verdict "same" dari
    Gemini asli sudah pernah terbukti sebelumnya, ini contoh tambahan.
  - "HR Site" vs "HR External Manager", "Legal Site" vs "Legal Manager",
    "Site Supervisor" vs "SPV HR Site", "Manager" vs "HR External
    Manager", "Staff" vs "Recruitment Staff", "Admin" vs "Payroll Staff"
    -> semua **different**, termasuk nama yang SENGAJA dibuat sangat
    vague/generic ("Staff", "Admin", "Manager" tanpa keterangan apapun)
    untuk memancing verdict "tidak yakin" - Gemini tetap konsisten
    memberi jawaban tegas + alasan masuk akal di semua kasus, tidak
    pernah mengaku ragu.
  - **Temuan jujur**: dari TOTAL 9 panggilan judgment nyata ke Gemini di
    seluruh sesi ini (termasuk sebelum ganti key), **verdict "unsure"
    belum sekalipun keluar secara alami dari Gemini asli** - model ini
    (alias "gemini-flash-latest") cenderung selalu memberi jawaban tegas
    (same/different) dengan alasan yang masuk akal, bahkan untuk nama
    yang sengaja dibuat sangat generik/minim informasi. Jalur "unsure"
    tetap terverifikasi BENAR secara kode (lewat mode mock, lihat
    verifikasi logic terisolasi di atas) - kalau AI mengembalikan
    "unsure", kode akan menanganinya dengan benar (masuk "Perlu
    Konfirmasi", tidak ditebak) - tapi dalam praktiknya, dengan model ini,
    kategori "Perlu Konfirmasi" kemungkinan akan JARANG terisi. Ini
    bukan bug, tapi observasi penting soal karakter model yang perlu
    diketahui user - kalau diinginkan perilaku AI lebih "hati-hati"/lebih
    sering mengaku ragu, prompt di `_ai_judge_match()` bisa disesuaikan
    lagi nanti (di luar scope Fase D ini, perlu didiskusikan dulu).

**Testing kombinasi asli** (sesuai instruksi user - `USE_MOCK_AI=false`,
Gemini API asli untuk ekstraksi gambar MAUPUN untuk judgment teks):

- **`org-chart-1.png` + `template_excel_for_ai.xlsx`**: ekstraksi Fase B
  menghasilkan 5 Job Position (skenario solid-line ambigu: "Direktur
  Operasional & Marketing" -> "Direktur BBM, Pelumas & Kimia"/"Direktur
  LPG" -> "Business Unit Manager 1"/"2" - cocok persis dengan hasil
  mock/testing Fase B sebelumnya, mengkonfirmasi akurasi ekstraksi pada
  gambar ini). Hasil perbandingan: **Sudah Ada = 0, Baru = 5, Kandidat
  Vacant/Dihapus = 33, Perlu Konfirmasi = 0**.
- **`org-chart-2.png` + `template_excel_for_ai.xlsx`**: ekstraksi Fase B
  menghasilkan 7 Job Position (skenario dotted-line: "HRS & LGA
  Supervisor" -> 3 Officer, + "Courier"/"OB/OG"/"Security" via garis
  putus-putus - cocok persis dengan hasil mock Fase B sebelumnya). Hasil
  perbandingan: **Sudah Ada = 0, Baru = 7, Kandidat Vacant/Dihapus = 33,
  Perlu Konfirmasi = 0**.
- **Kenapa 0 Sudah Ada/Perlu Konfirmasi di kedua kombinasi di atas**:
  kedua gambar bagan (`org-chart-1`/`org-chart-2`) berasal dari domain
  jabatan yang SAMA SEKALI berbeda dari master list contoh
  (`template_excel_for_ai.xlsx` isinya CEO/HR Manager/SPV dst, sedangkan
  kedua gambar isinya Direktur BBM-LPG dan HRS&LGA Supervisor) - jadi
  memang secara data tidak ada satupun nama yang mirip, bukan bug. Ini
  dilaporkan **APA ADANYA** sesuai instruksi, termasuk fakta bahwa 33
  posisi di master list (SPV Recruitment, SPV Payroll, dst - persis yang
  disebut user) semuanya benar muncul di kategori `Kandidat
  Vacant/Dihapus`, mengkonfirmasi kategori ini bekerja sesuai harapan.
- Export dummy kategori "Baru" (2 kolom: `Job Position Name`, `Parent
  Job Position Name`) diverifikasi benar untuk kedua kombinasi di atas -
  root (parent kosong) ikut tersimpan dengan benar sebagai sel kosong.

### 5. Belum dikerjakan (sesuai batasan scope eksplisit)

- Belum disambung ke UI/backend/database - murni script + CLI test,
  sesuai instruksi. Itu scope Fase E.
- Checklist konfirmasi manual untuk kategori `Kandidat Vacant/Dihapus`
  (reuse UI checklist Fase A, sesuai spec 3.7 poin 2) belum dibangun -
  bagian dari Fase E.

**Tidak disentuh:** flow Excel Your Structure yang sudah C-integrated
(step 3.2-3.4), flow Structure Your Excel, flow Stage utama,
`CLAUDE.md`.

### 6. Status

Sudah diimplementasikan & ditest secara menyeluruh: logic terisolasi
(ke-4 jalur algoritma) + 2 kombinasi data asli (`org-chart-1`/`2` vs
master list) + 9 panggilan judgment tambahan ke Gemini asli (bukan mock)
untuk memvalidasi jalur "same"/"different" dengan berbagai macam nama.
Satu temuan jujur untuk diketahui user (bukan bug): verdict **"unsure"
belum sekalipun keluar secara alami dari Gemini asli** meski sudah dicoba
dengan nama-nama yang sengaja dibuat sangat ambigu/generik - model ini
cenderung selalu percaya diri memberi jawaban tegas. Jalur ini tetap
BENAR secara kode (terverifikasi lewat mode mock), tapi praktiknya
kategori "Perlu Konfirmasi" kemungkinan jarang terisi dengan model
default saat ini - lihat bagian 4 untuk detail & opsi kalau user mau
prompt-nya disesuaikan supaya AI lebih sering mengaku ragu.
**Belum dianggap selesai sampai user mengkonfirmasi hasil testingnya**,
sesuai instruksi eksplisit: "Jangan anggap Fase D selesai sebelum aku
konfirmasi hasil testingnya."

---

## 2026-08-07 — Excel Your Structure: Fase E (integrasi Fase D ke backend + UI)

> **Belum dianggap selesai** - sesuai instruksi eksplisit user, fase ini
> baru final setelah user sendiri mengkonfirmasi hasil testing di bawah,
> **terutama poin konsistensi** (lihat bagian 4).

### 1. Refactor kecil sebelum integrasi (tidak mengubah logic)

- `read_master_job_position_names()` (validasi sheet "List of Job
  Position" + baca daftar nama) dipindahkan dari
  `job_position_comparison_test_run.py` (CLI, Fase D) ke
  `job_position_comparison.py` supaya bisa direuse oleh endpoint backend
  tanpa duplikasi kode. Diubah menerima `bytes` (bukan path file) supaya
  bisa dipakai baik dari CLI (baca file lewat path) maupun dari endpoint
  (baca dari `UploadFile`). Ditambah exception khusus
  `InvalidMasterListError` supaya pesan error-nya bisa ditangkap & diubah
  jadi HTTP 400 yang jelas di backend (sebelumnya CLI langsung
  `SystemExit`). **Logic validasi & parsing-nya sendiri TIDAK diubah sama
  sekali** - murni pindah lokasi + ganti cara terima input.
- `job_position_comparison_test_run.py` diupdate importnya mengikuti
  perubahan di atas - sudah dites ulang (`USE_MOCK_AI=true`), hasil masih
  identik seperti sebelum refactor.

### 2. Database - 2 tabel baru (BUKAN ALTER TABLE)

- `job_position_comparison_sessions` - 1 baris per submit upload
  Referensi Talenta (step 3.6), terhubung ke `structure_mapper_sessions`
  lewat FK. Simpan nama & path file referensi. Tiap submit = baris baru
  (bukan overwrite) - sama seperti pola `StructureMapperSession`, PENTING
  untuk test konsistensi (lihat bagian 4) supaya tiap run bisa dibedakan
  & dibandingkan.
- `job_position_comparison_rows` - 1 baris per hasil kategorisasi
  (`category`: `sudah_ada`/`baru`/`vacant_candidate`/`perlu_konfirmasi`),
  simpan nama job position, parent (khusus "baru"), nama versi master
  list & alasan AI (khusus "perlu_konfirmasi").
- Karena keduanya tabel **baru** (bukan kolom baru di tabel lama),
  otomatis dibuat lewat `Base.metadata.create_all()` yang sudah ada di
  `main.py` saat backend di-restart - **tidak perlu `ALTER TABLE`
  manual**, dikonfirmasi jalan lewat restart uvicorn beneran (bukan cuma
  baca kode).
- **Keputusan desain (dikonfirmasi ke user sebelum coding):** keputusan
  checklist manual user (checkbox "Hapus dari Talenta" utk kategori
  vacant, "Anggap sama" utk Perlu Konfirmasi) **TIDAK disimpan** ke tabel
  di atas - murni state frontend per sesi (sama seperti pola dummy
  `used` di Fase A). Yang disimpan ke DB adalah hasil kategorisasi
  MENTAH dari algoritma Fase D saja.

### 3. Endpoint backend baru (`backend/routers/structure_mapper.py`)

- `POST /structure-mapper/job-position/{session_id}/compare` - terima
  file referensi, ambil SEMUA baris mapping sesi ini dari DB (apa
  adanya, termasuk yang masih "perlu dicek manual" - konsisten dengan
  keputusan Fase D), panggil `compare_job_positions()` (Fase D, TIDAK
  ditulis ulang), simpan hasil ke 2 tabel baru, return response 4
  kategori. Validasi: sesi mapping harus ada hasilnya dulu (400 kalau
  belum), file harus `.xlsx`/`.xls` (400), format sheet/header direct
  divalidasi lewat `InvalidMasterListError` -> HTTP 400 dengan pesan
  jelas (bukan crash).
- `GET /structure-mapper/job-position/comparison/{comparison_session_id}/export-new`
  - baca kategori "Baru" dari DB utk sesi perbandingan tsb, generate
    Excel 2 kolom (`Job Position Name`, `Parent Job Position Name`)
    lewat `build_new_positions_export_rows()` (Fase D, direuse apa
    adanya), stream sebagai download. 400 kalau kategori "Baru" kosong.
- `backend/schemas.py`: tambah `JobPositionComparisonRowOut` &
  `JobPositionComparisonResponse` (murni penambahan, tidak mengubah
  schema lain).

### 4. Frontend - reuse komponen Fase A, bukan komponen baru

- `src/lib/api.ts`: tambah `uploadComparisonReference()` &
  `downloadNewPositionsExport()` (pola sama persis dengan fungsi upload/
  export Job Position yang sudah ada).
- `src/context/structure-mapper-context.tsx`: state
  `templateFileName`/`comparisonRows` (dummy, generik "dipakai/tidak")
  diganti `comparisonSessionId`/`referenceFilename`/`comparisonRows`
  (tipe baru, eksplisit per 4 kategori + field `decision` utk checklist
  manual). Action dummy `submitComparisonTemplate()`/
  `toggleJobPositionUsed()` diganti `applyComparisonResult()` (dipanggil
  setelah API call asli berhasil) & `toggleComparisonDecision()`.
- `src/components/structure-mapper/step-upload-template.tsx`: label
  diganti "Upload Referensi Talenta", submit ke endpoint asli (pola
  async submitting/error sama seperti upload sheet lain di project).
- `src/components/structure-mapper/step-comparison-report.tsx`: ditulis
  ulang jadi 4 seksi eksplisit (sebelumnya 1 grid generik):
  - **Baru** - list + tombol Export Excel (memanggil endpoint export-new
    di atas).
  - **Kandidat Vacant/Dihapus** - checkbox grid (reuse pola visual card
    dari Fase A), label **"Hapus dari Talenta"**, default **tidak
    dicentang** (= tetap vacant, opsi tidak destruktif).
  - **Perlu Konfirmasi** - checkbox grid juga, label **"Anggap sama
    (Sudah Ada)"**, default **tidak dicentang** (= dianggap beda),
    menampilkan nama versi master list yang mirip + alasan AI.
  - **Sudah Ada** - list info saja, tanpa checkbox.
  - Tombol "Ganti Referensi" & "Selesai" tetap seperti Fase A.

### 5. Hasil testing

**Lint & build:** `npm run lint` dan `npm run build` (production) -
keduanya lolos tanpa error.

**Testing API langsung** (login sbg user QA sementara, upload
`org-chart-1.png` lewat endpoint mapping asli -> compare dengan
`template_excel_for_ai.xlsx`):
- Hasil kategorisasi cocok persis dengan testing Fase D sebelumnya:
  Sudah Ada=0, Baru=5, Kandidat Vacant/Dihapus=33, Perlu Konfirmasi=0.
- Export "Baru" diverifikasi: file Excel persis 2 kolom (`Job Position
  Name`, `Parent Job Position Name`), header benar, root (parent kosong)
  tersimpan sebagai sel kosong dengan benar.

**PENTING - Testing konsistensi (poin #3 instruksi user):**
- Endpoint `/compare` dijalankan **3 kali berturut-turut** dengan input
  identik (sesi mapping & file referensi yang sama). Hasilnya dicek
  BUKAN cuma jumlah per kategori, tapi **SET NAMA JOB POSITION per
  kategori** (supaya tidak salah "kebetulan jumlahnya sama tapi isinya
  beda") - **hasilnya 100% identik di ke-3 run** (Sudah Ada, Baru,
  Kandidat Vacant/Dihapus, Perlu Konfirmasi - semua set nama sama
  persis, dicek lewat query DB langsung membandingkan 3
  `comparison_session_id` berbeda).
- Karena kombinasi `org-chart-1`/`org-chart-2` + master list contoh
  TIDAK punya pasangan nama "mirip tapi tidak identik" (lihat catatan
  Fase D - domainnya beda total), test di atas TIDAK menyentuh jalur
  AI-judged (`same`/`different`/`unsure`) - jalur itu 100% deterministik
  di test ini (tidak ada panggilan AI sama sekali). Untuk benar-benar
  menguji konsistensi jalur AI, dijalankan test TERPISAH: panggil
  `compare_job_positions()` langsung dengan 3 pasangan nama BUATAN yang
  sengaja dibuat "mirip tapi tidak identik" (`SPV HR` vs `SPV HRGA`,
  `Sales Manger` vs `Sales Manager`, `SPV Purchase Logistic` vs
  `Purchase Logistic Staff`) - dijalankan **3 kali**, hasil kategorisasi
  (termasuk verdict AI per pasangan) **100% identik di ke-3 run**, tidak
  ada Job Position yang kategorinya berubah-ubah antar run.
- **Kesimpulan:** sejauh yang sempat ditest, TIDAK ditemukan kasus
  kategori yang berubah-ubah antar run - baik jalur deterministik maupun
  jalur AI-judged sama-sama stabil. Catatan jujur (sudah disampaikan
  juga di entry Fase D): ini bukan garansi matematis 100% untuk SEMUA
  kemungkinan pasangan nama ke depannya (temperature Gemini tidak diset
  ke 0), tapi dari data yang tersedia untuk ditest saat ini, hasilnya
  konsisten.

**Testing UI end-to-end** (browser asli, login user QA sementara,
dihapus setelah testing):
- Upload `org-chart-1.png` -> Report Mapping tampil benar (5 posisi,
  termasuk badge "Terduplikasi Otomatis" utk Business Unit Manager 1/2).
- Klik Analyze -> halaman "Upload Referensi Talenta" tampil dengan label
  baru (bukan lagi "Upload Template Pembanding" generik Fase A).
- Upload `template_excel_for_ai.xlsx` -> klik Bandingkan -> Report
  Perbandingan tampil dengan 4 seksi persis sesuai hasil API test di
  atas (Baru=5 + tombol Export, Kandidat Vacant/Dihapus=33 dengan
  checklist, Perlu Konfirmasi=0, Sudah Ada=0).
- Checkbox kategori Vacant dites: klik -> label berubah jadi "Ditandai:
  Hapus dari Talenta" (dari default "Tetap vacant") - berfungsi benar.
- Tombol Export Excel dites: request ke `/export-new` sukses (200 OK,
  dicek lewat network log).
- Tombol "Selesai" dites: kembali ke halaman pilih tipe, state ter-reset
  dengan benar.
- **Non-regresi dikonfirmasi:** popup "Structure Your Excel" (flow F1/
  F2, tidak disentuh Fase E) masih terbuka & berfungsi normal setelah
  semua perubahan di atas.

### 6. Belum dikerjakan / batasan sadar

- Keputusan checklist manual (vacant/perlu konfirmasi) tidak dikirim
  balik ke server - lihat keputusan desain di bagian 2. Kalau nanti
  perlu ikut tersimpan/mempengaruhi History, itu perubahan terpisah.
- Tidak ada perubahan ke halaman History untuk menampilkan sesi
  perbandingan - tidak diminta di scope Fase E ini.

**Tidak disentuh:** flow Stage utama, flow Structure Your Excel,
`CLAUDE.md`.

### 7. Status

Sudah diimplementasikan & ditest menyeluruh (lint, build, API langsung,
UJI KONSISTENSI 3x baik jalur deterministik maupun AI-judged, UI
end-to-end lewat browser asli, non-regresi Structure Your Excel).
**Belum dianggap selesai sampai user mengkonfirmasi hasil testingnya**,
sesuai instruksi eksplisit: "Jangan anggap Fase E selesai sebelum aku
konfirmasi hasil testingnya, terutama poin 3 (konsistensi)."

---

## 2026-08-11 — Excel Your Structure: revisi Fase E — pecah Step 4 jadi Step 4 & 5

### 1. Alasan revisi

User minta report perbandingan (dulu 1 halaman menampilkan 4 kategori
sekaligus) dipecah jadi 2 step terpisah supaya tidak menumpuk, dan
mekanisme keputusan kategori Vacant/Perlu Konfirmasi diganti dari
checkbox (dipakai/tidak) jadi radio 3 pilihan. Lihat
`STRUCTURE-MAPPER-SPEC.md` bagian 3.7, 3.7b, 3.8 (sudah diupdate).
Ini **revisi UI/flow murni** - tidak ada logic AI baru, reuse data dari
Fase D/E yang sudah ada.

### 2. Perubahan

**Step 4 (comparison-report) disederhanakan** - cuma tampilkan "Baru"
(dengan tombol Export, tidak berubah) & "Sudah Ada" (info saja). Tombol
footer diganti dari "Selesai" jadi "Lanjut ke Vacant & Konfirmasi".

**Step 5 BARU (`step-vacant-report.tsx`)** - gabungan kategori "Kandidat
Vacant/Dihapus" & "Perlu Konfirmasi" jadi 1 list. Tiap baris punya radio
3 pilihan (ganti dari checkbox boolean), default **"Tetap Vacant"**:
- Tetap Vacant
- Set Inactive (otomatis TIDAK ikut terhitung Vacant)
- Anggap Sama (Sudah Ada) - tidak masuk kategori manapun

2 tombol download terpisah (format Excel 1 kolom `Job Position Name`
saja - Id/Status/Parent belum diperlukan, keputusan format menyusul):
**Download List Vacant** (baris "Tetap Vacant") & **Download List
Inactive** (baris "Set Inactive"). Tombol "Selesai" & "Kembali" (ke
step 4) ada di footer step ini.

**Progress bar jadi 5 step** - `STRUCTURE_MAPPER_STEPS` di context
ditambah step "vacant-report" (label "Vacant & Konfirmasi"). Komponen
`stepper.tsx` sendiri generic (baca dari array), tidak perlu diubah.

**Keputusan teknis (dikonfirmasi ke user sebelum coding):** pilihan
radio TETAP tidak disimpan ke database (state frontend saja, sama
seperti desain checkbox sebelumnya) - daftar nama yang dipilih dikirim
dari browser ke backend cuma saat tombol download diklik, backend yang
generate Excel-nya on the fly (tidak ada library Excel di frontend).

### 3. File yang disentuh

**Backend:**
- `backend/schemas.py` - tambah `ExportComparisonListRequest`.
- `backend/routers/structure_mapper.py` - tambah endpoint baru `POST
  /structure-mapper/job-position/comparison/{id}/export-list/{kind}`
  (`kind`: "vacant"/"inactive"). Nama yang dikirim browser disaring dulu
  terhadap baris kategori vacant_candidate/perlu_konfirmasi yang beneran
  ada di sesi itu (tidak asal percaya input mentah client) - kalau hasil
  saringan kosong, 400 "Tidak ada Job Position yang dipilih untuk
  kategori ini."

**Frontend:**
- `src/lib/api.ts` - tambah `ComparisonListKind`,
  `downloadComparisonList()`.
- `src/context/structure-mapper-context.tsx` - tambah step
  "vacant-report" ke `STRUCTURE_MAPPER_STEPS`; ganti field `decision`
  dari `boolean` jadi 3-state (`ComparisonDecision = "vacant" |
  "inactive" | "same"`, default "vacant"); ganti
  `toggleComparisonDecision` jadi `setComparisonDecision(id, decision)`;
  tambah `goToVacantReport()` (Step 4 -> Step 5, pola sama seperti
  `goToUploadTemplate()`).
- `src/components/structure-mapper/step-comparison-report.tsx` - ditulis
  ulang, cuma render Baru & Sudah Ada.
- `src/components/structure-mapper/step-vacant-report.tsx` - **file
  baru**, render gabungan Vacant/Perlu Konfirmasi + radio 3 pilihan + 2
  tombol download.
- `src/app/(app)/structure-mapper/page.tsx` - tambah render branch utk
  step "vacant-report", update komentar "4-step" jadi "5-step".

### 4. Testing yang sudah dilakukan

- **Lint & build:** `npm run lint` & `npm run build` bersih, tanpa
  error/warning.
- **Test API langsung** (script sementara, dihapus setelah test): upload
  `org-chart-1.png` + compare dgn `template_excel_for_ai.xlsx` (mode
  `USE_MOCK_AI=true` sementara utk hindari kuota Gemini - dikembalikan
  ke `false` setelah selesai, backend di-restart). Hasil: 5 Baru, 33
  Vacant/Perlu Konfirmasi tergabung. Endpoint export-list dites: pilih
  16 nama utk vacant + 17 utk inactive -> kedua file 200 OK, dibuka
  dgn `openpyxl` - **dikonfirmasi tepat 1 kolom "Job Position Name"**,
  isi baris sesuai pilihan. Test edge case: kirim list kosong -> 400;
  kirim nama yang tidak valid/tidak ada di sesi -> 400 (difilter server,
  bukan diteruskan mentah).
- **Test end-to-end via UI (browser asli, bukan cuma API):** login QA
  test user -> upload gambar -> Analyze -> upload referensi -> **Step 4
  dikonfirmasi cuma tampilkan Baru (5) & Sudah Ada (0)**, tidak ada
  section Vacant/Perlu Konfirmasi -> klik "Lanjut ke Vacant &
  Konfirmasi" -> **Step 5 dikonfirmasi tampilkan gabungan 33 baris,
  masing-masing dgn 3 radio, default "Tetap Vacant" (Download List
  Vacant (33), Download List Inactive (0))**. Ubah 2 baris ke "Set
  Inactive" & 1 baris ke "Anggap Sama" -> counter berubah jadi Vacant
  (30) / Inactive (2) - baris "Anggap Sama" benar-benar tidak masuk ke
  keduanya. Klik kedua tombol download -> network log dikonfirmasi 200
  OK utk keduanya.
- **Test progress bar 5-step:** di awal flow, step 2-5 terkunci (tombol
  `disabled`), cuma step 1 aktif. Setelah lewat semua step sampai Step
  5, kelima tombol step jadi bisa diklik langsung (tidak terkunci).
- **Test aturan reset:** dari Step 5 (sudah ubah beberapa radio), mundur
  ke Step 3 lewat progress bar, upload ulang file referensi yang sama ->
  otomatis pindah ke Step 4 (sesi perbandingan baru) -> lanjut ke Step 5
  -> **dikonfirmasi counter kembali ke default (Vacant 33, Inactive 0)**
  - perubahan radio sebelumnya sudah ter-reset, sesuai aturan di spec
    3.8.
  Tombol "Selesai" di Step 5 dites: flow kembali ke Step 1, kelima
  tombol step terkunci lagi (state ter-reset total).
- **Non-regresi:** flow Stage utama & Structure Your Excel tidak
  disentuh oleh revisi ini.
- User QA test (`qa-fase-e-rev@example.com`) & seluruh data terkait
  (session, comparison session/rows) dihapus dari database setelah
  testing selesai. File test (`org-chart-1.png`,
  `template_excel_for_ai.xlsx`) yang sempat disalin ke `public/` untuk
  keperluan upload lewat browser juga sudah dihapus.

### 5. Status

Sudah diimplementasikan & ditest menyeluruh (lint, build, test API
langsung + isi file Excel, UI end-to-end lewat browser asli termasuk
radio 3 pilihan & kedua tombol download, progress bar 5-step, aturan
reset, non-regresi). **Belum dianggap selesai sampai user mengkonfirmasi
hasil testingnya.**
