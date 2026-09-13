# Structure Mapper — Feature Spec

> File ini adalah sumber kebenaran teknis khusus fitur **Structure Mapper**.
> Dirujuk dari `CLAUDE.md` utama. Update file ini setiap ada keputusan baru
> soal fitur ini — jangan biarkan keputusan cuma "hidup" di riwayat chat.

Status: 🟡 In Progress — **Excel Your Structure** (dulu "Job Position"):
Fase A-E sudah diimplementasikan & ditest (lihat Section 8-9), termasuk
revisi 2026-08-11 (Step 4 dipecah jadi Step 4 & 5) — **menunggu
konfirmasi user**. **Structure Your Excel** (dulu "Organization"): Fase
F1-F2 selesai (lihat Section 10).

> **Catatan penamaan (2026-08-05):** tombol/flow yang dulu disebut
> **"Job Position"** sekarang bernama **"Excel Your Structure"**
> (input struktur/gambar → output Excel). Tombol/flow yang dulu
> disebut **"Organization"** sekarang bernama **"Structure Your
> Excel"** (input Excel → output struktur/diagram) — lihat Section 10.
> Istilah **"Job Position"** yang dipakai sebagai **nama kolom data**
> (`Job Position`, `Parent Job Position`) di seluruh dokumen ini
> **TIDAK berubah** — hanya label tombol/flow yang berganti nama.

---

## 1. Ringkasan

Structure Mapper adalah fitur baru untuk memetakan struktur organisasi dan
struktur jabatan (job structure) sebuah company, berdasarkan dokumen yang
diupload user (gambar/PDF), dianalisa AI, lalu dikeluarkan sebagai laporan
Excel.

Berbeda dari flow utama project (Upload → Reference → Analysis → Resume →
Report) yang inputnya file tabel (.xlsx/.csv) dan AI-nya mencocokkan baris
lewat Emp Id, Structure Mapper inputnya **gambar/dokumen visual** (foto/scan
struktur organisasi atau daftar jabatan), sehingga AI perlu "membaca" isi
gambar tersebut (image/vision analysis) sebelum bisa dipetakan menjadi data.

## 2. Lokasi & Entry Point

- Tombol **"Structure Mapper"** muncul di **panel kiri**, posisinya **di
  atas Stage** dan **di bawah Dashboard**.
- Ini adalah entry point baru, sejajar dengan komponen navigasi existing
  (Dashboard, Stage, History, Settings).

## 3. Flow Utama

### 3.1 Klik "Structure Mapper"

Muncul 2 tombol berbentuk bulat:
- **Structure Your Excel** (dulu label "Organization")
- **Excel Your Structure** (dulu label "Job Position")

> Riwayat pengerjaan: **Excel Your Structure** dikerjakan lebih dulu
> (Fase A-C, ~75% selesai). **Structure Your Excel** baru mulai
> didesain (2026-08-05) — detail lengkap di Section 10, jangan campur
> dengan flow Excel Your Structure di bawah ini (3.2-3.8 khusus Excel
> Your Structure).

### 3.2 Klik "Excel Your Structure" (dulu "Job Position") → Popup Input

Muncul popup form berisi:
- Input teks: **CID**
- Input teks: **Company Name**
- Upload file — format didukung: **PDF, JPG, JPEG, PNG**

### 3.3 Setelah Upload → AI Analysis (tahap 1)

Sistem mengirim file yang diupload ke AI untuk dianalisa.

> ✅ **Sudah diputuskan** — lihat detail lengkap di Open Items #1
> (sekarang berstatus terjawab). Ringkas: AI membaca posisi kotak/box
> dan **garis penghubung** di bagan untuk menentukan relasi parent-child
> (kotak yang ditarik garis ke kotak di atasnya = parent-nya).

### 3.4 Report Mapping (Excel)

Hasil analisa AI ditampilkan sebagai laporan mapping struktur, dalam bentuk
data Excel:
- **Ditampilkan** di halaman (preview/tabel)
- **Bisa diexport** (download file Excel)

### 3.5 Pilihan Aksi: "Analyze" atau "Done"

- **Done** → selesai, flow berakhir di sini.
- **Analyze** → lanjut ke 3.6.

### 3.6 Klik "Analyze" → Upload Referensi Talenta

