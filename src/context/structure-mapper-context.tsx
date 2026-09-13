"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type {
  JobPositionComparisonCategory,
  JobPositionComparisonResponse,
  JobPositionComparisonRowOut,
  OrganizationUploadResponse,
  OrgTreeNodeOut,
  StructureMapperRowOut,
  StructureMapperUploadResponse,
} from "@/lib/api"

// TODO(Fase C): kalau user keluar dari flow ini di tengah jalan (pindah ke
// Dashboard/menu lain sebelum step selesai), state di context ini akan hilang
// begitu saja tanpa konfirmasi. Perlu ditambahkan dialog konfirmasi
// ("yakin ingin keluar? progress akan hilang") sebelum navigasi keluar dari
// halaman Structure Mapper.

export type StructureMapperType = "organization" | "job_position"

// "org-diagram" SENGAJA tidak dimasukkan ke STRUCTURE_MAPPER_STEPS di bawah -
// itu daftar khusus 5-step progress bar punya "Excel Your Structure" (dulu
// "Job Position"). Flow "Structure Your Excel" (dulu "Organization") cuma 1
// langkah (upload -> langsung diagram, tanpa Analyze/Done - lihat
// STRUCTURE-MAPPER-SPEC.md bagian 10.2), jadi progress bar-nya disembunyikan
// total di halaman (lihat structure-mapper/page.tsx) saat step ini aktif -
// bukan ditambahkan sebagai step tambahan di progress bar yang sudah ada.
//
// Revisi 2026-08-11 (spec 3.7, 3.7b, 3.8): step "comparison-report" yang
// dulu 1 halaman (Baru/Sudah Ada/Vacant/Perlu Konfirmasi sekaligus) dipecah
// jadi 2 step - "comparison-report" (Step 4: Baru & Sudah Ada saja) dan
// "vacant-report" (Step 5 BARU: Vacant & Perlu Konfirmasi digabung).
export type StructureMapperStep =
  | "select-type"
  | "mapping-preview"
  | "upload-template"
  | "comparison-report"
  | "vacant-report"
  | "org-diagram"

export const STRUCTURE_MAPPER_STEPS: { key: StructureMapperStep; label: string }[] = [
  { key: "select-type", label: "Pilih Tipe" },
  { key: "mapping-preview", label: "Report Mapping" },
  { key: "upload-template", label: "Upload Template" },
  { key: "comparison-report", label: "Baru & Sudah Ada" },
  { key: "vacant-report", label: "Vacant & Konfirmasi" },
]

export type JobPositionRowStatus = "ok" | "duplicated" | "needs_manual"

export interface JobPositionMappingRow {
  id: string
  jobPosition: string
  parentJobPosition: string | null
  name: string | null
  status: JobPositionRowStatus
  note: string | null
}

// Revisi 2026-08-11 (spec 3.7b) - dulu checkbox boolean per baris, sekarang
// radio 3 pilihan (pilih SATU per baris, lihat step-vacant-report.tsx):
// - "vacant" (default) - tetap dianggap vacant, tidak ada tindakan
// - "inactive" - ditandai inactive, tidak lagi terhitung Vacant
// - "same" - dianggap sama dengan entry existing (Sudah Ada), tidak masuk
//   ke kategori manapun/tidak perlu tindakan (relevan terutama utk baris
//   asal "perlu_konfirmasi", tapi boleh dipilih di baris manapun)
export type ComparisonDecision = "vacant" | "inactive" | "same"

// Fase E - hasil ASLI dari endpoint POST /structure-mapper/job-position/{id}/compare
// (job_position_comparison.py Fase D, direuse lewat router - lihat
// STRUCTURE-MAPPER-SPEC.md bagian 3.6-3.7). Menggantikan dummy
// JobPositionComparisonRow versi Fase A (foundInTemplate/used generik) -
// sekarang eksplisit per 4 kategori.
export interface JobPositionComparisonRow {
  id: string
  category: JobPositionComparisonCategory
  jobPosition: string
  // Hanya terisi untuk kategori "baru" (dipakai tampilan + acuan export).
  parentJobPosition: string | null
  // Hanya terisi untuk kategori "perlu_konfirmasi" - nama versi master list
  // yang dianggap mirip.
  masterJobPosition: string | null
  // Hanya terisi untuk kategori "perlu_konfirmasi" - alasan AI.
  alasan: string | null
  // Keputusan radio manual (HANYA relevan utk "vacant_candidate" &
  // "perlu_konfirmasi", diabaikan utk kategori lain, ditampilkan di Step 5 -
  // vacant-report.tsx) - state FRONTEND SAJA, tidak dikirim/disimpan ke
  // backend (dikirim on-demand ke endpoint export-list cuma saat tombol
  // download diklik - lihat lib/api.ts downloadComparisonList()). Default
  // "vacant" (tidak destruktif).
  decision: ComparisonDecision
}

