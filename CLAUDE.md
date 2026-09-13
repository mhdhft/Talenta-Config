# CLAUDE.md — Talenta Sync Config AI Platform

Dokumen ini adalah konteks utama proyek. Baca ini di awal setiap sesi sebelum mengerjakan task apapun.

## 1. Ringkasan Proyek

**Nama produk (sementara):** Talenta Sync Config AI
**Tujuan:** Website internal untuk otomatisasi pemetaan perpindahan posisi karyawan (mutasi jabatan, organisasi, dll) menggunakan AI, dengan output akhir berupa laporan Excel.
**Target user:** Tim HR/People Ops, non-teknis.
**Tema visual:** Simple & modern, warna dominan **merah** (brand Talenta).

## 2. Tech Stack yang Disepakati

- **Frontend:** Next.js + Tailwind CSS + Shadcn/ui
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL
- **AI Engine:** Gemini API (Google) untuk tahap **testing/demo** — gratis, cocok untuk development. Setelah demo disetujui, rencana pindah ke **Claude API (Anthropic)** untuk production (pertimbangan: data karyawan tidak dipakai untuk training di tier berbayar). **Penting:** kode harus ditulis dengan lapisan abstraksi (misal fungsi `call_ai_provider()`) supaya nanti gampang ganti provider tanpa rombak besar.
- **Report generation:** pandas + openpyxl
- **File storage:** cloud bucket (S3/GCS) untuk file upload & report hasil generate

Jangan ganti tech stack ini tanpa konfirmasi ke saya (user) terlebih dahulu.

## 3. Struktur Halaman (UI)

### Main Page
3 menu utama berbentuk ikon bulat:
1. **Upload Documents**
2. **History**
3. **Settings**

### Sidebar (persist di semua halaman)
- Dashboard → kembali ke Main Page
- Stage → halaman proses multi-step
- History → riwayat proses yang sudah dilakukan
- Settings

### Header
Pojok kanan atas menampilkan nama & email user yang sedang login.

## 4. Alur Kerja (Stage Flow)

Urutan step di halaman Stage:

`Input Company Info → Upload New Document → Upload Reference → Analysis → Resume → Report`

0. **Input Company Info** — sebelum upload dokumen apapun, user wajib input **Company ID (CID)** dan **Company Name** dulu. Ini dilakukan **setiap kali** memulai proses analisis baru (bukan disimpan permanen di profil user, karena 1 user bisa memproses beberapa perusahaan klien berbeda). Data ini disimpan bersama record proses analisis (bukan ke tabel user).

   Selain CID & Company Name (wajib), ada 2 field **opsional** di step yang sama:
   - **Effective Date** — checkbox untuk mengaktifkan field ini. Kalau dicentang, muncul date picker dan **wajib diisi**. Kalau tidak dicentang, field ini kosong (nanti diisi manual seperti sebelumnya). Value disimpan/dikirim ke report dengan format **`yyyy-mm-dd`**.
   - **Transfer Type** — checkbox untuk mengaktifkan field ini. Kalau dicentang, muncul dropdown **wajib dipilih**, dengan opsi: `Promotion`, `Demotion`, `Extend Contract`, `Mutation`, `Rotation`, `Other`. Kalau tidak dicentang, field ini kosong (diisi manual nanti).
1. **Upload New Document** — dilakukan dari Main Page (klik menu Upload), muncul pop-up sidebar kanan, user upload file (.xlsx, .csv). File ini **strukturnya semi-random**: kolom A dipastikan selalu `Employee ID`, tapi kolom B dan seterusnya bisa berbeda-beda urutan/nama tiap kali upload (tidak baku). Setelah upload, user diarahkan ke halaman Stage.
2. **Upload Reference** — user upload dokumen pembanding/existing. Header row file ini yang jadi **field standar** untuk proses column mapping (dinamis per proses, lihat bagian 5 & 6 — bukan dari file `template_A.xlsx` statis).
3. **Analysis** — ada 2 bagian di step ini (bukan cuma konfirmasi sederhana):
   - **3a. Review Column Mapping**: sistem menampilkan tabel hasil pencocokan otomatis: `Kolom di New Document → Field Standar (dari header Reference Document yang diupload)` (contoh: kolom "Jabatan" di New Doc terdeteksi cocok dengan field standar "Job Position"). User bisa **koreksi manual** tiap baris mapping ini (dropdown pilih field standar yang benar) sebelum lanjut — terutama untuk kolom yang AI kurang yakin/ambigu.
   - **3b. Checklist Field untuk Dianalisis**: setelah mapping dikonfirmasi, tampilkan checklist berisi **SEMUA field yang berhasil dipetakan di 3a** (bukan subset/daftar terbatas) — kalau di 3a berhasil match 20 field, checklist di 3b juga harus menampilkan 20 field tsb, bukan cuma sebagian. User lalu memilih (checklist) field mana saja yang ingin dibandingkan/dimasukkan ke report (misal user cuma mau lihat perubahan Organization & Job Level saja, tanpa field lain). Field yang tidak dicentang tidak akan diproses/dibandingkan.
   - Setelah kedua langkah di atas, user klik tombol **Analyze** untuk lanjut ke Resume.
