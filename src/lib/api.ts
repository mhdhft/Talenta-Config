const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export class ApiError extends Error {}

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("talenta_token")
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) }

  if (auth) {
    const token = getToken()
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders })

  if (!res.ok) {
    let message = "Terjadi kesalahan. Silakan coba lagi."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // respons bukan JSON, pakai pesan default
    }
    throw new ApiError(message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function jsonBody(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }
}

// ---- Auth ----

export interface UserOut {
  id: number
  name: string
  email: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserOut
}

export function registerUser(name: string, email: string, password: string) {
  return request<UserOut>("/auth/register", { ...jsonBody({ name, email, password }), auth: false })
}

export function loginUser(email: string, password: string) {
  return request<TokenResponse>("/auth/login", { ...jsonBody({ email, password }), auth: false })
}

// ---- Analysis Runs ----

export const TRANSFER_TYPE_OPTIONS = [
  "Promotion",
  "Demotion",
  "Extend Contract",
  "Mutation",
  "Rotation",
  "Other",
] as const

export type TransferType = (typeof TRANSFER_TYPE_OPTIONS)[number]

export interface CreateRunResponse {
  analysis_run_id: number
  cid: string
  company_name: string
  effective_date: string | null
  transfer_type: string | null
}

export function createAnalysisRun(
  cid: string,
  companyName: string,
  effectiveDate?: string | null,
  transferType?: string | null
) {
  return request<CreateRunResponse>(
    "/analysis-runs",
    jsonBody({
      cid,
      company_name: companyName,
      effective_date: effectiveDate || null,
      transfer_type: transferType || null,
    })
  )
}

// ---- Documents ----

export interface UploadNewResponse {
  analysis_run_id: number
  filename: string
  columns: string[]
}

export function uploadNewDocument(analysisRunId: number, file: File) {
  const form = new FormData()
  form.append("analysis_run_id", String(analysisRunId))
  form.append("file", file)
  return request<UploadNewResponse>("/documents/upload-new", { method: "POST", body: form })
}

export interface UploadReferenceResponse {
  analysis_run_id: number
  filename: string
}

export function uploadReferenceDocument(analysisRunId: number, file: File) {
  const form = new FormData()
  form.append("analysis_run_id", String(analysisRunId))
  form.append("file", file)
  return request<UploadReferenceResponse>("/documents/upload-reference", { method: "POST", body: form })
}

// ---- Analysis ----

export type MappingConfidence = "high" | "medium" | "low"

export interface ColumnMatch {
  kolom_new_document: string
  field_standar_terdeteksi: string | null
  confidence: MappingConfidence
  alasan: string
}

export interface MatchColumnsResponse {
  analysis_run_id: number
  matches: ColumnMatch[]
  standard_fields: string[]
}

export function matchColumns(analysisRunId: number) {
  return request<MatchColumnsResponse>(
    `/analysis/match-columns?analysis_run_id=${analysisRunId}`,
    { method: "POST" }
  )
}

export type MappingStatus = "Changed" | "Unchanged" | "Need Confirmation" | "Not Found"
export type ResultSource = "matched" | "unidentified_employee" | "new_employee"

export interface ResultRow {
  employee_id: string
  employee_name: string | null
  field: string
  nilai_lama: string | null
  nilai_baru: string | null
  status: MappingStatus
  note: string | null
  source: ResultSource
}

export interface CompareResponse {
  analysis_run_id: number
  rows: ResultRow[]
  ids_only_in_new: string[]
  ids_only_in_reference: string[]
}

export function compareValues(
  analysisRunId: number,
  columnMapping: Record<string, string>,
  selectedFields: string[]
) {
  return request<CompareResponse>(
    "/analysis/compare",
    jsonBody({
      analysis_run_id: analysisRunId,
      column_mapping: columnMapping,
      selected_fields: selectedFields,
    })
  )
}

// ---- Report ----

export interface ReportResponse {
  download_url: string
}

export function generateReport(
  analysisRunId: number,
  includeUnidentified: boolean,
  includeNewEmployees: boolean
) {
  return request<ReportResponse>(
    "/report/generate",
    jsonBody({
      analysis_run_id: analysisRunId,
      include_unidentified: includeUnidentified,
      include_new_employees: includeNewEmployees,
    })
  )
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/)
  return match ? match[1] : fallback
}