// Hasil upload (Fase C - dari endpoint asli POST /structure-mapper/job-position/upload,
// bukan dummy lagi - lihat PROGRESS-MAIN.md Fase C).
function mapUploadResponseToRows(rows: StructureMapperRowOut[]): JobPositionMappingRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    jobPosition: row.job_position,
    parentJobPosition: row.parent_job_position,
    name: row.name,
    status: row.status,
    note: row.note,
  }))
}

// Node diagram "Structure Your Excel" (dulu "Organization") - lihat
// STRUCTURE-MAPPER-SPEC.md bagian 10.4. Cuma nama posisi yang ditampilkan
// (name = "Job Position Name" dari kolom B/D template Excel - lihat 10.3);
// tidak ada parentId di sini karena ini SUDAH bentuk tree (bukan flat
// list), jadi tidak perlu ID untuk matching relasi lagi di level tampilan
// ini - id yang tersisa cuma dipakai sebagai React key.
export interface OrgTreeNode {
  id: string
  name: string
  children: OrgTreeNode[]
}

// Fase F2 - hasil asli dari endpoint POST /structure-mapper/organization/upload
// (backend/routers/structure_mapper_organization.py). Bentuknya sudah sama
// persis dengan OrgTreeNode (rekursif), jadi cukup type-cast/pass-through.
function mapOrgTreeNodes(nodes: OrgTreeNodeOut[]): OrgTreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    children: mapOrgTreeNodes(node.children),
  }))
}

// Fase E - hasil asli dari endpoint compare (lihat komentar interface di
// atas). Pass-through sederhana, decision selalu mulai dari "vacant"
// (default, belum diputuskan user - lihat ComparisonDecision).
function mapComparisonRows(rows: JobPositionComparisonRowOut[]): JobPositionComparisonRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    category: row.category,
    jobPosition: row.job_position,
    parentJobPosition: row.parent_job_position,
    masterJobPosition: row.master_job_position,
    alasan: row.alasan,
    decision: "vacant",
  }))
}

interface StructureMapperState {
  step: StructureMapperStep
  maxStepReached: number
  type: StructureMapperType | null
  sessionId: number | null
  cid: string | null
  companyName: string | null
  sourceFileName: string | null
  mappingRows: JobPositionMappingRow[]
  // Fase E - id sesi perbandingan (dari POST .../compare) & nama file
  // referensi Talenta yang diupload di step 3.6. null = belum pernah compare.
  comparisonSessionId: number | null
  referenceFilename: string | null
  comparisonRows: JobPositionComparisonRow[]
  // Field khusus flow "Structure Your Excel" (dulu "Organization") - terpisah
  // dari field di atas (punya "Excel Your Structure") supaya kedua flow
  // tidak saling menimpa data satu sama lain kalau user gonta-ganti tipe.
  orgCid: string | null
  orgCompanyName: string | null
  orgSourceFileName: string | null
  // List (bukan 1 tree tunggal) - file bisa punya lebih dari 1 root, tiap
  // root jadi 1 tree terpisah (forest) - lihat spec bagian 10.3.
  orgTrees: OrgTreeNode[]
  // Peringatan non-fatal dari backend (referensi rusak, referensi melingkar,
  // dst) - lihat spec bagian 10.3. Ditampilkan ke user, tidak menggagalkan
  // apapun.
  orgWarnings: string[]
}

interface StructureMapperContextValue extends StructureMapperState {
  applyJobPositionUploadResult: (result: StructureMapperUploadResponse) => void
  goToUploadTemplate: () => void
  // Dipanggil oleh step-upload-template.tsx SETELAH panggilan API
  // POST /structure-mapper/job-position/{id}/compare berhasil (component
  // yang menangani fetch/loading/error-nya - lihat komponen tsb). Fase E -
  // data sudah asli hasil perbandingan, bukan dummy lagi.
  applyComparisonResult: (result: JobPositionComparisonResponse) => void
  // Set pilihan radio (3 opsi) utk kategori "vacant_candidate"/
  // "perlu_konfirmasi" (lihat komentar field `decision` di interface
  // JobPositionComparisonRow) - dipanggil dari step-vacant-report.tsx.
  setComparisonDecision: (id: string, decision: ComparisonDecision) => void
  // Dipanggil dari step-comparison-report.tsx (tombol "Lanjut") - Step 4 ->
  // Step 5 (spec 3.7b), pola sama seperti goToUploadTemplate().
  goToVacantReport: () => void
  goToStep: (stepNumber: number) => void
  // Dipanggil oleh organization-upload-sheet.tsx SETELAH panggilan API
  // POST /structure-mapper/organization/upload berhasil (component yang
  // menangani fetch/loading/error-nya, pola sama seperti
  // applyJobPositionUploadResult - lihat komponen tsb). Fase F2 - data
  // sudah asli hasil parsing Excel, bukan dummy lagi.
  applyOrganizationUploadResult: (result: OrganizationUploadResponse) => void
  backToSelectType: () => void
  finish: () => void
  reset: () => void
}