4. **Resume** — hasil mapping AI ditampilkan dalam tabel, **hanya untuk field yang dicentang user di step 3b**. Lihat detail logic di bagian 5.
5. **Report** — user klik **Generate Report**, lalu bisa download file Excel hasil akhir sesuai template (lihat bagian 6). Nama file yang di-generate: **`{CID}-{Company Name}.xlsx`** (Company Name disanitasi dulu — spasi/karakter khusus diganti underscore biar aman jadi nama file).

## 4a. Halaman History

- Menampilkan daftar proses analisis yang pernah dilakukan user, termasuk kolom **CID** dan **Company Name**.
- Ada **search bar** — bisa cari berdasarkan CID atau Company Name.
- Ada **toggle/tombol delete** per baris — user bisa hapus history miliknya sendiri (rekomendasi implementasi: **soft delete**, yaitu ditandai terhapus/disembunyikan dari daftar, bukan dihapus permanen dari database — supaya masih bisa dipulihkan/diaudit kalau ternyata salah hapus. Tanyakan ke saya dulu kalau mau pakai hard delete beneran).
- **Download ulang report**: tiap baris History (yang filenya masih tersedia) punya tombol **Download**, supaya user bisa ambil ulang report tanpa harus lewat halaman Stage lagi.
- **Retensi file di server — GLOBAL, bukan per user/per CID**: server hanya menyimpan **2 file report TERBARU secara keseluruhan** (siapapun user-nya, CID apapun). Begitu ada report baru ke-generate dan jumlah file tersimpan sudah lebih dari 2, file report **paling lama otomatis dihapus dari server** (bukan cuma disembunyikan — filenya beneran dihapus supaya tidak memenuhi storage).
- Baris History yang file-nya sudah dihapus (lewat batas retensi) **tetap muncul di daftar** (bukan ikut hilang), tapi tombol Download berubah jadi nonaktif/disabled dengan keterangan **"File sudah tidak tersedia"**.

## 5. Logic AI Mapping (INTI PRODUK — paling krusial)

Urutan proses (2 tahap besar):

### Tahap 1 — Column Header Matching (step Analysis 3a)

1. Kolom A New Document **selalu** `Employee ID` — dipakai langsung sebagai key, tidak perlu di-matching.
2. Untuk kolom B dan seterusnya di New Document (nama/urutan bisa acak), AI membandingkan nama header tersebut dengan **daftar field standar yang dibaca secara dinamis dari header row Reference Document yang diupload user di proses ini** — **BUKAN** dari file `templates/template_A.xlsx` yang statis di server. `template_A.xlsx` cuma contoh/acuan struktur yang dipakai waktu development (lihat bagian 6), tapi saat runtime, "field standar" untuk tiap proses analisis = header asli dari file Reference Document yang diupload user saat itu. Ini penting supaya field yang bisa dipetakan mengikuti isi dokumen sesungguhnya, bukan dibatasi daftar tetap.
3. Hasil matching ditampilkan ke user sebagai tabel yang bisa dikoreksi manual (lihat bagian 4, step 3a) — **jangan langsung proses otomatis tanpa direview user**, terutama untuk kolom yang confidence match-nya rendah (nama sangat berbeda/ambigu).
4. Setelah user konfirmasi/koreksi mapping, baru lanjut ke Tahap 2.

### Tahap 2 — Value Comparison (step Analysis 3b → Resume)

