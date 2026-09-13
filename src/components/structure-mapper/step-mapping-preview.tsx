"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileDown, Loader2 } from "lucide-react"
import { useStructureMapper, type JobPositionRowStatus } from "@/context/structure-mapper-context"
import { ApiError, downloadJobPositionExport } from "@/lib/api"

function StatusBadge({ status }: { status: JobPositionRowStatus }) {
  if (status === "duplicated") {
    return <Badge variant="secondary">Terduplikasi Otomatis</Badge>
  }
  if (status === "needs_manual") {
    return <Badge variant="destructive">Perlu Dicek Manual</Badge>
  }
  return null
}

export function StepMappingPreview() {
  const { sessionId, cid, companyName, sourceFileName, mappingRows, finish, goToUploadTemplate } =
    useStructureMapper()
  const [showName, setShowName] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    if (!sessionId) return
    setExportError(null)
    setExporting(true)
    try {
      const { blob, filename } = await downloadJobPositionExport(sessionId)
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
        <CardTitle>Report Mapping — Job Position</CardTitle>
        <CardDescription>
          Hasil pemetaan struktur jabatan untuk <strong>{cid}</strong> —{" "}
          <strong>{companyName}</strong>, dari dokumen <strong>{sourceFileName}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={showName}
            onChange={(e) => setShowName(e.target.checked)}
          />
          Tampilkan kolom Name
        </label>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Position</TableHead>
                <TableHead>Parent Job Position</TableHead>
                {showName && <TableHead>Name</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.jobPosition}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.parentJobPosition ?? "-"}
                  </TableCell>
                  {showName && <TableCell>{row.name ?? "-"}</TableCell>}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={row.status} />
                      {row.note && (
                        <span className="text-xs text-muted-foreground">{row.note}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {exportError && <p className="text-sm text-red-600">{exportError}</p>}
      </CardContent>
      <CardFooter className="flex-col items-end gap-3">
        <Button variant="outline" onClick={handleExport} disabled={exporting || !sessionId}>
          {exporting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-1.5 h-4 w-4" />
          )}
          Export Excel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={finish}>
            Done
          </Button>
          <Button onClick={goToUploadTemplate}>Analyze</Button>
        </div>
      </CardFooter>
    </Card>
  )
}