User upload **1 file referensi**: master list Job Position yang sudah
ada di aplikasi Talenta (format sama seperti sheet "List of Job
Position" di `template_excel_for_ai.xlsx` — Job Position Id, Job
Position Name, Status, Job Position Code, Description). File yang sama
ini dipakai untuk **dua keperluan sekaligus** (lihat 3.7).

> ✅ **Sudah diputuskan (2026-08-05)** — lihat Open Items #2 untuk
> detail lengkap.

### 3.7 Report — Step 4: Baru & Sudah Ada

> Revisi 2026-08-06: laporan perbandingan dipecah jadi 2 step terpisah
> supaya tidak menumpuk di 1 halaman (lihat juga 3.7b untuk Step 5).

Sistem membandingkan Job Position hasil mapping (3.4) dengan master
list Talenta (3.6), berdasarkan **Job Position Name** (matching
dibantu AI, bukan exact-string saja — supaya variasi kecil penulisan
tetap terdeteksi, tapi kalau tidak yakin JANGAN ditebak, masuk kategori
"Perlu Konfirmasi" yang ditampilkan di **Step 5**, bukan di sini).

**Step 4 cuma menampilkan 2 kategori:**

1. **Baru** — Job Position ada di hasil mapping (3.4) tapi **tidak
   ditemukan** di master list Talenta → perlu ditambahkan ke Talenta.
   Ada tombol **export**: file Excel isinya cuma 2 kolom, **Job
   Position Name** dan **Parent Job Position Name** (dari data mapping
   3.4), siap diimport ke Talenta.
2. **Sudah Ada** — Job Position **cocok jelas** antara hasil mapping &
   master list Talenta → **informasional saja**, tidak perlu tindakan/
   tidak perlu tombol download (tidak ada yang berubah di Talenta untuk
   kategori ini).

### 3.7b Report — Step 5: Vacant & Perlu Konfirmasi

**Step 5 menggabungkan 2 kategori** yang sebelumnya terpisah, jadi 1
list dengan 1 mekanisme keputusan yang sama:

1. **Kandidat Vacant/Dihapus** — Job Position **ada** di master list
   Talenta tapi **tidak muncul lagi** di hasil mapping terbaru (3.4)
2. **Perlu Konfirmasi** — nama mirip tapi tidak identik antara hasil
   mapping & master list, AI tidak yakin ini posisi yang sama atau beda

**Mekanisme keputusan per baris — 3 opsi (radio/toggle, pilih SATU per
baris, 2026-08-06):**
- **Tetap Vacant** — posisi ini memang sengaja dikosongkan saat ini
- **Set Inactive** — posisi ini sudah tidak dipakai, tandai inactive
- **Anggap Sama (Sudah Ada)** — khusus relevan untuk baris yang asalnya
  dari "Perlu Konfirmasi": user menganggap nama ini sebenarnya SAMA
  dengan entry existing di Talenta (cuma beda penulisan), jadi
  dianggap "Sudah Ada", tidak perlu tindakan. Opsi ini boleh tetap
  muncul di semua baris (termasuk baris asal "Vacant"), tapi secara
  praktis hanya dipakai untuk baris "Perlu Konfirmasi"

Memilih **"Set Inactive"** membuat baris itu otomatis TIDAK ikut
terhitung sebagai "Vacant" (satu baris cuma masuk 1 hasil akhir).

**2 tombol download terpisah, berdasarkan pilihan user:**
- **Download List Vacant** — daftar nama Job Position yang dipilih
  "Tetap Vacant". Format: daftar nama saja (belum perlu Job Position
  Id/Status — keputusan format detail menyusul kalau dibutuhkan)
- **Download List Inactive** — daftar nama Job Position yang dipilih
  "Set Inactive". Format: daftar nama saja untuk versi ini (BUKAN
  disertai Job Position Id/Status dulu — walau Id-nya sebenarnya
  diketahui dari hasil matching, formatnya belum difinalkan, menyusul
  kalau dibutuhkan untuk bulk update Talenta)

Baris yang dipilih **"Anggap Sama (Sudah Ada)"** tidak masuk ke
download manapun (dianggap selesai, tidak perlu tindakan).

Job Position yang **cocok jelas** ("Sudah Ada") tidak perlu tindakan
apapun — sudah ditampilkan di Step 4.

### 3.8 Navigasi Antar-Step (revisi Fase A 2026-07-28, diupdate 2026-08-06)