1. Matching antar baris dilakukan berdasarkan **Employee ID** (logic setara VLOOKUP) — bandingkan Dokumen New vs Dokumen Reference. **Penting (fix bug):** sebelum dibandingkan, Employee ID dari kedua dokumen harus **dinormalisasi dulu** — trim spasi di awal/akhir, hilangkan karakter tidak terlihat/invisible unicode (misalnya zero-width space, non-breaking space), dan bandingkan case-insensitive. Ini supaya ID yang terlihat identik secara visual (misal `FIT-001` di kedua dokumen) tidak salah dianggap tidak match gara-gara karakter tersembunyi yang tidak kelihatan waktu dicek manual di Excel.
2. Hanya field yang **dicentang user** di step 3b yang diproses. Untuk tiap field tercentang, bandingkan value New vs Reference, hasilkan status:
   - **Changed** — nilai kolom berbeda antara New dan Reference.
   - **Unchanged** — nilai kolom sama persis.
   - **Need Confirmation** — dipicu jika terindikasi anomali data, yaitu salah satu dari:
     - Ada **simbol/karakter khusus** yang tidak wajar pada value (misalnya karakter non-alfanumerik yang tidak lazim untuk field tsb)
     - Terindikasi **typo** (kemiripan tinggi antar dua value tapi tidak identik — kemungkinan salah ketik, bukan perubahan data yang valid)
     - Ada **spasi tambahan** (leading/trailing/multiple spaces) yang membuat dua value terlihat beda padahal secara makna sama
     - **Khusus field `First Name` dan `Last Name`**: kalau Employee ID sudah match tapi value nama berbeda (dengan cara apapun) → **SELALU** `Need Confirmation`, jangan pernah `Changed` biasa. Alasan: nama karyawan seharusnya tidak berubah untuk Employee ID yang sama, jadi perbedaan nama dianggap mencurigakan dan butuh review manual (bisa jadi typo, bisa jadi kesalahan input Employee ID di salah satu dokumen).

   > Catatan implementasi: normalisasi spasi & pengecekan karakter khusus sebaiknya dilakukan di **kode/backend** (deterministic, pakai regex/string cleaning), bukan diserahkan ke LLM. LLM baru dipakai untuk kasus **fuzzy/typo detection** yang butuh judgment (misalnya "Sales Manager" vs "Sales Manger"), dan juga untuk Tahap 1 (column header matching) karena butuh pemahaman semantik nama kolom.
3. **Penanganan Employee ID yang tidak match** (setelah normalisasi di poin 1 — keputusan final):
   - **Employee ID ada di Reference tapi tidak ada di New Document** → status khusus **`Not Found`** (bukan Changed/Unchanged/Need Confirmation), ditampilkan ke user di halaman **Resume** setelah klik Analyze. Baris ini berisi data dari Reference untuk kolom `from`, kolom `to` dikosongkan (karena tidak ada data New Document untuk ID ini).
   - **Employee ID ada di New Document tapi tidak ada di Reference** (kemungkinan karyawan baru) → status khusus **`Not Found`** juga, ditampilkan di Resume. Baris ini berisi data dari New Document untuk kolom `to`, kolom `from` dikosongkan.
   - Di step **Report** (sebelum Generate Report), tambahkan **2 checkbox terpisah** yang menentukan apakah baris `Not Found` ini ikut dimasukkan ke file Excel report final:
     - ☐ **Include Unidentified Employee** — untuk baris "ID ada di Reference, tidak ada di New Document"
     - ☐ **Include New Employees** — untuk baris "ID ada di New Document, tidak ada di Reference"
   - Default checkbox: **tidak tercentang** (asumsi — tanyakan ke saya kalau ternyata perlu default tercentang).

## 6. Template Excel Report

Template sudah tersedia: `template_A.xlsx` (struktur baku, dipakai untuk Reference Document) dan `template_B.xlsx` (untuk Report final). Berikut struktur pastinya — **gunakan ini sebagai sumber kebenaran**, jangan bikin struktur sendiri.

### Template A — CONTOH struktur Reference Document (bukan sumber field standar saat runtime)

**Koreksi penting (bug fix):** Template A **bukan** dipakai untuk New Document, dan juga **TIDAK dibaca oleh sistem saat runtime** untuk menentukan field standar. `template_A.xlsx` ini murni **contoh referensi** untuk membantu development (misalnya bikin data dummy, atau gambaran tipikal isi Reference Document) — bukan file yang dibaca ulang tiap kali proses analisis jalan.

**Field standar yang sesungguhnya dipakai saat runtime = header row dari file Reference Document yang diupload user pada proses tersebut** (lihat bagian 5, Tahap 1 poin 2). Kolom-kolom di bawah ini cuma **contoh** kolom yang biasanya ada di Reference Document (berdasarkan `template_A.xlsx`), bukan daftar yang di-hardcode di kode:

`Employee ID, First Name, Last Name, Organization Name, Job Position, Job Level, Grade, Class, Employment Status, Employment Status End Date, Branch Name, Cost Center, Cost Center Category, Approval Line, Manager`

(70 kolom lengkap ada di file `template_A.xlsx` — tapi sekali lagi, ini cuma contoh. Reference Document yang diupload user beneran bisa punya kolom lebih banyak/sedikit/beda, dan sistem harus mengikuti apa yang ADA di file yang diupload, bukan daftar tetap ini.)


### Template B — Report final (output)

