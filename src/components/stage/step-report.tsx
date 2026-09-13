"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, FileCheck2, Loader2 } from "lucide-react"
import { useStage } from "@/context/stage-context"
import { generateReport, downloadReport, ApiError } from "@/lib/api"

export function StepReport() {
  const { analysisRunId, reportGenerated, generateReport: markReportGenerated, resultRows } =
    useStage()
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeUnidentified, setIncludeUnidentified] = useState(false)
  const [includeNewEmployees, setIncludeNewEmployees] = useState(false)

  const unidentifiedCount = useMemo(
    () =>
      new Set(
        resultRows.filter((row) => row.source === "unidentified_employee").map((r) => r.employee_id)
      ).size,
    [resultRows]
  )
  const newEmployeeCount = useMemo(
    () =>
      new Set(
        resultRows.filter((row) => row.source === "new_employee").map((r) => r.employee_id)
      ).size,
    [resultRows]
  )

  async function handleGenerate() {
    if (!analysisRunId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await generateReport(analysisRunId, includeUnidentified, includeNewEmployees)
      markReportGenerated(res.download_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat report.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    if (!analysisRunId) return
    setDownloading(true)
    setError(null)
    try {
      const { blob, filename } = await downloadReport(analysisRunId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setDownloaded(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengunduh report.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report</CardTitle>
        <CardDescription>
          Generate laporan Excel hasil mapping sesuai template Employee Transfer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        {!reportGenerated ? (
          <>
            <FileDown className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Klik tombol di bawah untuk membuat laporan Excel.
            </p>

            <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-left">
              <label
                className="flex cursor-pointer items-start gap-2"
                title="Karyawan yang ada di Reference Document tapi tidak ditemukan di New Document"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={includeUnidentified}
                  onChange={(e) => setIncludeUnidentified(e.target.checked)}
                />
                <span className="flex flex-col text-sm">
                  <span className="font-medium">
                    Include Unidentified Employee{" "}
                    {unidentifiedCount > 0 && (
                      <span className="font-normal text-muted-foreground">
                        ({unidentifiedCount} karyawan terdeteksi)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Karyawan yang ada di Reference Document tapi tidak ditemukan
                    di New Document.
                  </span>
                </span>
              </label>

              <label
                className="flex cursor-pointer items-start gap-2"
                title="Karyawan baru yang ada di New Document tapi belum ada di Reference Document"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={includeNewEmployees}
                  onChange={(e) => setIncludeNewEmployees(e.target.checked)}
                />
                <span className="flex flex-col text-sm">
                  <span className="font-medium">
                    Include New Employees{" "}
                    {newEmployeeCount > 0 && (
                      <span className="font-normal text-muted-foreground">
                        ({newEmployeeCount} karyawan terdeteksi)
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Karyawan baru yang ada di New Document tapi belum ada di
                    Reference Document.
                  </span>
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generating ? "Membuat Report..." : "Generate Report"}
            </Button>
          </>
        ) : (
          <>
            <FileCheck2 className="h-10 w-10 text-primary" />
            <p className="font-medium">Report berhasil dibuat</p>
            <p className="text-sm text-muted-foreground">
              Report siap diunduh dalam format Excel sesuai template Employee Transfer.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleDownload} disabled={downloading} size="lg">
              {downloading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Download Report
            </Button>
            {downloaded && (
              <p className="text-xs text-muted-foreground">File berhasil diunduh.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
