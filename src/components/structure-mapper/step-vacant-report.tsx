"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileDown, Loader2 } from "lucide-react"
import { useStructureMapper, type ComparisonDecision } from "@/context/structure-mapper-context"
import { ApiError, downloadComparisonList } from "@/lib/api"

// Baru ditambahkan 2026-08-11 (spec 3.7b) - Step 5 dari 5. Gabungan kategori
// "Kandidat Vacant/Dihapus" & "Perlu Konfirmasi" (dulu tampil terpisah di
// step-comparison-report.tsx sebelum revisi ini) jadi 1 list, dengan 1
// mekanisme keputusan yang sama: radio 3 pilihan per baris (Tetap Vacant/Set
// Inactive/Anggap Sama), bukan checkbox lagi.
const DECISION_OPTIONS: { value: ComparisonDecision; label: string }[] = [
  { value: "vacant", label: "Tetap Vacant" },
  { value: "inactive", label: "Set Inactive" },
  { value: "same", label: "Anggap Sama (Sudah Ada)" },
]

export function StepVacantReport() {
  const { comparisonSessionId, comparisonRows, setComparisonDecision, goToStep, finish } =
    useStructureMapper()

  const [downloading, setDownloading] = useState<"vacant" | "inactive" | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Digabung dari 2 kategori asal (lihat komentar file), urutan tampil
  // mengikuti urutan aslinya dari backend (id).
  const rows = comparisonRows.filter(
    (row) => row.category === "vacant_candidate" || row.category === "perlu_konfirmasi"
  )
  const vacantNames = rows.filter((row) => row.decision === "vacant").map((row) => row.jobPosition)
  const inactiveNames = rows.filter((row) => row.decision === "inactive").map((row) => row.jobPosition)

  async function handleDownload(kind: "vacant" | "inactive") {
    if (!comparisonSessionId) return
    const names = kind === "vacant" ? vacantNames : inactiveNames
    if (names.length === 0) return
    setDownloadError(null)
    setDownloading(kind)
    try {
      const { blob, filename } = await downloadComparisonList(comparisonSessionId, kind, names)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(
        err instanceof ApiError ? err.message : "Gagal mengunduh Excel. Silakan coba lagi."
      )
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Perbandingan — Vacant & Perlu Konfirmasi</CardTitle>
        <CardDescription>
          Ada di master list Talenta tapi tidak muncul lagi di hasil mapping terbaru, atau nama
          mirip tapi AI tidak yakin sama/beda — pilih tindakan per baris.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            Vacant / Perlu Konfirmasi
            <Badge variant="secondary">{rows.length}</Badge>
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload("vacant")}
              disabled={downloading !== null || vacantNames.length === 0}
            >
              {downloading === "vacant" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-1.5 h-4 w-4" />
              )}
              Download List Vacant ({vacantNames.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload("inactive")}
              disabled={downloading !== null || inactiveNames.length === 0}
            >
              {downloading === "inactive" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-1.5 h-4 w-4" />
              )}
              Download List Inactive ({inactiveNames.length})
            </Button>
          </div>
        </div>
        {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada kandidat vacant/perlu konfirmasi.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-md border border-border px-3 py-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{row.jobPosition}</span>
                  {row.category === "perlu_konfirmasi" && (
                    <span className="text-xs text-muted-foreground">
                      Mirip dengan: {row.masterJobPosition}
                    </span>
                  )}
                  {row.alasan && (
                    <span className="text-xs italic text-muted-foreground">{row.alasan}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {DECISION_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-1.5 text-xs"
                    >
                      <input
                        type="radio"
                        name={`decision-${row.id}`}
                        className="h-3.5 w-3.5 accent-primary"
                        checked={row.decision === opt.value}
                        onChange={() => setComparisonDecision(row.id, opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={() => goToStep(4)}>
          Kembali
        </Button>
        <Button onClick={finish}>Selesai</Button>
      </CardFooter>
    </Card>
  )
}