const initialState: StructureMapperState = {
  step: "select-type",
  maxStepReached: 1,
  type: null,
  sessionId: null,
  cid: null,
  companyName: null,
  sourceFileName: null,
  mappingRows: [],
  comparisonSessionId: null,
  referenceFilename: null,
  comparisonRows: [],
  orgCid: null,
  orgCompanyName: null,
  orgSourceFileName: null,
  orgTrees: [],
  orgWarnings: [],
}

const StructureMapperContext = createContext<StructureMapperContextValue | null>(null)

export function StructureMapperProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StructureMapperState>(initialState)

  const value = useMemo<StructureMapperContextValue>(
    () => ({
      ...state,
      // Dipanggil oleh job-position-upload-sheet.tsx SETELAH panggilan API
      // POST /structure-mapper/job-position/upload berhasil (component yang
      // menangani fetch/loading/error-nya - lihat komponen tsb). Ini hanya
      // menerapkan hasilnya ke state. "Reset" di sini artinya reset TAMPILAN
      // frontend saja - sesi lama TETAP tersimpan sebagai histori di database,
      // TIDAK dihapus (lihat spec bagian 3.8 & PROGRESS-MAIN.md Fase C).
      applyJobPositionUploadResult: (result: StructureMapperUploadResponse) =>
        setState((prev) => ({
          ...prev,
          type: "job_position",
          sessionId: result.session_id,
          cid: result.cid,
          companyName: result.company_name,
          sourceFileName: result.source_filename,
          mappingRows: mapUploadResponseToRows(result.rows),
          comparisonSessionId: null,
          referenceFilename: null,
          comparisonRows: [],
          step: "mapping-preview",
          // Data step Upload Template & Report Perbandingan sudah dikosongkan
          // di atas - progress bar juga harus ikut dibatasi lagi supaya user
          // tidak bisa loncat klik ke step yang datanya sudah basi/kosong itu
          // sebelum diulang dari step Upload Template.
          maxStepReached: 2,
        })),
      goToUploadTemplate: () =>
        setState((prev) => ({
          ...prev,
          step: "upload-template",
          maxStepReached: Math.max(prev.maxStepReached, 3),
        })),
      // Fase E - lihat STRUCTURE-MAPPER-SPEC.md bagian 3.6-3.7. Dipanggil
      // SETELAH POST /structure-mapper/job-position/{id}/compare berhasil.
      // Referensi baru diupload - laporan perbandingan lama (kalau ada dari
      // upload referensi sebelumnya) diganti TOTAL, bukan ditumpuk/dicampur
      // dengan hasil baru (pola reset yang sama seperti flow lain).
      applyComparisonResult: (result: JobPositionComparisonResponse) =>
        setState((prev) => ({
          ...prev,
          comparisonSessionId: result.comparison_session_id,
          referenceFilename: result.reference_filename,
          comparisonRows: mapComparisonRows(result.rows),
          step: "comparison-report",
          maxStepReached: Math.max(prev.maxStepReached, 4),
        })),
      setComparisonDecision: (id: string, decision: ComparisonDecision) =>
        setState((prev) => ({
          ...prev,
          comparisonRows: prev.comparisonRows.map((row) =>
            row.id === id ? { ...row, decision } : row
          ),
        })),
      // Step 4 -> Step 5 (spec 3.7b). Data comparisonRows sudah ada dari
      // applyComparisonResult, di sini cuma pindah step + buka kunci step 5.
      goToVacantReport: () =>
        setState((prev) => ({
          ...prev,
          step: "vacant-report",
          maxStepReached: Math.max(prev.maxStepReached, 5),
        })),
      goToStep: (stepNumber: number) =>
        setState((prev) => {
          if (stepNumber < 1 || stepNumber > STRUCTURE_MAPPER_STEPS.length) return prev
          if (stepNumber > prev.maxStepReached) return prev
          return { ...prev, step: STRUCTURE_MAPPER_STEPS[stepNumber - 1].key }
        }),
      // Fase F2 - lihat STRUCTURE-MAPPER-SPEC.md bagian 10.2: cuma 1 langkah,
      // tidak ada Analyze/Done, jadi tidak perlu maxStepReached/progress bar
      // seperti flow Excel Your Structure. Upload baru = timpa total data
      // org sebelumnya (pola reset yang sama seperti flow lain).
      applyOrganizationUploadResult: (result: OrganizationUploadResponse) =>
        setState((prev) => ({
          ...prev,
          type: "organization",
          orgCid: result.cid,
          orgCompanyName: result.company_name,
          orgSourceFileName: result.source_filename,
          orgTrees: mapOrgTreeNodes(result.trees),
          orgWarnings: result.warnings,
          step: "org-diagram",
        })),
      backToSelectType: () => setState((prev) => ({ ...prev, step: "select-type" })),
      finish: () => setState(initialState),
      reset: () => setState(initialState),
    }),
    [state]
  )

  return (
    <StructureMapperContext.Provider value={value}>
      {children}
    </StructureMapperContext.Provider>
  )
}

export function useStructureMapper() {
  const ctx = useContext(StructureMapperContext)
  if (!ctx) {
    throw new Error("useStructureMapper must be used within a StructureMapperProvider")
  }
  return ctx
}
