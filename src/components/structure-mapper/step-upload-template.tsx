"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react"
import { useStructureMapper } from "@/context/structure-mapper-context"
import { ApiError, uploadComparisonReference } from "@/lib/api"

// Fase E - lihat STRUCTURE-MAPPER-SPEC.md bagian 3.6, 10.3. Submit memanggil
// endpoint asli (POST /structure-mapper/job-position/{id}/compare, reuse
// logic Fase D job_position_comparison.py), bukan dummy lagi (Fase A).
export function StepUploadTemplate() {
  const { sessionId, applyComparisonResult } = useStructureMapper()
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!file || !sessionId) return

    // Validasi format tampilan (ekstensi) - validasi ISI file (sheet/header
    // "List of Job Position") tetap dilakukan di backend.
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "xlsx" && ext !== "xls") {
      setError("Format file tidak didukung. Upload file Excel (.xlsx atau .xls).")
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const result = await uploadComparisonReference(sessionId, file)
      applyComparisonResult(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Referensi Talenta</CardTitle>
        <CardDescription>
          Upload master list Job Position yang sudah ada di aplikasi Talenta (sheet
          &quot;List of Job Position&quot;) untuk dibandingkan dengan hasil mapping di atas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="sm-template-upload" className="mb-2 block">
            Pilih file referensi (XLSX, XLS)
          </Label>
          <label
            htmlFor="sm-template-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/60 aria-disabled:pointer-events-none aria-disabled:opacity-60"
            aria-disabled={submitting}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">Klik untuk ganti file</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Klik untuk pilih file</span>
                <span className="text-xs text-muted-foreground">Format didukung: XLSX, XLS</span>
              </>
            )}
          </label>
          <input
            id="sm-template-upload"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={submitting}
            onChange={(e) => {
              setError(null)
              setFile(e.target.files?.[0] ?? null)
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
      <CardFooter className="flex-col items-end gap-2">
        {submitting && (
          <p className="text-xs text-muted-foreground">Membandingkan dengan master list Talenta, mohon tunggu...</p>
        )}
        <Button onClick={handleSubmit} disabled={!file || submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Bandingkan
        </Button>
      </CardFooter>
    </Card>
  )
}