- Flow Excel Your Structure sekarang **5 step**: select-type →
  mapping-preview (3.4) → upload-template (3.6) → comparison-report
  (Step 4: Baru/Sudah Ada, 3.7) → vacant-report (Step 5: Vacant/Perlu
  Konfirmasi, 3.7b). Progress bar bergaya Stage menyesuaikan jadi 5
  nomor step, nomor step ditampilkan, dan user **bisa klik langsung**
  ke step manapun yang sudah pernah dilewati (tidak harus mundur satu-
  satu).
- **Aturan reset:** kalau user mundur ke step sebelumnya lalu mengubah
  input (misal ganti file upload/CID di step upload, atau upload ulang
  template pembanding), maka data di step-step **setelahnya** harus
  direset — ikut pola reset yang sama seperti disebut di Section 6 #1
  (overwrite total, bukan nyangkut data lama). Ini berlaku juga untuk
  data dummy di Fase A ini.
- Step yang **belum pernah dilewati** tidak bisa diklik langsung dari
  progress bar (harus melalui alurnya, bukan skip ke depan).

## 4. Scope Saat Ini

**In scope:**
- **Excel Your Structure** (dulu "Job Position"): flow lengkap 3.2 – 3.8
  — Fase A-C sedang berjalan/~75% (lihat Section 8)
- **Structure Your Excel** (dulu "Organization"): baru mulai didesain
  (2026-08-05) — lihat Section 10 untuk detail lengkap, fase terpisah
  dari Excel Your Structure
- Entry point "Structure Mapper" + pilihan 2 tombol (3.1)

## 5. Kebutuhan Teknis per Komponen