3 sheet:

1. **"Employee Transfer"** (sheet utama, satu-satunya yang perlu diisi di Fase ini) — kolom:

   `Employee ID, Employee Name, Effective Date, Transfer Type, Branch from, Branch to, Employment Status From, End Status Date from, Employment Status To, End Status Date To, Job Position from, Job Position to, Organization from, Organization to, Job Level from, Job Level to, Grade from, Grade to, Class from, Class to, Cost Center, Cost Center Category, Approval Line, Manager, Reason, Sign date, Document Template`

2. **"Employee Transfer - SBU"** dan **3. "Employee Transfer-Custom Field"** — sheet ini **TIDAK diisi di Fase ini**, biarkan kosong seperti template asli (header saja: Employee ID, Employee Name). Baru dikerjakan kalau ada instruksi lanjutan.

### Mapping kolom Template A → Template B (before/after)

**Arah data (penting, harus eksplisit):**
- Kolom **`... from`** di Template B = diisi dari **Reference Document** (data lama, struktur baku Template A).
- Kolom **`... to`** di Template B = diisi dari **New Document** (data baru, setelah di-mapping lewat Tahap 1 di bagian 5).

Field-field berikut dibandingkan (Reference vs New) dan diisi ke pasangan `from` (dari Reference)/`to` (dari New) di sheet "Employee Transfer":

| Template A            | Template B (from)         | Template B (to)         |
| ---------------------- | -------------------------- | ------------------------- |
| Branch Name             | Branch from                 | Branch to                  |
| Employment Status       | Employment Status From      | Employment Status To       |
| Employment Status End Date | End Status Date from     | End Status Date To         |
| Job Position             | Job Position from           | Job Position to            |
| Organization Name        | Organization from           | Organization to            |
| Job Level                | Job Level from               | Job Level to                |
| Grade                     | Grade from                    | Grade to                     |
| Class                     | Class from                    | Class to                     |

`Employee ID` dan `Employee Name` diambil langsung (sama di kedua dokumen, ambil dari yang mana saja). `Cost Center`, `Approval Line`, `Manager` diisi langsung dari **New Document** (data terkini, bukan Template A) — satu value, bukan before/after.

### Field yang SENGAJA dikosongkan (diisi manual oleh user nanti)

Kolom berikut **jangan diisi otomatis oleh AI/sistem** — biarkan kosong di file Excel hasil generate, karena akan diisi manual oleh user setelah report jadi:

- `Reason`
- `Cost Center Category`

**Update:** `Effective Date` dan `Transfer Type` **TIDAK selalu kosong lagi** — lihat bagian 4, step 0 (Input Company Info). Kalau user mengaktifkan (centang) dan mengisi field ini di awal proses, isi tsb dipakai untuk mengisi kolom `Effective Date` (format `yyyy-mm-dd`) dan `Transfer Type` di report. Kalau user tidak mengaktifkan, kolom ini tetap kosong seperti sebelumnya (diisi manual nanti).

(Catatan: `Cost Center Category` ada di dua kategori sekaligus di atas — konfirmasi user: field ini dikosongkan untuk diisi manual, BUKAN diambil dari Template A meskipun secara nama terlihat related ke Cost Center.)

`Sign date` dan `Document Template` juga kemungkinan besar termasuk kategori isi manual (belum ada sumber datanya di Template A) — **tanyakan ke user untuk konfirmasi eksplisit sebelum mengambil keputusan** kalau belum jelas saat development.

## 7. Strategi Pembangunan (PENTING)

Kerjakan **bertahap per fase**, jangan sekaligus:

1. **Fase 1 — UI/Frontend dulu** (dengan dummy/mock data, tanpa backend/AI real): Main Page, Sidebar, Stage flow (semua step), tampilan tabel Resume, halaman Report.
2. **Fase 2 — Logic AI mapping**: dikerjakan setelah Fase 1 disetujui.
3. **Fase 3 — Backend & Database**: integrasi API, auth, penyimpanan History.
4. **Fase 4 — Report generation & download**: integrasi ke template Excel asli.

Jangan lompat ke fase berikutnya tanpa konfirmasi eksplisit dari saya bahwa fase sebelumnya sudah oke.

## 8. Aturan Kerja dengan Saya (User)

- Saya **non-teknis** — jelaskan progress pakai bahasa awam, hindari jargon kalau memungkinkan.
- **Kalau ada keputusan ambigu / belum dijelaskan di dokumen ini, TANYAKAN DULU ke saya sebelum mengasumsikan dan lanjut coding.**
- Review setiap perubahan file sebelum saya approve.
- Jangan ubah tech stack, struktur data, atau logic inti tanpa persetujuan saya.
