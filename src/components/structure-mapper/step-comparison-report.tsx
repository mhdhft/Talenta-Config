"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileDown, Loader2 } from "lucide-react"
import { useStructureMapper } from "@/context/structure-mapper-context"
import { ApiError, downloadNewPositionsExport } from "@/lib/api"

// Revisi 2026-08-11 (spec 3.7, 3.7b) - Step 4 dari 5. Dulu 1 halaman ini
// menampilkan SEMUA 4 kategori sekaligus (Baru/Sudah Ada/Vacant/Perlu
// Konfirmasi) - sekarang dipecah 2 step: di sini cuma "Baru" (dengan tombol
// export, tidak berubah) & "Sudah Ada" (info saja). Kategori "Kandidat
// Vacant/Dihapus" & "Perlu Konfirmasi" dipindah ke Step 5, digabung jadi 1
// list - lihat step-vacant-report.tsx.
export function StepComparisonReport() {
  const { comparisonSessionId, referenceFilename, comparisonRows, goToUploadTemplate, goToVacantReport } =
    useStructureMapper()

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const baruRows = comparisonRows.filter((row) => row.category === "baru")
  const sudahAdaRows = comparisonRows.filter((row) => row.category === "sudah_ada")

  async function handleExportNew() {
    if (!comparisonSessionId) return
    setExportError(null)
    setExporting(true)
    try {
      const { blob, filename } = await downloadNewPositionsExport(comparisonSessionId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(
        err instanceof ApiError ? err.message : "Gagal mengunduh Excel. Silakan coba lagi."
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Perbandingan — Baru & Sudah Ada</CardTitle>
        <CardDescription>
          Dibandingkan dengan referensi <strong>{referenceFilename}</strong> — {comparisonRows.length}{" "}
          Job Position diproses. Kategori Vacant & Perlu Konfirmasi ada di step berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Kategori 1: Baru */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Baru
              <Badge variant="secondary">{baruRows.length}</Badge>
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportNew}
              disabled={exporting || baruRows.length === 0}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-1.5 h-4 w-4" />
              )}
              Export Excel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ada di hasil mapping, belum ada di master list Talenta — perlu ditambahkan ke Talenta.
          </p>
          {exportError && <p className="text-sm text-red-600">{exportError}</p>}
          {baruRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada Job Position baru.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {baruRows.map((row) => (
                <div key={row.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{row.jobPosition}</span>
                  <span className="block text-xs text-muted-foreground">
                    Parent: {row.parentJobPosition ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Kategori 2: Sudah Ada - info saja, tanpa checklist */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            Sudah Ada
            <Badge variant="secondary">{sudahAdaRows.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Cocok jelas antara hasil mapping & master list Talenta — informasi saja, tidak perlu
            tindakan.
          </p>
          {sudahAdaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {sudahAdaRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  {row.jobPosition}
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={goToUploadTemplate}>
          Ganti Referensi
        </Button>
        <Button onClick={goToVacantReport}>
          Lanjut ke Vacant & Konfirmasi
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