| Komponen | Kebutuhan |
|---|---|
| **Frontend** | Tombol baru di panel kiri; komponen popup form (CID, Company Name, upload); tabel preview hasil mapping (kolom Job Position/Parent Job Position/Name); tombol Analyze/Done; komponen upload template pembanding; progress bar antar-step bergaya Stage dengan navigasi klik-langsung (lihat 3.8). Ikuti pola komponen panel & popup yang sudah ada di project (lihat `CLAUDE.md` / skill frontend-development). |
| **Backend** | Endpoint upload gambar/PDF (validasi format baru — PDF/JPG/JPEG/PNG, berbeda dari validasi .xlsx/.csv yang sudah ada); endpoint kirim ke AI; endpoint generate & serve file Excel hasil mapping; endpoint upload template pembanding; endpoint proses perbandingan. |
| **AI/LLM** | Model perlu bisa membaca gambar/PDF (vision), bukan cuma data tabel seperti flow utama. Dua tahap analisa: (1) ekstraksi struktur dari upload awal — berbasis deteksi kotak + garis penghubung, dengan ID internal per kotak (lihat Open Items #1); (2) perbandingan struktur awal vs template (lihat Open Items #2, masih terbuka). |
| **Data Processing** | Generate Excel dari hasil mapping (pandas/openpyxl, sama seperti flow utama); export/download; representasi data "dipakai/tidak dipakai" pada report perbandingan. |
| **Database** | Simpan histori mapping per CID/Company Name; status per Job Position (dipakai/tidak); kaitkan dengan sesi/History seperti flow utama. |

## 6. Open Items — Perlu Digali Sebelum Fase Terkait Dimulai

Bagian ini WAJIB diisi (lewat sesi diskusi terpisah) sebelum Fase B dan
Fase D (lihat Progress Log project utama) mulai dikerjakan. Jangan biarkan
Claude Code menebak sendiri jawabannya.

1. **Logic AI analisa awal (3.3) — ✅ Terjawab (2026-07-28)**

   - **Metode pembacaan struktur:** AI membaca bagan berdasarkan **posisi
     kotak/box** dan **garis penghubung antar kotak**. Kotak yang ditarik
     garis ke kotak lain **di atasnya** → kotak di atas adalah **parent**
     dari kotak di bawah. Contoh: bagan Head of CS → CS Spv → CS,
     hasilnya: CS punya parent CS Spv, CS Spv punya parent Head of CS.
   - **Asumsi struktur:** bagan diasumsikan berbentuk **pohon (tree)** —
     satu posisi hanya boleh terhubung ke **1 parent** lewat garis solid
     yang jelas. Dua kasus khusus ditangani beda cara (lihat aturan
     fallback di bawah): (a) **garis solid menyatu di titik ambigu**
     antara 2+ kotak di atasnya, dan (b) **garis putus-putus
     (dotted-line)** yang menandakan lapor ke 2+ atasan sekaligus.
   - **ID internal:** tiap kotak yang terdeteksi diberi **ID unik
     internal** (tidak ditampilkan/diexport ke user). Relasi parent-child
     disimpan berdasarkan ID ini di belakang layar — supaya tidak salah
     sambung kalau ada 2 posisi dengan nama Job Title yang sama persis
     tapi di cabang berbeda (mis. "CS Spv - Jakarta" vs "CS Spv -
     Surabaya"). Kolom **Parent** yang dilihat/diexport user tetap berupa
     **nama Job Title** (bukan ID), hasil "terjemahan" dari ID tersebut.
   - **Kolom output Excel:** `Job Position`, `Parent Job Position`, `Name`
     (opsional — ada **toggle** di UI untuk user memilih apakah nama
     pemegang jabatan ikut dibaca AI & ditampilkan, atau tidak).

     > Catatan penamaan (2026-07-28): kolom ini awalnya sempat ditulis
     > "Job Title" di draft pertama Open Item ini — **sudah diganti jadi
     > "Job Position"** supaya konsisten dengan nama fitur & tombolnya
     > sendiri. Kalau ada kode/dummy data yang masih pakai "Job Title",
     > itu sisa dari sebelum penyesuaian ini dan perlu diganti.
   - **Fallback — dua kasus khusus (2026-07-30):**

     **(a) Garis solid menyatu di titik ambigu** (contoh: satu kotak
     ditarik garis ke titik pertemuan horizontal antara 2+ kotak di
     atasnya, sehingga tidak jelas parent-nya yang mana persis) →
     **DUPLIKASI**, bukan flag manual:
     - Buat 1 entry baru per kemungkinan parent, dengan nama diberi
       akhiran angka urut. Contoh: "Business Unit Manager" yang ambigu
       antara "Direktur BBM, Pelumas & Kimia" dan "Direktur LPG" → jadi
       2 baris: **"Business Unit Manager 1"** (parent: Direktur BBM,
       Pelumas & Kimia) dan **"Business Unit Manager 2"** (parent:
       Direktur LPG).
     - Urutan angka mengikuti urutan visual **kiri-ke-kanan** posisi
       kotak parent yang terhubung.
     - Kolom **Name**: kalau kotak asli punya nama orang, nama yang sama
       dipakai di semua duplikatnya (bukan dikosongkan) — karena secara
       fisik itu tetap 1 kotak yang sama, cuma relasi parent-nya ambigu.
     - Internal: semua duplikat menyimpan referensi ke ID kotak asli
       (sebelum diduplikasi), untuk keperluan penelusuran/merge manual
       nanti — tidak ditampilkan ke user.
     - **Wajib tambahkan catatan tambahan di report** yang terlihat user
       (misal baris catatan/notice di bawah tabel, atau kolom flag),
       menjelaskan bahwa posisi ini terdeteksi ambigu dan diduplikasi
       otomatis oleh sistem, supaya user aware dan bisa koreksi/gabung
       manual kalau perlu.

     **(b) Garis putus-putus (dotted-line)** — default: tetap **flag
     manual** seperti keputusan sebelumnya (bukan diduplikasi), karena
     ini notasi yang sengaja dipakai (indirect/dotted-line reporting),
     bukan ambiguitas teknis pembacaan gambar. Tandai baris ini "perlu
     diisi manual" dan tetap tampilkan bagian yang berhasil dibaca di
     sekitarnya.

     **Toggle "Ignore Unsolid Line" (ditambahkan 2026-08-04):** ada
     toggle di popup upload (job-position-upload-sheet.tsx), **default
     tidak dicentang** (perilaku tetap seperti di atas). Kalau
     dicentang:
     - Sistem **mengabaikan sepenuhnya** garis putus-putus saat
       menentukan relasi parent — pengelompokan hanya berdasarkan garis
       solid
     - Tidak ada notice/flag "perlu manual" untuk baris yang tadinya
       cuma terhubung garis putus-putus
     - Kalau akibatnya suatu posisi jadi **tidak punya parent sama
       sekali** (karena satu-satunya koneksinya cuma garis putus-putus
       yang diabaikan) → kolom Parent Job Position diisi
       **`"Unmapped"`** (BUKAN `"-"`), supaya tidak tertukar dengan
       posisi root asli yang memang tidak punya parent secara sah
     - Toggle ini **tidak memengaruhi** penanganan kasus (a) — garis
       solid ambigu tetap diduplikasi + diberi notice seperti biasa,
       terlepas dari status toggle ini
     - Pilihan toggle ini disimpan per sesi mapping di database, supaya
       kelihatan di histori pengaturan apa yang dipakai saat itu

     **(c) Gambar buram/sebagian tidak terbaca** (di luar 2 kasus di
     atas) → tampilkan bagian yang **berhasil** dibaca, tandai bagian
     yang **gagal** untuk diisi manual — jangan ditolak total, jangan
     ditebak/dipaksakan oleh AI.

2. **Logic AI perbandingan (3.6 – 3.7) — ✅ Terjawab (2026-08-05)**

   - **Format file referensi:** Excel, 1 file, dipakai untuk **2
     keperluan sekaligus** — cek eksistensi (Baru/Sudah Ada) DAN cek
     kandidat vacant/dihapus. Formatnya = sheet "List of Job Position"
     yang sudah ada di `template_excel_for_ai.xlsx` (Job Position Id,
     Job Position Name, Status, Job Position Code, Description) — file
     lain dengan format ini bisa dipakai selama strukturnya sama
   - **Matching berdasarkan:** `Job Position Name`, dibantu AI (bukan
     exact-string match doang) supaya variasi kecil penulisan tetap
     terdeteksi — TAPI kalau AI tidak yakin, JANGAN ditebak, masuk
     kategori "Perlu Konfirmasi" (mirip pola "Need Confirmation" di
     flow utama untuk fuzzy match/typo)
   - **3 kategori hasil** (bukan cuma dipakai/tidak dipakai):
     1. **Baru** — ada di hasil mapping (3.4), tidak ada di master list
        Talenta → bisa **diexport**: Excel 2 kolom saja (`Job Position
        Name`, `Parent Job Position Name`), siap diimport ke Talenta
     2. **Kandidat Vacant/Dihapus** — ada di master list Talenta, tidak
        muncul lagi di hasil mapping terbaru → user konfirmasi manual
        (tetap vacant / hapus), reuse UI checklist dari Fase A
     3. **Perlu Konfirmasi** — nama mirip tapi tidak identik, AI tidak
        yakin sama atau beda → user putuskan manual
   - Yang cocok jelas ("Sudah Ada") tidak perlu tindakan, cukup info

3. **Relasi dengan flow "Structure Your Excel"** (dulu "Organization") —
   sekarang sudah mulai didesain (lihat Section 10), bukan sekadar
   di-skip lagi. Pastikan struktur data/database Excel Your Structure
   tidak perlu dibongkar ulang untuk mengakomodasi Structure Your
   Excel — keduanya independen (lihat 7. Dependency & Integration
   Notes).

## 7. Dependency & Integration Notes

- Fitur ini menambah **jenis file upload baru** (PDF/JPG/JPEG/PNG) yang
  belum ada di validasi backend saat ini (saat ini backend cuma
  menerima .xlsx/.csv). Pastikan Fase C tidak asal extend validasi lama,
  tapi dibuatkan jalur/endpoint terpisah supaya tidak mengganggu flow
  utama.
- Cek Progress Log di `CLAUDE.md` untuk konvensi terbaru dari revisi
  Fase 3 (nama folder/endpoint/skema DB) sebelum mulai Fase C, supaya
  tidak bentrok/tumpang tindih dengan kode yang baru direvisi.

## 8. Rencana Fase Pengembangan (ringkas)

**Excel Your Structure** (dulu "Job Position"):

| Fase | Isi | Status |
|---|---|---|
| A | UI Excel Your Structure (dummy data) | 🔄 Revisi — kolom report & progress bar navigasi disesuaikan (2026-07-28) |
| B | Logic AI ekstraksi struktur (script terpisah, ditest manual) | 🔄 Sedang berjalan — Open Item #1 sudah terjawab |
| C | Backend integrasi (upload, panggil AI, simpan DB, generate Excel) — **disambungkan ke UI langsung** (step 3.2–3.4 jadi real, step 3.5–3.7/Analyze tetap dummy sampai Fase D/E) | 🔄 Sedang berjalan (2026-08-04) |
| D | Logic AI perbandingan template (script terpisah, ditest manual) | ✅ Selesai (2026-08-06) — sudah diimplementasikan & ditest, menunggu konfirmasi user |
| E | Integrasi Analyze ke backend + report perbandingan final | ✅ Selesai (2026-08-07) — sudah diimplementasikan & ditest (termasuk uji konsistensi), menunggu konfirmasi user. Revisi 2026-08-11: Step 4 dipecah jadi Step 4 & 5, lihat Progress Log |

**Structure Your Excel** (dulu "Organization") — lihat Section 10:

| Fase | Isi | Status |
|---|---|---|
| F1 | UI (dummy data) — popup upload, validasi tampilan, diagram statis pakai data dummy, tombol Export to PDF | ✅ Selesai (2026-08-05) — ditest langsung oleh user, PDF export berhasil |
| F2 | Parsing Excel asli (sesuai template tetap) + render diagram dengan data asli | ✅ Selesai (2026-08-05) — ditest end-to-end |

## 9. Progress Log (Structure Mapper)

> Diisi tiap fase selesai & di-approve. Tulis singkat: apa yang dibuat,
> file yang disentuh, keputusan yang diambil.

### 2026-07-28 — Fase A selesai (UI, data dummy)

- File baru: `structure-mapper-context.tsx`, `step-select-type.tsx`,
  `job-position-upload-sheet.tsx` (pemakaian pertama `Sheet` primitive di
  project ini), `step-mapping-preview.tsx`, `step-upload-template.tsx`,
  `step-comparison-report.tsx`, route `structure-mapper/page.tsx`.
- File diubah: `sidebar.tsx` (entry nav baru), `layout.tsx` (provider baru
  dibungkus di dalam `StageProvider`, tidak menggantikan).
- Reset data lama sebelum data baru tampil: mengikuti pola fix "data basi"
  di `stage-context.tsx` (overwrite total, bukan append) — sudah dites
  manual.
- TODO tertulis di kode: dialog konfirmasi "keluar dari flow" ditunda ke
  Fase C (sesuai arahan).
- Flow utama (Stage) & `CLAUDE.md` dikonfirmasi tidak tersentuh.
- Detail lengkap ada di `PROGRESS-MAIN.md` (entry tanggal sama).
- Catatan: screenshot visual belum diambil (tab berjalan background di
  sesi itu) — verifikasi fungsional sudah lewat state/struktur halaman,
  tapi user disarankan cek `/structure-mapper` langsung sekali untuk
  konfirmasi visual popup Sheet & animasinya.

### 2026-07-28 — Open Item #1 terjawab (lihat Section 6 #1 untuk detail lengkap)

### 2026-08-05 — Fase F2 selesai (parsing Excel asli "Structure Your Excel")

- Backend parsing Excel sesuai template 10.3 (bangun tree dari Job
  Position Id/Parent Job Position Id), validasi sheet & kolom wajib,
  forest (multi-root) & warning referensi rusak ditangani sesuai spec.
- Frontend: `organization-upload-sheet.tsx` submit asli,
  `step-org-diagram.tsx` render forest + warnings.
- Detail lengkap ada di `PROGRESS-MAIN.md` (entry tanggal sama).

### 2026-08-06 — Fase D selesai (script terpisah, logic AI perbandingan Job Position)

- `job_position_comparison.py` (fuzzy match via `difflib` + AI judgment
  utk kasus borderline, kalau AI tidak yakin -> "Perlu Konfirmasi"),
  `job_position_comparison_test_run.py` (CLI test). Ditest dgn mock mode
  & Gemini asli (org-chart-1/2.png + `template_excel_for_ai.xlsx`).
  Belum disambung ke backend/UI (itu Fase E).
- Detail lengkap ada di `PROGRESS-MAIN.md` (entry tanggal sama).
  **Belum dianggap selesai sampai user konfirmasi hasil testing.**

### 2026-08-07 — Fase E selesai (integrasi Fase D ke backend + UI)

- Endpoint `POST /job-position/{id}/compare` & `GET
  /job-position/comparison/{id}/export-new`, tabel
  `job_position_comparison_sessions`/`_rows`. Frontend:
  `step-upload-template.tsx` submit asli, `step-comparison-report.tsx`
  4 kategori (Baru/Sudah Ada/Kandidat Vacant/Perlu Konfirmasi).
- Ditest: lint/build, API 3x uji konsistensi (deterministik & AI-judged),
  UI end-to-end lewat browser, export Excel Baru, non-regresi Structure
  Your Excel.
- Detail lengkap ada di `PROGRESS-MAIN.md` (entry tanggal sama).
  **Belum dianggap selesai sampai user konfirmasi hasil testing,
  terutama poin konsistensi.**

### 2026-08-11 — Revisi Fase E: pecah Step 4 (comparison-report) jadi Step 4 & 5

- Step 4 disederhanakan (cuma Baru & Sudah Ada). Step 5 baru
  (`step-vacant-report.tsx`) gabungkan Kandidat Vacant/Dihapus & Perlu
  Konfirmasi jadi 1 list dengan radio 3 pilihan (Tetap Vacant/Set
  Inactive/Anggap Sama, ganti dari checkbox), + 2 tombol download
  (List Vacant/List Inactive, format 1 kolom nama). Progress bar jadi
  5 step. Endpoint backend baru `export-list/{kind}` - keputusan radio
  tetap TIDAK disimpan ke DB (state frontend saja, sama seperti desain
  checkbox sebelumnya).
- Ditest: lint/build, API + isi file Excel, UI end-to-end (termasuk
  radio 3 pilihan, kedua tombol download, progress bar 5-step, aturan
  reset), non-regresi Stage utama & Structure Your Excel.
- Detail lengkap ada di `PROGRESS-MAIN.md` (entry tanggal sama).
  **Belum dianggap selesai sampai user konfirmasi hasil testing.**

---

## 10. Structure Your Excel (dulu "Organization") — Detail Spec

> Ditambahkan 2026-08-05. Fitur ini **independen** dari Excel Your
> Structure (dulu "Job Position") — beda arah transformasi data, beda
> kebutuhan teknis, tidak saling bergantung.

### 10.1 Ringkasan

Kalau Excel Your Structure mengubah **gambar/struktur → Excel**,
Structure Your Excel melakukan **kebalikannya**: user upload file
**Excel** (format tetap/fixed, lihat 10.3), sistem membaca relasi
parent-child dari kolom yang ada, lalu menampilkan **diagram struktur
visual** (box + garis, bergaya bagan organisasi). **Tidak pakai AI** —
karena format Excel-nya selalu sama persis (fixed template), parsing-nya
murni deterministik (baca kolom, bangun tree), bukan interpretasi bebas
seperti Excel Your Structure yang harus baca gambar.

### 10.2 Flow

1. Klik **"Structure Your Excel"** → popup input: **CID**, **Company
   Name**, upload file **Excel** (format lihat 10.3)
2. Submit → sistem parsing file, bangun struktur pohon dari kolom
   Parent Job Position Id/Name
3. Tampilkan **diagram struktur** (lihat 10.4) — **1 langkah saja**,
   tidak ada tahap Analyze/banding template (beda dengan Excel Your
   Structure)

### 10.3 Format File Excel (fixed template)

Berdasarkan contoh yang diberikan user (`template_excel_for_ai.xlsx`),
format-nya **selalu sama persis**, tidak perlu AI untuk membaca kolom:

**Sheet "Export or Import File"** (sumber utama relasi hierarki):

| Job Position Id* | Job Position Name* | Parent Job Position Id | Parent Job Position Name | Job Position Code | Description |
|---|---|---|---|---|---|
| kolom A | kolom B | kolom C | kolom D | kolom E | kolom F |

**Kolom yang dipakai vs diabaikan (2026-08-05):**
- **Kolom B (`Job Position Name`) & D (`Parent Job Position Name`)** —
  ini yang **ditampilkan** ke user di diagram (nama box & label parent)
- **Kolom A (`Job Position Id`) & C (`Parent Job Position Id`)** —
  **tetap dibaca & dipakai untuk matching internal** (membangun relasi
  tree berdasarkan Id, bukan Name), tapi **TIDAK ditampilkan** ke user.
  Ini untuk menghindari salah sambung kalau ada 2 baris dengan
  `Job Position Name` yang sama persis tapi beda cabang (Id-nya pasti
  beda walau Name-nya sama) — sama seperti pola ID internal yang
  dipakai di Excel Your Structure
- **Kolom E (`Job Position Code`) & F (`Description`)** — **diabaikan
  sepenuhnya**, tidak dibaca, tidak dipakai untuk apapun di versi ini
- `Parent Job Position Id`/`Parent Job Position Name` **kosong** =
  posisi ini root (contoh: CEO)

**Validasi wajib sebelum parsing:**
- Sheet dengan nama **"Export or Import File"** harus ada, kalau tidak
  ada → error jelas "format file tidak sesuai template"
- Kolom wajib (`Job Position Id`, `Job Position Name`) harus ada
  headernya persis seperti di atas — WALAU Id tidak ditampilkan ke
  user, kolomnya tetap wajib ada di file karena dipakai untuk matching
  internal
- Kalau ada `Parent Job Position Id` yang **tidak ditemukan** di daftar
  `Job Position Id` manapun (referensi rusak/typo) → baris itu tidak
  boleh bikin sistem crash; tampilkan sebagai **error/warning** yang
  jelas ke user (sebutkan nama baris yang bermasalah — bukan Id-nya,
  karena Id tidak pernah ditampilkan ke user), bukan gagal diam-diam
- Kalau ada **lebih dari 1 root** (lebih dari 1 baris tanpa Parent) →
  tampilkan sebagai beberapa pohon terpisah (forest), bukan dianggap
  error

**Sheet "List of Job Position"** — daftar master (Id, Name, Status,
Code, Description). Untuk versi ini **belum dipakai** kecuali nanti ada
kebutuhan spesifik yang mensyaratkan cross-check dengan sheet ini —
catat sebagai kemungkinan kebutuhan masa depan, bukan dikerjakan sekarang.

### 10.4 Output — Diagram Struktur

- Gaya visual mengikuti contoh screenshot yang diberikan user: box
  per posisi (tampilkan **Job Position Name**), tersusun bertingkat
  sesuai level hierarki, dihubungkan garis lurus ke parent-nya
- **TIDAK perlu** collapse/expand (statis saja, semua node selalu
  tampil)
- **TIDAK perlu** meniru elemen lain di screenshot yang tidak ada
  datanya di template kita: badge jumlah orang (headcount), ikon "..."
  menu, ikon orang — itu elemen dari tool HRIS lain yang datanya tidak
  kita punya. Cukup box + nama posisi + garis hierarki. Kalau
  `Description`/`Job Position Code` ada isinya, boleh ditampilkan
  sebagai teks kecil tambahan di dalam box (opsional, bukan wajib)
- Layout: horizontal per level (root di atas, semakin ke bawah semakin
  banyak cabang) — sama seperti contoh screenshot

### 10.5 Kebutuhan Teknis

| Komponen | Kebutuhan |
|---|---|
| **Frontend** | Popup form baru (CID, Company Name, upload Excel) — style sama seperti Excel Your Structure (Sheet primitive). Komponen diagram struktur baru (box+garis, tree layout) — cek dulu apakah ada library yang cocok (mis. `react-organizational-chart`) atau custom pakai CSS, sebelum membangun dari nol |
| **Backend** | Endpoint upload Excel khusus fitur ini + validasi format (10.3); endpoint parsing (pandas/openpyxl, bangun tree dari Parent Job Position Id/Name); TIDAK perlu panggilan AI sama sekali |
| **AI/LLM** | Tidak dipakai di fitur ini (format fixed, parsing deterministik) |
| **Database** | Simpan histori upload per CID/Company Name (opsional untuk versi pertama — bisa juga session-only dulu tanpa histori, keputusan menyusul kalau dibutuhkan) |

### 10.6 Rencana Fase (lihat juga Section 8)

- **Fase F1 — UI (dummy data):** popup upload, validasi tampilan (format
  file), render diagram statis pakai data tree dummy — supaya desain
  visual diagram-nya bisa direview dulu sebelum masuk parsing asli
- **Fase F2 — Parsing asli:** baca Excel sungguhan sesuai 10.3, validasi,
  bangun tree, render ke komponen diagram yang sama dari Fase F1

**Tidak disentuh oleh fitur ini:** flow Excel Your Structure (3.2-3.8),
flow Stage utama, `CLAUDE.md`.