export async function downloadReport(analysisRunId: number): Promise<DownloadedFile> {
  const token = getToken()
  const res = await fetch(`${API_URL}/report/download/${analysisRunId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let message = "Gagal mengunduh report. Pastikan report sudah di-generate."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // respons bukan JSON, pakai pesan default
    }
    throw new ApiError(message)
  }
  const blob = await res.blob()
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
    `Report_Employee_Transfer_${analysisRunId}.xlsx`
  )
  return { blob, filename }
}

// ---- History ----

export interface HistoryEntry {
  id: number
  date: string
  cid: string
  companyName: string
  newFileName: string | null
  referenceFileName: string | null
  status: string
  fileAvailable: boolean
}

export function getHistory(q?: string) {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""
  return request<HistoryEntry[]>(`/history${query}`, { method: "GET" })
}

export function deleteHistoryEntry(id: number) {
  return request<void>(`/history/${id}`, { method: "DELETE" })
}

// ---- Structure Mapper (Fase C - step 3.2-3.4 saja, lihat STRUCTURE-MAPPER-SPEC.md) ----

export type StructureMapperRowStatus = "ok" | "duplicated" | "needs_manual"

export interface StructureMapperRowOut {
  id: number
  job_position: string
  parent_job_position: string | null
  name: string | null
  status: StructureMapperRowStatus
  note: string | null
}

export interface StructureMapperUploadResponse {
  session_id: number
  cid: string
  company_name: string
  source_filename: string
  rows: StructureMapperRowOut[]
}

export function uploadJobPositionStructure(
  cid: string,
  companyName: string,
  file: File,
  ignoreUnsolidLine: boolean
) {
  const form = new FormData()
  form.append("cid", cid)
  form.append("company_name", companyName)
  form.append("file", file)
  form.append("ignore_unsolid_line", String(ignoreUnsolidLine))
  return request<StructureMapperUploadResponse>("/structure-mapper/job-position/upload", {
    method: "POST",
    body: form,
  })
}

export async function downloadJobPositionExport(sessionId: number): Promise<DownloadedFile> {
  const token = getToken()
  const res = await fetch(`${API_URL}/structure-mapper/job-position/${sessionId}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let message = "Gagal mengunduh file Excel. Pastikan sesi mapping sudah ada hasilnya."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // respons bukan JSON, pakai pesan default
    }
    throw new ApiError(message)
  }
  const blob = await res.blob()
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
    `StructureMapper_${sessionId}.xlsx`
  )
  return { blob, filename }
}

// ---- Excel Your Structure - Fase E: perbandingan Job Position hasil mapping
// vs master list Talenta (step 3.6-3.7, lihat STRUCTURE-MAPPER-SPEC.md). ----

export type JobPositionComparisonCategory =
  | "sudah_ada"
  | "baru"
  | "vacant_candidate"
  | "perlu_konfirmasi"

export interface JobPositionComparisonRowOut {
  id: number
  category: JobPositionComparisonCategory
  job_position: string
  parent_job_position: string | null
  master_job_position: string | null
  alasan: string | null
}

export interface JobPositionComparisonResponse {
  comparison_session_id: number
  structure_mapper_session_id: number
  reference_filename: string
  rows: JobPositionComparisonRowOut[]
}

export function uploadComparisonReference(sessionId: number, file: File) {
  const form = new FormData()
  form.append("file", file)
  return request<JobPositionComparisonResponse>(
    `/structure-mapper/job-position/${sessionId}/compare`,
    { method: "POST", body: form }
  )
}

export async function downloadNewPositionsExport(
  comparisonSessionId: number
): Promise<DownloadedFile> {
  const token = getToken()
  const res = await fetch(
    `${API_URL}/structure-mapper/job-position/comparison/${comparisonSessionId}/export-new`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (!res.ok) {
    let message = "Gagal mengunduh Excel kategori 'Baru'. Pastikan ada hasil untuk sesi ini."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // respons bukan JSON, pakai pesan default
    }
    throw new ApiError(message)
  }
  const blob = await res.blob()
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
    `StructureMapper_NewPositions_${comparisonSessionId}.xlsx`
  )
  return { blob, filename }
}

// Revisi 2026-08-11 (spec 3.7b) - Step 5: report "Vacant" & "Perlu
// Konfirmasi" digabung, keputusan radio per baris (Tetap Vacant/Set
// Inactive/Anggap Sama) TIDAK disimpan ke backend (state frontend saja),
// jadi daftar nama yang dipilih dikirim dari browser tiap kali tombol
// download diklik - lihat routers/structure_mapper.py export_comparison_list().
export type ComparisonListKind = "vacant" | "inactive"

export async function downloadComparisonList(
  comparisonSessionId: number,
  kind: ComparisonListKind,
  jobPositions: string[]
): Promise<DownloadedFile> {
  const token = getToken()
  const res = await fetch(
    `${API_URL}/structure-mapper/job-position/comparison/${comparisonSessionId}/export-list/${kind}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ job_positions: jobPositions }),
    }
  )
  if (!res.ok) {
    let message = "Gagal mengunduh Excel. Pastikan ada Job Position yang dipilih."
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // respons bukan JSON, pakai pesan default
    }
    throw new ApiError(message)
  }
  const blob = await res.blob()
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
    `StructureMapper_${kind}_${comparisonSessionId}.xlsx`
  )
  return { blob, filename }
}

// ---- Structure Your Excel (dulu "Organization") - Fase F2, lihat
// STRUCTURE-MAPPER-SPEC.md bagian 10. Independen dari Excel Your Structure
// di atas - endpoint, tipe data, dan flow-nya terpisah total. ----

export interface OrgTreeNodeOut {
  id: string
  name: string
  children: OrgTreeNodeOut[]
}

export interface OrganizationUploadResponse {
  cid: string
  company_name: string
  source_filename: string
  trees: OrgTreeNodeOut[]
  warnings: string[]
}

export function uploadOrganizationStructure(cid: string, companyName: string, file: File) {
  const form = new FormData()
  form.append("cid", cid)
  form.append("company_name", companyName)
  form.append("file", file)
  return request<OrganizationUploadResponse>("/structure-mapper/organization/upload", {
    method: "POST",
    body: form,
  })
}
